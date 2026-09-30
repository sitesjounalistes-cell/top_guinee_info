// GET/POST /api/admin/flash — gestion des flashs infos (§7.8)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction, parseDate } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const flash = await db.flashInfo.findMany({
      orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
      include: { article: { select: { slug: true, title: true } } },
    })
    return NextResponse.json({ flash })
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const body = await req.json().catch(() => ({}))
    const text = String(body?.text ?? '').trim()
    if (!text) return bad('Le texte du flash est obligatoire.')
    if (text.length > 300) return bad('Le texte du flash est trop long (300 caractères maximum).')

    let articleId: string | null = null
    if (body?.articleId) {
      const article = await db.article.findUnique({ where: { id: String(body.articleId) } })
      if (!article) return bad('Article lié introuvable.')
      articleId = article.id
    }

    const priority = Math.min(3, Math.max(1, parseInt(String(body?.priority ?? 1), 10) || 1))

    const flash = await db.flashInfo.create({
      data: {
        text,
        articleId,
        priority,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
        publishAt: parseDate(body?.publishAt) ?? new Date(),
        expiresAt: parseDate(body?.expiresAt),
      },
      include: { article: { select: { slug: true, title: true } } },
    })

    await logAction(user, 'CREATE', 'FlashInfo', flash.id, `Nouveau flash : « ${text.slice(0, 80)} »`)
    return NextResponse.json({ flash }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
