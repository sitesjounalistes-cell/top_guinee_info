// GET /api/public/emissions — émissions FM / podcasts actives avec épisodes publiés (§4.9)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSettings, EPISODE_VISIBLE } from '@/lib/server/helpers'
import { langOf, translateTexts } from '@/lib/server/translate'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const lang = langOf(req.url)
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
    if (lang !== 'fr') {
      const texts: string[] = []
      for (const em of emissions) {
        texts.push(em.title, em.description)
        for (const ep of em.episodes) texts.push(ep.title, ep.description)
      }
      const trs = await translateTexts(texts, lang)
      let i = 0
      for (const em of emissions) {
        if (em.title) em.title = trs[i++] ?? em.title
        if (em.description) em.description = trs[i++] ?? em.description
        for (const ep of em.episodes) {
          if (ep.title) ep.title = trs[i++] ?? ep.title
          if (ep.description) ep.description = trs[i++] ?? ep.description
        }
      }
    }
    return NextResponse.json({ emissions, fmLabel: settings.fmLabel })
  } catch (e) {
    console.error('[public/emissions]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des émissions' }, { status: 500 })
  }
}
