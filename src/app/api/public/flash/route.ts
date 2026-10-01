// GET /api/public/flash — ticker Flash Info actif (§4.8)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visibleWhere } from '@/lib/server/helpers'
import { langOf, translateTexts } from '@/lib/server/translate'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const lang = langOf(req.url)
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
    if (lang !== 'fr') {
      const trs = await translateTexts(
        flash.flatMap(f => [f.text, f.article?.title || '']),
        lang,
      )
      let i = 0
      for (const f of flash) {
        if (f.text) f.text = trs[i++] ?? f.text
        if (f.article?.title) f.article.title = trs[i++] ?? f.article.title
        else i++
      }
    }
    return NextResponse.json({ flash })
  } catch (e) {
    console.error('[public/flash]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des flashs' }, { status: 500 })
  }
}
