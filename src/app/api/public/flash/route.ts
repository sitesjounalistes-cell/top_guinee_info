// GET /api/public/flash — ticker Flash Info actif (§4.8)
// Deux sources, fusionnées dans l'ordre d'affichage du bandeau :
// 1. les flashs manuels de la rédaction (cockpit → Flash Info), actifs
//    et non expirés — urgences et annonces éditoriales en priorité ;
// 2. EN COMPLÉMENT AUTOMATIQUE : les titres des derniers articles
//    publiés (6 max, dédublonnés des flashs déjà liés à un article).
//    Le bandeau reste ainsi alimenté tant que la rédaction publie,
//    sans intervention dans le cockpit.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visibleWhere } from '@/lib/server/helpers'
import { stripHtml } from '@/lib/sanitize'
import { langOf, translateTexts } from '@/lib/server/translate'

export const dynamic = 'force-dynamic'

const AUTO_ARTICLES = 6

export async function GET(req: Request) {
  try {
    const lang = langOf(req.url)
    const now = new Date()

    // 1. Flashs manuels actifs (urgence d'abord)
    const flash = await db.flashInfo.findMany({
      where: {
        isActive: true,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
      take: 20,
      include: { article: { where: visibleWhere(now), select: { id: true, slug: true, title: true } } },
    })

    // 2. Titres des derniers articles publiés — complément automatique
    const covered = [...new Set(flash.map((f) => f.articleId).filter((id): id is string => !!id))]
    const recent = await db.article.findMany({
      where: { ...visibleWhere(now), id: { notIn: covered } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: AUTO_ARTICLES,
      select: { id: true, title: true, slug: true, publishedAt: true, createdAt: true },
    })

    const auto = recent
      .map((a) => {
        const title = stripHtml(a.title).trim()
        if (!title) return null
        return {
          id: `auto-${a.id}`,
          text: title,
          articleId: a.id,
          priority: 1,
          isActive: true,
          publishAt: (a.publishedAt || a.createdAt).toISOString(),
          expiresAt: null,
          article: { slug: a.slug, title },
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (lang !== 'fr') {
      const items = [...flash, ...auto]
      const trs = await translateTexts(
        items.flatMap((f) => [f.text, f.article?.title || '']),
        lang,
      )
      let i = 0
      for (const f of items) {
        if (f.text) f.text = trs[i++] ?? f.text
        if (f.article?.title) f.article.title = trs[i++] ?? f.article.title
        else i++
      }
    }

    return NextResponse.json({ flash: [...flash, ...auto] })
  } catch (e) {
    console.error('[public/flash]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des flashs' }, { status: 500 })
  }
}
