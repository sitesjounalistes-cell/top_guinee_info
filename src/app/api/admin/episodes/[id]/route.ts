// PUT/DELETE /api/admin/episodes/[id]
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction, parseDate } from '@/lib/server/helpers'
import { safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.episode.findUnique({ where: { id } })
    if (!existing) return notFound('Épisode introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.emissionId !== undefined) {
      const emission = await db.emission.findUnique({ where: { id: String(body.emissionId) } })
      if (!emission) return bad('Émission introuvable.')
      data.emissionId = emission.id
    }
    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return bad('Le titre de l\'épisode est obligatoire.')
      data.title = title
    }
    if (body?.description !== undefined) data.description = String(body.description)
    if (body?.audioUrl !== undefined) {
      const audioUrl = safeMediaUrl(body.audioUrl)
      if (!audioUrl) return bad('Le fichier audio est obligatoire.')
      data.audioUrl = audioUrl
    }
    if (body?.duration !== undefined) data.duration = parseInt(String(body.duration), 10) || 0
    if (body?.guests !== undefined) data.guests = String(body.guests)
    if (body?.articleId !== undefined) {
      if (!body.articleId) {
        data.articleId = null
      } else {
        const article = await db.article.findUnique({ where: { id: String(body.articleId) } })
        if (!article) return bad('Article lié introuvable.')
        data.articleId = article.id
      }
    }
    if (body?.publishAt !== undefined) data.publishAt = parseDate(body.publishAt)
    if (body?.isPublished !== undefined) data.isPublished = Boolean(body.isPublished)

    const episode = await db.episode.update({
      where: { id },
      data,
      include: { emission: { select: { id: true, title: true, coverImage: true } } },
    })
    await logAction(user, 'UPDATE', 'Episode', id, `Mise à jour de l'épisode « ${episode.title} »`)
    return NextResponse.json({ episode })
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.episode.findUnique({ where: { id } })
    if (!existing) return notFound('Épisode introuvable')

    await db.episode.delete({ where: { id } })
    await logAction(user, 'DELETE', 'Episode', id, `Suppression de l'épisode « ${existing.title} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
