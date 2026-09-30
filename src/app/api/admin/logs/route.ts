// GET /api/admin/logs?type=&userId= — journal d'activité (§7.11)
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    // Le journal contient les identités et horodatages de connexion : ADMIN uniquement
    if (!hasMinRole(user.role, 'ADMIN')) return forbidden('Le journal d\'activité est réservé aux administrateurs.')

    const sp = new URL(req.url).searchParams
    const type = (sp.get('type') || '').trim()
    const userId = (sp.get('userId') || '').trim()

    const where: Prisma.ActivityLogWhereInput = {}
    if (type) where.action = type
    if (userId) where.userId = userId

    const logs = await db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ logs })
  } catch (e) {
    return serverError(e)
  }
}
