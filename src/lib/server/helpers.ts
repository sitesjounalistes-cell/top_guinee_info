// Helpers serveur partagés par toutes les routes API Topguinee.info
// Module SERVEUR uniquement (jamais importé côté client).
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { sanitizeRichText, sanitizeInline } from '@/lib/sanitize'
import type { SiteSettings, AdBannerData, ArticleCardData, ArticleFull } from '@/lib/types'

// ─── Réponses standardisées ───────────────────────────────────────

export function unauth() {
  return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
}

export function forbidden(message = 'Action non autorisée pour votre rôle.') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function notFound(message = 'Ressource introuvable') {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function serverError(e: unknown) {
  // Le détail (message Prisma, stack…) reste côté serveur : le client ne
  // reçoit jamais que l'erreur est interne — pas de divulgation de schéma.
  console.error('[api]', e)
  return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
}

// ─── Journal d'activité (§7.11) ───────────────────────────────────

interface LogUser { id?: string | null; name?: string | null }

export async function logAction(
  user: LogUser | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail = '',
) {
  try {
    await db.activityLog.create({
      data: {
        userId: user?.id ?? null,
        userLabel: user?.name ?? 'système',
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail.slice(0, 500),
      },
    })
  } catch (e) {
    console.error('logAction échec', e)
  }
}

// ─── Dates ────────────────────────────────────────────────────────

export function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

/** Convertit une valeur de formulaire en Date ; '' / invalide → null */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Visibilité publique des articles ─────────────────────────────

/** Articles visibles publiquement : PUBLISHED + publiés + (non programmés OU déjà arrivés à échéance) */
export function visibleWhere(now = new Date()): Prisma.ArticleWhereInput {
  return {
    status: 'PUBLISHED',
    publishedAt: { not: null, lte: now },
    OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
  }
}

// ─── Sélection "carte article" ────────────────────────────────────

export const articleCardInclude = {
  rubrique: { select: { id: true, name: true, slug: true, color: true } },
  subRubrique: { select: { id: true, name: true, slug: true, color: true } },
  author: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ArticleInclude

export type ArticleCardPayload = Prisma.ArticleGetPayload<{ include: typeof articleCardInclude }>

export const articleFullInclude = {
  ...articleCardInclude,
  media: true,
} satisfies Prisma.ArticleInclude

export type ArticleFullPayload = Prisma.ArticleGetPayload<{ include: typeof articleFullInclude }>

export function toCard(a: ArticleCardPayload): ArticleCardData {
  return {
    id: a.id,
    // Champs courts enrichis (gras/italique/police) : nettoyés par liste
    // blanche inline à la lecture comme à l'écriture
    title: sanitizeInline(a.title),
    subtitle: sanitizeInline(a.subtitle),
    description: sanitizeInline(a.description),
    slug: a.slug,
    coverImage: a.coverImage,
    coverAlt: a.coverAlt,
    status: a.status as ArticleCardData['status'],
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString() : null,
    views: a.views,
    readTime: a.readTime,
    youtubeUrl: a.youtubeUrl,
    featuredOrder: a.featuredOrder,
    rubrique: a.rubrique ?? null,
    subRubrique: a.subRubrique ?? null,
    author: a.author ?? null,
    tags: (a.tags ?? []).map(t => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug })),
  }
}

export function toFull(a: ArticleFullPayload): ArticleFull {
  return {
    ...toCard(a),
    // Défense en profondeur : même les données antérieures au durcissement
    // sont nettoyées à la lecture (la sauvegarde sanitise déjà à l'écriture).
    body: sanitizeRichText(a.body),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    authorId: a.authorId,
    rubriqueId: a.rubriqueId,
    subRubriqueId: a.subRubriqueId ?? null,
    media: (a.media ?? []).map(m => ({
      id: m.id,
      type: m.type as 'image' | 'video' | 'audio',
      url: m.url,
      alt: m.alt,
      articleId: m.articleId,
      meta: m.meta,
      createdAt: m.createdAt.toISOString(),
    })),
  }
}

// ─── Slugs uniques ────────────────────────────────────────────────

export function slugifyLocal(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90)
}

interface SlugDelegate {
  findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null>
}

/** Génère un slug unique dans la table donnée (suffixes -2, -3…). */
export async function uniqueSlugIn(
  delegate: SlugDelegate,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugifyLocal(base) || 'sans-titre'
  let candidate = root
  let i = 1
  for (;;) {
    const existing = await delegate.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
    i += 1
    candidate = `${root}-${i}`
  }
}

/**
 * Résout l'id d'un tag par son nom (exact) puis par son slug ;
 * le crée si nécessaire. Idempotent — évite les doublons de nom.
 */
