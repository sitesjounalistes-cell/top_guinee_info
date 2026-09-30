// GET /api/public/flash — ticker Flash Info actif (§4.8)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visibleWhere } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const flash = await db.flashInfo.findMany({
      where: {
        isActive: true,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
      take: 20,
      include: { article: { where: visibleWhere(now), select: { slug: true, title: true } } },
    })
    return NextResponse.json({ flash })
  } catch (e) {
    console.error('[public/flash]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des flashs' }, { status: 500 })
  }
}
