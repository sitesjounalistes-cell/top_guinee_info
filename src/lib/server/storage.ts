// Stockage externe Topguinee.info (§6 — externalisation des médias)
// ─────────────────────────────────────────────────────────────────────
// • Images ET audios → Cloudinary (CDN) — configuration unique
//   (cloud name + clé API + secret) : les audios sont servis directement
//   par le CDN Cloudinary (resource_type « video », qui couvre l'audio).
// • Repli historique : Google Drive pour l'audio (streaming via proxy
//   /api/public/media/audio/[fileId]) — utilisé uniquement si Cloudinary
//   n'est pas configuré mais que Drive l'est.
// • Repli final → disque local public/uploads.
// Module SERVEUR uniquement — les clés ne quittent jamais le backend.
import crypto from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { getStorageConfig, cloudinaryConfigured, driveConfigured } from './helpers'
import type { StorageConfig } from './helpers'
import type { StorageTestResult } from '@/lib/types'

const CLOUDINARY_FOLDER = 'topguinee'
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'weba',
}

// ─── Utilitaires ──────────────────────────────────────────────────

function safeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'fichier'
}

function extFor(mime: string, fallbackName: string): string {
  const byMime = IMAGE_TYPES[mime] || AUDIO_TYPES[mime]
  if (byMime) return byMime
  const m = /\.([a-z0-9]{2,5})$/i.exec(fallbackName)
  return m ? m[1].toLowerCase() : 'bin'
}

// ─── Cloudinary (images) — upload signé via API REST ──────────────

function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&') + apiSecret
  return crypto.createHash('sha1').update(toSign).digest('hex')
}

/** Envoie une image vers Cloudinary. Retourne l'URL sécurisée (CDN). */
export async function uploadImageToCloudinary(
  buffer: Buffer, filename: string, mime: string, cfg: StorageConfig,
): Promise<{ url: string; publicId: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const params = { folder: CLOUDINARY_FOLDER, timestamp }
  const signature = cloudinarySignature(params, cfg.cloudApiSecret)

  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), safeName(filename))
  fd.append('api_key', cfg.cloudApiKey)
  fd.append('timestamp', timestamp)
  fd.append('folder', CLOUDINARY_FOLDER)
  fd.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(60_000),
  })
  const json = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok || !json.secure_url) {
    const msg = (json as { error?: { message?: string } }).error?.message || `Cloudinary a répondu ${res.status}`
    throw new Error(msg)
  }
  return { url: String(json.secure_url), publicId: String(json.public_id || '') }
}

/**
 * Envoie un fichier AUDIO vers Cloudinary (resource_type « video », qui
 * couvre les médias audio : mp3, wav, ogg, m4a, aac…). Le lecteur du site
 * diffuse ensuite directement l'URL du CDN — plus de proxy serveur.
 */
export async function uploadAudioToCloudinary(
  buffer: Buffer, filename: string, mime: string, cfg: StorageConfig,
): Promise<{ url: string; publicId: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const folder = `${CLOUDINARY_FOLDER}/audio`
  const params = { folder, timestamp }
  const signature = cloudinarySignature(params, cfg.cloudApiSecret)

  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), safeName(filename))
  fd.append('api_key', cfg.cloudApiKey)
  fd.append('timestamp', timestamp)
  fd.append('folder', folder)
  fd.append('signature', signature)
  // Les gros fichiers : le upload direct reste limité par le timeout —
  // Cloudinary recommande chunked pour > 100 Mo, hors de notre périmètre.

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/video/upload`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(180_000),
  })
  const json = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok || !json.secure_url) {
    const msg = (json as { error?: { message?: string } }).error?.message || `Cloudinary a répondu ${res.status}`
    throw new Error(msg)
  }
  return { url: String(json.secure_url), publicId: String(json.public_id || '') }
}

// ─── Google Drive (audio) — compte de service + JWT RS256 ─────────

interface CachedToken { token: string; exp: number }
let driveTokenCache: CachedToken | null = null

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

/** Obtient (et met en cache) un jeton d'accès Google via un JWT de compte de service. */
export async function driveAccessToken(cfg: StorageConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (driveTokenCache && driveTokenCache.exp - 60 > now) return driveTokenCache.token

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: cfg.driveClientEmail,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = signer.sign(cfg.drivePrivateKey).toString('base64url')
  const assertion = `${header}.${claims}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const json = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok || !json.access_token) {
    const desc = (json as { error_description?: string; error?: string }).error_description
      || (json as { error?: string }).error || `Google OAuth a répondu ${res.status}`
    throw new Error(desc)
  }
  driveTokenCache = { token: String(json.access_token), exp: now + Number(json.expires_in || 3600) }
  return driveTokenCache.token
}