export async function resolveTagId(name: string): Promise<string> {
  const slug = slugifyLocal(name)
  const byName = await db.tag.findFirst({ where: { name } })
  if (byName) return byName.id
  const bySlug = await db.tag.findUnique({ where: { slug } })
  if (bySlug) return bySlug.id
  try {
    const created = await db.tag.create({ data: { name, slug } })
    return created.id
  } catch {
    // Course concurrente : retente la lecture
    const again = (await db.tag.findFirst({ where: { name } })) ||
      (await db.tag.findUnique({ where: { slug } }))
    if (again) return again.id
    throw new Error(`Impossible de créer le tag « ${name} »`)
  }
}

// ─── Temps de lecture ─────────────────────────────────────────────

export function computeReadTime(body: string): number {
  const len = (body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length
  return Math.max(1, Math.round(len / 900))
}

// ─── Paramètres du site ───────────────────────────────────────────

export const SETTING_KEYS = [
  'siteName', 'slogan', 'fmLabel', 'logoUrl', 'seoTitle',
  'seoDescription', 'seoImage', 'analyticsId', 'maintenance',
  'fmEnabled', 'tvEnabled', 'tvLabel', 'tvYoutubeUrl', 'tvFacebookUrl',
] as const

/** Clés booléennes stockées 'on' | 'off' */
export const TOGGLE_KEYS = new Set(['maintenance', 'fmEnabled', 'tvEnabled'])

const DEFAULT_SETTINGS: Record<string, string> = {
  siteName: 'Topguinee.info',
  slogan: 'L\'information au-delà du factuel',
  fmLabel: 'FM',
  logoUrl: '/brand/logo-lockup.png',
  seoTitle: 'Topguinee.info — L\'information au-delà du factuel',
  seoDescription: 'Toute l\'actualité guinéenne et internationale : politique, économie, société, sport, culture.',
  seoImage: '',
  analyticsId: '',
  maintenance: 'off',
  fmEnabled: 'on',
  tvEnabled: 'off',
  tvLabel: 'TV',
  tvYoutubeUrl: '',
  tvFacebookUrl: '',
}

export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } } })
  const stored = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const out: Record<string, string> = { ...DEFAULT_SETTINGS }
  for (const k of SETTING_KEYS) {
    if (stored[k] !== undefined && stored[k] !== '') out[k] = stored[k]
  }
  return out as unknown as SiteSettings
}

// ─── Stockage externe (§6 — images Cloudinary, audio Google Drive) ────

export interface StorageConfig {
  cloudName: string
  cloudApiKey: string
  cloudApiSecret: string
  driveFolderId: string
  driveClientEmail: string
  drivePrivateKey: string
}

const STORAGE_KEYS = [
  'storageCloudName', 'storageCloudApiKey', 'storageCloudApiSecret',
  'storageDriveFolderId', 'storageDriveClientEmail', 'storageDrivePrivateKey',
] as const

/**
 * Configuration du stockage externe : lue en base (Paramètres → Stockage),
 * avec repli sur les variables d'environnement si la base est vide.
 * Ne JAMAIS exposer ces valeurs via une API publique.
 */
export async function getStorageConfig(): Promise<StorageConfig> {
  let stored: Record<string, string> = {}
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { in: [...STORAGE_KEYS] } } })
    stored = Object.fromEntries(rows.map(r => [r.key, r.value]))
  } catch {
    // base indisponible : on retombe sur l'env
  }
  const pick = (k: string, env: string) => (stored[k] || process.env[env] || '').trim()
  return {
    cloudName: pick('storageCloudName', 'CLOUDINARY_CLOUD_NAME'),
    cloudApiKey: pick('storageCloudApiKey', 'CLOUDINARY_API_KEY'),
    cloudApiSecret: pick('storageCloudApiSecret', 'CLOUDINARY_API_SECRET'),
    driveFolderId: pick('storageDriveFolderId', 'GDRIVE_FOLDER_ID'),
    driveClientEmail: pick('storageDriveClientEmail', 'GDRIVE_CLIENT_EMAIL'),
    drivePrivateKey: normalizePem(pick('storageDrivePrivateKey', 'GDRIVE_PRIVATE_KEY')),
  }
}

/** Restaure les retours à la ligne d'une clé privée collée depuis la console Google. */
function normalizePem(raw: string): string {
  if (!raw) return ''
  let pem = raw.replace(/\\n/g, '\n').trim()
  if (!pem.includes('-----BEGIN')) {
    // clé collée sans en-têtes : on reconstruit un PEM complet
    const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
    if (body) {
      pem = '-----BEGIN PRIVATE KEY-----\n'
        + body.replace(/(.{64})/g, '$1\n').replace(/\n$/g, '')
        + '\n-----END PRIVATE KEY-----'
    }
  }
  return pem
}

