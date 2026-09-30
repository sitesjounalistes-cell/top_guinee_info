// GET /api/admin/ads/slots — emplacements publicitaires (§7.9)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const slots = await db.adSlot.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { campaigns: { orderBy: { createdAt: 'desc' } } },
    })
    return NextResponse.json({ slots })
  } catch (e) {
    return serverError(e)
  }
}
