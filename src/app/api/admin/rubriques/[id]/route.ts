// PUT/DELETE /api/admin/rubriques/[id]
// Suppression refusée si des articles sont rattachés (proposition : isActive=false)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction, uniqueSlugIn } from '@/lib/server/helpers'
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

    const existing = await db.rubrique.findUnique({ where: { id } })
    if (!existing) return notFound('Rubrique introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return bad('Le nom de la rubrique est obligatoire.')
      data.name = name
    }
    if (body?.menuLabel !== undefined) data.menuLabel = body.menuLabel ? String(body.menuLabel) : null
    if (body?.slug !== undefined && body.slug) {
      data.slug = await uniqueSlugIn(db.rubrique, String(body.slug), id)
    }
    if (body?.parentId !== undefined) {
      if (!body.parentId) {
        data.parentId = null
      } else {
        if (String(body.parentId) === id) return bad('Une rubrique ne peut pas être sa propre parente.')
        const parent = await db.rubrique.findUnique({ where: { id: String(body.parentId) } })
        if (!parent) return bad('Rubrique parente introuvable.')
        data.parentId = parent.id
      }
    }
    if (body?.color !== undefined) data.color = String(body.color)
    if (body?.icon !== undefined) data.icon = String(body.icon)
    if (body?.imageUrl !== undefined) data.imageUrl = body.imageUrl ? safeMediaUrl(body.imageUrl) || null : null
    if (body?.order !== undefined) data.order = parseInt(String(body.order), 10) || 0
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const rubrique = await db.rubrique.update({ where: { id }, data })
    await logAction(user, 'UPDATE', 'Rubrique', id, `Mise à jour de la rubrique « ${rubrique.name} »`)
    return NextResponse.json({ rubrique })
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

    const existing = await db.rubrique.findUnique({
      where: { id },
      include: { _count: { select: { articles: true, subOf: true, children: true } } },
    })
    if (!existing) return notFound('Rubrique introuvable')

    const linked = existing._count.articles + existing._count.subOf
    if (linked > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer : ${linked} article(s) sont rattachés à cette rubrique. Désactivez-la plutôt (isActive = false).`,
        },
        { status: 409 },
      )
    }
    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${existing._count.children} sous-rubrique(s) sont rattachées. Déplacez-les d'abord.` },
        { status: 409 },
      )
    }

    await db.rubrique.delete({ where: { id } })
    await logAction(user, 'DELETE', 'Rubrique', id, `Suppression de la rubrique « ${existing.name} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
