// PUT/DELETE /api/admin/flash/[id]
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction, parseDate } from '@/lib/server/helpers'

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

    const existing = await db.flashInfo.findUnique({ where: { id } })
    if (!existing) return notFound('Flash introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.text !== undefined) {
      const text = String(body.text).trim()
      if (!text) return bad('Le texte du flash est obligatoire.')
      data.text = text
    }
    if (body?.articleId !== undefined) {
      if (!body.articleId) {
        data.articleId = null
      } else {
        const article = await db.article.findUnique({ where: { id: String(body.articleId) } })
        if (!article) return bad('Article lié introuvable.')
        data.articleId = article.id
      }
    }
    if (body?.priority !== undefined) {
      data.priority = Math.min(3, Math.max(1, parseInt(String(body.priority), 10) || 1))
    }
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body?.publishAt !== undefined) data.publishAt = parseDate(body.publishAt) ?? new Date()
    if (body?.expiresAt !== undefined) data.expiresAt = parseDate(body.expiresAt)

    const flash = await db.flashInfo.update({
      where: { id },
      data,
      include: { article: { select: { slug: true, title: true } } },
    })
    await logAction(user, 'UPDATE', 'FlashInfo', id, `Mise à jour du flash « ${flash.text.slice(0, 80)} »`)
    return NextResponse.json({ flash })
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

    const existing = await db.flashInfo.findUnique({ where: { id } })
    if (!existing) return notFound('Flash introuvable')

    await db.flashInfo.delete({ where: { id } })
    await logAction(user, 'DELETE', 'FlashInfo', id, `Suppression du flash « ${existing.text.slice(0, 80)} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
