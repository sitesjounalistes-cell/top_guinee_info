// PUT/DELETE /api/admin/emissions/[id] — la suppression cascade les épisodes
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction } from '@/lib/server/helpers'
import { safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

const TYPES = ['PODCAST', 'CHRONIQUE', 'FM']

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.emission.findUnique({ where: { id } })
    if (!existing) return notFound('Émission introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return bad('Le titre de l\'émission est obligatoire.')
      data.title = title
    }
    if (body?.description !== undefined) data.description = String(body.description)
    if (body?.coverImage !== undefined) data.coverImage = body.coverImage ? safeMediaUrl(body.coverImage) || null : null
    if (body?.type !== undefined) data.type = TYPES.includes(body.type) ? body.type : existing.type
    if (body?.order !== undefined) data.order = parseInt(String(body.order), 10) || 0
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const emission = await db.emission.update({ where: { id }, data })
    await logAction(user, 'UPDATE', 'Emission', id, `Mise à jour de l'émission « ${emission.title} »`)
    return NextResponse.json({ emission })
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

    const existing = await db.emission.findUnique({
      where: { id },
      include: { _count: { select: { episodes: true } } },
    })
    if (!existing) return notFound('Émission introuvable')

    await db.emission.delete({ where: { id } }) // supprime les épisodes (cascade)
    await logAction(
      user, 'DELETE', 'Emission', id,
      `Suppression de l'émission « ${existing.title} » (${existing._count.episodes} épisode(s) supprimé(s))`,
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
