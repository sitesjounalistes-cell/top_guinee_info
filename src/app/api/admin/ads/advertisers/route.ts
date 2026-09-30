// GET/POST /api/admin/ads/advertisers — annonceurs (§7.9)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const advertisers = await db.advertiser.findMany({
      orderBy: { name: 'asc' },
      include: { campaigns: { orderBy: { createdAt: 'desc' } } },
    })
    return NextResponse.json({ advertisers })
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
    const name = String(body?.name ?? '').trim()
    if (!name) return bad('Le nom de l\'annonceur est obligatoire.')

    const advertiser = await db.advertiser.create({
      data: {
        name,
        contact: String(body?.contact ?? ''),
        notes: String(body?.notes ?? ''),
      },
    })

    await logAction(user, 'CREATE', 'Advertiser', advertiser.id, `Nouvel annonceur « ${name} »`)
    return NextResponse.json({ advertiser }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
