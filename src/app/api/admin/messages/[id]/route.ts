// PUT/DELETE /api/admin/messages/[id] — marquer lu / archiver / supprimer
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, notFound, serverError } from '@/lib/server/helpers'

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

    const existing = await db.contactMessage.findUnique({ where: { id } })
    if (!existing) return notFound('Message introuvable')

    const body = await req.json().catch(() => ({}))
    const data: { isRead?: boolean; isArchived?: boolean } = {}
    if (body?.isRead !== undefined) data.isRead = Boolean(body.isRead)
    if (body?.isArchived !== undefined) data.isArchived = Boolean(body.isArchived)

    const message = await db.contactMessage.update({ where: { id }, data })
    return NextResponse.json({ message })
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

    const existing = await db.contactMessage.findUnique({ where: { id } })
    if (!existing) return notFound('Message introuvable')

    await db.contactMessage.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
