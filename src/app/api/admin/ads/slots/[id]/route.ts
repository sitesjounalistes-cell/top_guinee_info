// PUT /api/admin/ads/slots/[id] — activer/désactiver ou renommer un emplacement
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, notFound, serverError, logAction } from '@/lib/server/helpers'

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

    const existing = await db.adSlot.findUnique({ where: { id } })
    if (!existing) return notFound('Emplacement introuvable')

    const body = await req.json().catch(() => ({}))
    const data: { isActive?: boolean; name?: string } = {}
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body?.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })
      data.name = name
    }

    const slot = await db.adSlot.update({ where: { id }, data })
    await logAction(
      user, 'UPDATE', 'AdSlot', id,
      `Emplacement « ${slot.position} » ${data.isActive !== undefined ? (slot.isActive ? 'activé' : 'désactivé') : 'mis à jour'}`,
    )
    return NextResponse.json({ slot })
  } catch (e) {
    return serverError(e)
  }
}
