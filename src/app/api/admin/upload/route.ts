// POST /api/admin/upload — import de médias (§6)
// ─────────────────────────────────────────────────────────────────────
// • Images → Cloudinary (CDN)      • Audio → Google Drive (streaming)
// • Repli automatique sur le disque local (public/uploads) si le service
//   externe n'est pas configuré — dégradation gracieuse avec avertissement.
// Sécurité : Content-Length contrôlé AVANT tout buffering, type MIME
// recoupé avec la signature binaire réelle (magic bytes) — le type
// déclaré par le client ne suffit jamais.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { bad, unauth, serverError, logAction, rateLimit, clientIp } from '@/lib/server/helpers'
import { storeImage, storeAudio } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
])
const AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  'audio/mp4', 'audio/aac', 'audio/webm',
])
// Créas vidéo (publicités animées) : conteneurs MP4/WebM/MOV
const VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'audio/webm', 'audio/mp4',
])
const IMAGE_MAX = 8 * 1024 * 1024   // 8 Mo
const AUDIO_MAX = 80 * 1024 * 1024  // 80 Mo
const VIDEO_MAX = 40 * 1024 * 1024  // 40 Mo

// ─── Signature binaire (magic bytes) ──────────────────────────────

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false
  return bytes.every((b, i) => buf[offset + i] === b)
}

/**
 * Type MIME réel déduit du contenu. Le Content-Type déclaré par le
 * client est trivial à falsifier ; la signature binaire ne l'est pas.
 */
function sniffMime(buf: Buffer): string | null {
  // JPEG : FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // GIF87a / GIF89a
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  // WebP / WAV : conteneurs RIFF
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46])) {
    if (buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
    if (buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
    return null
  }
  // MP3 : ID3 ou trame MPEG (FF Ex/Fx)
  if (startsWith(buf, [0x49, 0x44, 0x33])) return 'audio/mpeg'
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  // OGG
  if (startsWith(buf, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg'
  // WebM / MKV (EBML) — l'audio webm
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm'
  // MP4 / M4A / AAC : boîte ftyp — la marque distingue la vidéo de l'audio
  if (startsWith(buf, [0x00, 0x00, 0x00], 0) && buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12).toLowerCase()
    if (brand.startsWith('avi') || brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    if (brand.startsWith('m4a')) return 'audio/mp4'
    // isom / iso2 / mp42 / avc1 / dash / msnv… : conteneur vidéo
    return 'video/mp4'
  }
  return null
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    // Garde-fou anti-saturation mémoire : on refuse AVANT de bufferiser
    // un corps manifestement trop gros (formData() charge tout en RAM).
    const declaredLength = parseInt(req.headers.get('content-length') || '0', 10)
    const hardCap = AUDIO_MAX + 1024 * 1024 // marge pour l'en-tête multipart
    if (declaredLength > hardCap) {
      return bad('Fichier trop lourd (80 Mo maximum pour l\'audio, 8 Mo pour les images).', 413)
    }
    // Limite de débit : un compte compromis ne peut pas marteler l'upload
    if (!rateLimit(`upload:${user.id}:${clientIp(req)}`, 30, 60_000)) {
      return bad('Trop d\'envois à la suite — réessayez dans un instant.', 429)
    }

    const form = await req.formData()
    const file = form.get('file')
    const type = String(form.get('type') || 'image')

    if (!(file instanceof File)) return bad('Aucun fichier reçu.')
    if (type !== 'image' && type !== 'audio' && type !== 'video') {
      return bad('Type de média inconnu (image, audio ou vidéo attendus).')
    }

    const isImage = type === 'image'
    const isVideo = type === 'video'
    const okTypes = isImage ? IMAGE_TYPES : isVideo ? VIDEO_TYPES : AUDIO_TYPES
    if (!okTypes.has(file.type)) {
      return bad(
        isImage
          ? 'Format d\'image non pris en charge (JPG, PNG, WebP, GIF ou AVIF attendus).'
          : isVideo
            ? 'Format vidéo non pris en charge (MP4 ou WebM attendus).'
            : 'Format audio non pris en charge (MP3, WAV, M4A, OGG ou AAC attendus).',
      )
    }

    const max = isImage ? IMAGE_MAX : isVideo ? VIDEO_MAX : AUDIO_MAX
    if (file.size > max) {
      return bad(`Fichier trop lourd (${Math.round(max / (1024 * 1024))} Mo maximum).`, 413)
    }
    if (file.size === 0) return bad('Le fichier est vide.')

    const buffer = Buffer.from(await file.arrayBuffer())

    // Le contenu doit correspondre au type annoncé (anti-spoofing MIME)
    const sniffed = sniffMime(buffer)
    if (!sniffed || !okTypes.has(sniffed)) {
      return bad('Le contenu du fichier ne correspond pas à son type annoncé.')
    }

    // Le stockage reçoit le type vérifié (et non le type déclaré)
    const verifiedType = sniffed === 'audio/mp3' ? 'audio/mpeg'
      : sniffed === 'audio/x-wav' ? 'audio/wav'
      : sniffed

    // Vidéo et audio passent par le même canal Cloudinary (resource_type
    // « video », qui couvre les deux) — dossier distinct pour les créas pub
    const outcome = isImage
      ? await storeImage(buffer, file.name, verifiedType)
      : await storeAudio(buffer, file.name, verifiedType, isVideo ? 'topguinee/video' : undefined)

    await logAction(
      user,
      isImage ? 'upload_image' : isVideo ? 'upload_video' : 'upload_audio',
      'media',
      null,
      `${file.name} → ${outcome.provider}`,
    )

    return NextResponse.json(outcome)
  } catch (e) {
    return serverError(e)
  }
}
