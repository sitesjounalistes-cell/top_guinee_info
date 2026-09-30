// GET/POST /api/admin/contacts — canaux de contact (§7.3)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const TYPES = ['phone', 'email', 'whatsapp', 'address', 'other']

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const contacts = await db.contactChannel.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ contacts })
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
    const type = String(body?.type ?? '').trim()
    const value = String(body?.value ?? '').trim()

    if (!TYPES.includes(type)) return bad('Type de canal invalide (phone, email, whatsapp, address, other).')
    if (!value) return bad('La valeur du canal est obligatoire.')

    const contact = await db.contactChannel.create({
      data: {
        type,
        label: String(body?.label ?? ''),
        value,
        order: parseInt(String(body?.order ?? 0), 10) || 0,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
    })

    await logAction(user, 'CREATE', 'ContactChannel', contact.id, `Nouveau canal de contact « ${type} : ${value} »`)
    return NextResponse.json({ contact }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
