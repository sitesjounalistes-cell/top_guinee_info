// GET /api/public/emissions — émissions FM / podcasts actives avec épisodes publiés (§4.9)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSettings, EPISODE_VISIBLE } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const [emissions, settings] = await Promise.all([
      db.emission.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          episodes: {
            where: EPISODE_VISIBLE(now),
            orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
            take: 20,
          },
        },
      }),
      getSettings(),
    ])
    return NextResponse.json({ emissions, fmLabel: settings.fmLabel })
  } catch (e) {
    console.error('[public/emissions]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des émissions' }, { status: 500 })
  }
}