/** Envoie un fichier audio dans le dossier Drive configuré et le rend accessible en lecture publique. */
export async function uploadAudioToDrive(
  buffer: Buffer, filename: string, mime: string, cfg: StorageConfig,
): Promise<{ fileId: string; name: string }> {
  const token = await driveAccessToken(cfg)
  const name = safeName(filename)
  const boundary = `tg${Date.now()}${crypto.randomBytes(6).toString('hex')}`

  const metadata = JSON.stringify({
    name,
    parents: [cfg.driveFolderId],
  })

  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
  const tail = `\r\n--${boundary}--\r\n`

  const payload = Buffer.concat([
    Buffer.from(body, 'utf8'),
    new Uint8Array(buffer),
    Buffer.from(tail, 'utf8'),
  ])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(payload),
      signal: AbortSignal.timeout(120_000),
    },
  )
  const json = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok || !json.id) {
    const msg = (json as { error?: { message?: string } }).error?.message || `Google Drive a répondu ${res.status}`
    throw new Error(msg)
  }
  const fileId = String(json.id)

  // Lecture publique (le proxy serveur utilise aussi son jeton, mais un
  // lien partagé permet les usages directs : lecteurs externes, RSS…)
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
        signal: AbortSignal.timeout(30_000),
      },
    )
  } catch {
    // non bloquant : le proxy serveur continue de fonctionner
  }

  return { fileId, name: String(json.name || name) }
}

/** Vérifie qu'un fichier appartient bien au dossier Drive configuré (anti-SSRF). */
const driveFileOkCache = new Map<string, number>()
const driveFileKoCache = new Map<string, number>()
const DRIVE_CACHE_TTL = 10 * 60 * 1000

async function driveFileBelongsToFolder(fileId: string, cfg: StorageConfig, token: string): Promise<boolean> {
  const now = Date.now()
  const cached = driveFileOkCache.get(fileId)
  if (cached && now - cached < DRIVE_CACHE_TTL) return true
  // Cache négatif : un fileId refusé n'interroge plus l'API Drive pendant
  // 10 min — un flood d'identifiants aléatoires ne consomme plus le quota.
  const cachedKo = driveFileKoCache.get(fileId)
  if (cachedKo && now - cachedKo < DRIVE_CACHE_TTL) return false
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,parents`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
  )
  if (!res.ok) {
    driveFileKoCache.set(fileId, now)
    if (driveFileKoCache.size > 5000) driveFileKoCache.clear()
    return false
  }
  const json = await res.json().catch(() => ({} as { parents?: string[] }))
  const ok = Array.isArray(json.parents) && json.parents.includes(cfg.driveFolderId)
  if (ok) {
    driveFileOkCache.set(fileId, now)
    if (driveFileOkCache.size > 5000) driveFileOkCache.clear()
  } else {
    driveFileKoCache.set(fileId, now)
    if (driveFileKoCache.size > 5000) driveFileKoCache.clear()
  }
  return ok
}

export interface DriveStream {
  status: number
  contentType: string
  contentLength?: string
  contentRange?: string
  acceptRanges: boolean
  body: ReadableStream<Uint8Array> | null
}

/**
 * Proxy de streaming audio depuis Google Drive — avec support de la plage
 * (Range) pour l'avancement/le déplacement dans le lecteur audio du site.
 */
export async function getDriveFileStream(fileId: string, range?: string | null): Promise<DriveStream | null> {
  const cfg = await getStorageConfig()
  if (!driveConfigured(cfg)) return null
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(fileId)) return null

  const token = await driveAccessToken(cfg)
  if (!(await driveFileBelongsToFolder(fileId, cfg, token))) return null

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (range) headers.Range = range

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers, signal: AbortSignal.timeout(60_000) },
  )
  if (!res.ok || !res.body) return null

  return {
    status: res.status, // 200 (tout le fichier) ou 206 (plage)
    contentType: res.headers.get('content-type') || 'audio/mpeg',
    contentLength: res.headers.get('content-length') || undefined,
    contentRange: res.headers.get('content-range') || undefined,
    acceptRanges: true,
    body: res.body,
  }
}

// ─── Repli local (service non configuré) ──────────────────────────

async function saveLocal(dir: 'uploads' | 'uploads/audio', buffer: Buffer, filename: string, mime: string): Promise<string> {
  const ext = extFor(mime, filename)
  const base = safeName(filename).replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 50) || 'media'
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}.${ext}`
  const targetDir = path.join(process.cwd(), 'public', dir)
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(path.join(targetDir, name), buffer)
  return `/${dir}/${name}`
}

// ─── API unifiée utilisée par /api/admin/upload ───────────────────

export interface UploadOutcome {
  url: string
  provider: 'cloudinary' | 'drive' | 'local'
  warning?: string
}

