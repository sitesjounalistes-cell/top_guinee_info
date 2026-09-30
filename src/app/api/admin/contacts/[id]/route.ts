// PUT/DELETE /api/admin/contacts/[id]
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const TYPES = ['phone', 'email', 'whatsapp', 'address', 'other']

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.contactChannel.findUnique({ where: { id } })
    if (!existing) return notFound('Canal de contact introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.type !== undefined) {
      const type = String(body.type).trim()
      if (!TYPES.includes(type)) return bad('Type de canal invalide.')
      data.type = type
    }
    if (body?.label !== undefined) data.label = String(body.label)
    if (body?.value !== undefined) {
      const value = String(body.value).trim()
      if (!value) return bad('La valeur du canal est obligatoire.')
      data.value = value
    }
    if (body?.order !== undefined) data.order = parseInt(String(body.order), 10) || 0
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const contact = await db.contactChannel.update({ where: { id }, data })
    await logAction(user, 'UPDATE', 'ContactChannel', id, `Mise à jour du canal « ${contact.type} »`)
    return NextResponse.json({ contact })
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

    const existing = await db.contactChannel.findUnique({ where: { id } })
    if (!existing) return notFound('Canal de contact introuvable')

    await db.contactChannel.delete({ where: { id } })
    await logAction(user, 'DELETE', 'ContactChannel', id, `Suppression du canal « ${existing.type} : ${existing.value} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
