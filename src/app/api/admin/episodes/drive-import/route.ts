// POST /api/admin/episodes/drive-import — import en masse depuis un
// DOSSIER Google Drive public (« Tout le monde avec le lien »), SANS clé
// API : la vue embarquée statique du dossier (embeddedfolderview) liste
// ses fichiers ; chaque fichier audio y devient un épisode jouable via
// le proxy interne de streaming.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction, rateLimit, clientIp } from '@/lib/server/helpers'
import { driveFolderIdOf, driveResourceKeyOf, listPublicDriveFolderAudios } from '@/lib/server/drive-public'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    if (!rateLimit(`drive-import:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Trop d\'imports à la suite — réessayez dans un instant.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const emissionId = String(body?.emissionId ?? '').trim()
    const folderUrl = String(body?.folderUrl ?? '').trim()
    const isPublished = Boolean(body?.isPublished ?? false)

    if (!emissionId) return bad('L\'émission est obligatoire.')
    const emission = await db.emission.findUnique({ where: { id: emissionId } })
    if (!emission) return bad('Émission introuvable.')

    const folderId = driveFolderIdOf(folderUrl)
    if (!folderId) return bad('Collez le lien de partage du DOSSIER Drive (https://drive.google.com/drive/folders/…).')
    const resourceKey = driveResourceKeyOf(folderUrl)

    const audios = await listPublicDriveFolderAudios(folderId, resourceKey)
    if (audios === null) {
      return bad('Dossier Drive inaccessible. Partagez-le en « Tout le monde avec le lien » (Lecteur), puis réessayez.')
    }
    if (audios.length === 0) {
      return bad('Aucun fichier audio détecté dans ce dossier (MP3, M4A, WAV, OGG, OPUS, FLAC, AAC).')
    }

    // Éviter les doublons : on ignore les audios déjà importés pour cette
    // émission (même identifiant Drive dans l'URL du proxy).
    const existing = await db.episode.findMany({
      where: { emissionId },
      select: { audioUrl: true },
    })
    const known = new Set(existing.map((e) => e.audioUrl.split('?')[0]))

    const now = new Date()
    const created: { id: string; title: string }[] = []
    for (const a of audios) {
      const url = `/api/public/media/audio/${a.fileId}${resourceKey ? `?rk=${encodeURIComponent(resourceKey)}` : ''}`
      if (known.has(url.split('?')[0])) continue
      const title = a.name.replace(/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma)$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 160) || 'Épisode sans titre'
      const ep = await db.episode.create({
        data: {
          emissionId,
          title,
          description: '',
          audioUrl: url,
          duration: 0,
          guests: '',
          publishAt: now,
          isPublished,
        },
        select: { id: true, title: true },
      })
      created.push(ep)
    }

    await logAction(user, 'CREATE', 'Episode', emissionId, `Import Drive : ${created.length} épisode(s) importé(s) dans « ${emission.title} »`)

    return NextResponse.json({
      created: created.length,
      skipped: audios.length - created.length,
      episodes: created,
    }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