export async function storeImage(buffer: Buffer, filename: string, mime: string): Promise<UploadOutcome> {
  const cfg = await getStorageConfig()
  if (cloudinaryConfigured(cfg)) {
    try {
      const { url } = await uploadImageToCloudinary(buffer, filename, mime, cfg)
      return { url, provider: 'cloudinary' }
    } catch (e) {
      console.error('[storage] Cloudinary indisponible, repli local :', e)
      const url = await saveLocal('uploads', buffer, filename, mime)
      return {
        url, provider: 'local',
        warning: `Cloudinary indisponible (${e instanceof Error ? e.message : 'erreur'}) — image stockée localement.`,
      }
    }
  }
  return { url: await saveLocal('uploads', buffer, filename, mime), provider: 'local' }
}

export async function storeAudio(buffer: Buffer, filename: string, mime: string): Promise<UploadOutcome> {
  const cfg = await getStorageConfig()
  // Voie principale : Cloudinary (mêmes identifiants que les images) —
  // l'audio est servi directement par le CDN, sans proxy serveur.
  if (cloudinaryConfigured(cfg)) {
    try {
      const { url } = await uploadAudioToCloudinary(buffer, filename, mime, cfg)
      return { url, provider: 'cloudinary' }
    } catch (e) {
      console.error('[storage] Cloudinary audio indisponible, repli local :', e)
      const url = await saveLocal('uploads/audio', buffer, filename, mime)
      return {
        url, provider: 'local',
        warning: `Cloudinary indisponible (${e instanceof Error ? e.message : 'erreur'}) — audio stocké localement.`,
      }
    }
  }
  // Repli historique : Google Drive (si configuré sans Cloudinary)
  if (driveConfigured(cfg)) {
    try {
      const { fileId } = await uploadAudioToDrive(buffer, filename, mime, cfg)
      // L'URL stockée en base est un chemin relatif : le proxy sert le flux
      // depuis Google Drive à chaque écoute (stockage 100 % externalisé).
      return { url: `/api/public/media/audio/${fileId}`, provider: 'drive' }
    } catch (e) {
      console.error('[storage] Google Drive indisponible, repli local :', e)
      const url = await saveLocal('uploads/audio', buffer, filename, mime)
      return {
        url, provider: 'local',
        warning: `Google Drive indisponible (${e instanceof Error ? e.message : 'erreur'}) — audio stocké localement.`,
      }
    }
  }
  return { url: await saveLocal('uploads/audio', buffer, filename, mime), provider: 'local' }
}

// ─── Test des connexions (Paramètres → Stockage) ──────────────────

export async function testStorageConnections(): Promise<StorageTestResult> {
  const cfg = await getStorageConfig()

  // Cloudinary : ping signé sur la liste des ressources
  let cloudinary: StorageTestResult['cloudinary']
  if (!cloudinaryConfigured(cfg)) {
    cloudinary = { ok: false, message: 'Non configuré — renseignez le cloud name, la clé API et le secret.' }
  } else {
    try {
      // /resources est une endpoint de l'ADMIN API Cloudinary : elle
      // s'authentifie en HTTP Basic (clé:secret), pas par signature.
      const basic = Buffer.from(`${cfg.cloudApiKey}:${cfg.cloudApiSecret}`).toString('base64')
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cfg.cloudName}/resources?max_results=1`,
        { headers: { Authorization: `Basic ${basic}` }, signal: AbortSignal.timeout(20_000) },
      )
      cloudinary = res.ok
        ? { ok: true, message: `Connecté au cloud « ${cfg.cloudName} ».` }
        : { ok: false, message: `Cloudinary a répondu ${res.status} — vérifiez les identifiants.` }
    } catch (e) {
      cloudinary = { ok: false, message: e instanceof Error ? e.message : 'Erreur réseau vers Cloudinary.' }
    }
  }

  // Google Drive : jeton + accès au dossier configuré
  let drive: StorageTestResult['drive']
  if (!driveConfigured(cfg)) {
    drive = { ok: false, message: 'Non configuré — renseignez l\'identifiant du dossier, l\'e-mail du compte de service et la clé privée.' }
  } else {
    try {
      const token = await driveAccessToken(cfg)
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cfg.driveFolderId)}?supportsAllDrives=true&fields=id,name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
      )
      if (res.ok) {
        const json = await res.json().catch(() => ({} as { name?: string; mimeType?: string }))
        if (json.mimeType && json.mimeType.includes('folder')) {
          drive = { ok: true, message: `Connecté — dossier « ${json.name || cfg.driveFolderId} » accessible.` }
        } else {
          drive = { ok: false, message: 'L\'identifiant fourni ne pointe pas vers un dossier Drive.' }
        }
      } else {
        drive = { ok: false, message: `Drive a répondu ${res.status} — vérifiez le dossier, le compte de service et son partage.` }
      }
    } catch (e) {
      drive = { ok: false, message: e instanceof Error ? e.message : 'Erreur réseau vers Google Drive.' }
    }
  }

  return { cloudinary, drive }
}