export function cloudinaryConfigured(c: StorageConfig): boolean {
  return Boolean(c.cloudName && c.cloudApiKey && c.cloudApiSecret)
}

export function driveConfigured(c: StorageConfig): boolean {
  return Boolean(c.driveFolderId && c.driveClientEmail && c.drivePrivateKey)
}

// ─── Bannières publicitaires (rotation pondérée, §7.9) ────────────

export async function pickBanner(position: string): Promise<AdBannerData | null> {
  try {
    const now = new Date()
    const campaigns = await db.adCampaign.findMany({
      where: {
        isActive: true,
        imageUrl: { not: null },
        slot: { position, isActive: true },
      },
      include: { slot: true },
    })
    const active = campaigns.filter(
      c => c.startDate.getTime() <= now.getTime() && (!c.endDate || c.endDate.getTime() >= now.getTime()),
    )
    if (!active.length) return null
    const pool: typeof active = []
    for (const c of active) {
      for (let i = 0; i < Math.max(1, c.weight); i++) pool.push(c)
    }
    const picked = pool[Math.floor(Math.random() * pool.length)]
    return {
      id: picked.id,
      title: picked.title,
      imageUrl: picked.imageUrl,
      linkUrl: picked.linkUrl,
      format: picked.slot.format || '',
    }
  } catch (e) {
    console.error('pickBanner échec', e)
    return null
  }
}

// ─── Anti-spam : limite de débit en mémoire ───────────────────────
// Mono-instance (déploiement standalone). Pour un déploiement multi-instances,
// remplacer par un store partagé (Redis…).

const hits = new Map<string, number[]>()
const MAX_RATE_KEYS = 10_000
let lastRatePurge = 0

/** Purge périodique des clés expirées + cap mémoire : la Map ne croît pas sans borne. */
function purgeRateMap(now: number) {
  if (now - lastRatePurge < 60_000) return
  lastRatePurge = now
  for (const [k, arr] of hits) {
    if (!arr.some(t => now - t < 3_600_000)) hits.delete(k)
  }
  // Filet de sécurité : si la Map est malgré tout saturée (XFF forgés…), on la vide.
  if (hits.size > MAX_RATE_KEYS) hits.clear()
}

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  purgeRateMap(now)
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (arr.length >= max) {
    hits.set(key, arr)
    return false
  }
  arr.push(now)
  hits.set(key, arr)
  return true
}

/** Déduplication temporelle : retourne true au plus une fois par fenêtre pour une clé. */
const seenOnce = new Map<string, number>()
const MAX_SEEN_KEYS = 20_000

export function oncePerWindow(key: string, windowMs: number): boolean {
  const now = Date.now()
  const last = seenOnce.get(key) || 0
  if (now - last < windowMs) return false
  // Purge intégrée : on supprime au passage les entrées expirées.
  if (seenOnce.size > MAX_SEEN_KEYS) {
    for (const [k, t] of seenOnce) {
      if (now - t >= windowMs) seenOnce.delete(k)
    }
    if (seenOnce.size > MAX_SEEN_KEYS) seenOnce.clear()
  }
  seenOnce.set(key, now)
  return true
}

const IP_RE = /^[0-9a-fA-F.:[\]]{3,45}$/

/**
 * IP client « la plus proche de nous » dans X-Forwarded-For.
 * On prend la DERNIÈRE valeur valide : celle ajoutée par notre propre proxy
 * (Caddy écrase l'en-tête avec l'IP réelle du client). La première valeur est
 * choisie par le client et donc forgable — on ne l'utilise jamais.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      if (IP_RE.test(parts[i])) return parts[i]
    }
  }
  const real = req.headers.get('x-real-ip')
  if (real && IP_RE.test(real)) return real
  return 'local'
}

/** Robots et crawlers : ne pas compter leurs hits dans les statistiques de vues. */
export function isBot(req: Request): boolean {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  return /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|whatsapp|telegram|preview|monitor|pingdom|uptime/.test(ua)
}

// ─── Divers ───────────────────────────────────────────────────────

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())
}

/** Normalise une liste de tags envoyée par le front : ['Santé'] ou [{name:'Santé'}] */
export function normalizeTagNames(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const names = input
    .map((t: unknown) => (typeof t === 'string' ? t : (t as { name?: string } | null)?.name))
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
  return [...new Set(names.map(n => n.trim().slice(0, 60)))]
}

export const EPISODE_VISIBLE = (now = new Date()): Prisma.EpisodeWhereInput => ({
  isPublished: true,
  OR: [{ publishAt: null }, { publishAt: { lte: now } }],
})
