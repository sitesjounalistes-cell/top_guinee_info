// GET /api/public/home — données de la page d'accueil (§4, §5)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { langOf, translateCards, translateCard, translateTexts, translateText } from '@/lib/server/translate'
import {
  getSettings, visibleWhere, articleCardInclude, toCard, type ArticleCardPayload,
  pickBanner, dayStr, EPISODE_VISIBLE,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const lang = langOf(req.url)
    const now = new Date()

    // VAGUE 1 — toutes les requêtes indépendantes partent ensemble :
    // chaque aller-retour vers la base coûte, les vagues séquentielées
    // multiplieraient la latence (surtout base distante / serverless).
    const since30 = dayStr(new Date(now.getTime() - 30 * 24 * 3600 * 1000))
    const [
      settings, rubriques, flash, mainRows, secondaryRows,
      viewsGrouped, latestEpisodes, latestVideos,
      bannerHeader, bannerFooter, bannerIntercalaire, bannerSidebar,
    ] = await Promise.all([
      getSettings(),
      db.rubrique.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { order: 'asc' },
        include: { children: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      }),
      db.flashInfo.findMany({
        where: {
          isActive: true,
          publishAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
        take: 10,
        // Article lié exposé uniquement s'il est déjà publié (pas de fuite pré-publication)
        include: { article: { where: visibleWhere(now), select: { slug: true, title: true } } },
      }),
      db.article.findMany({
        where: { ...visibleWhere(now), featuredOrder: 1 },
        include: articleCardInclude,
        take: 1,
      }),
      db.article.findMany({
        where: { ...visibleWhere(now), featuredOrder: { gte: 2 } },
        include: articleCardInclude,
        orderBy: { featuredOrder: 'asc' },
        take: 6,
      }),
      db.articleViewLog.groupBy({
        by: ['articleId'],
        where: { day: { gte: since30 } },
        _sum: { count: true },
        orderBy: { _sum: { count: 'desc' } },
        take: 5,
      }),
      db.episode.findMany({
        where: EPISODE_VISIBLE(now),
        include: { emission: { select: { id: true, title: true, coverImage: true } } },
        orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      }),
      db.article.findMany({
        where: { ...visibleWhere(now), youtubeUrl: { not: null } },
        include: articleCardInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      }),
      pickBanner('header'),
      pickBanner('footer'),
      pickBanner('intercalaire'),
      pickBanner('sidebar'),
    ])

    // VAGUE 2 — requêtes dépendantes de la vague 1
    const [rubriqueBlocks, hotArticles, topTotal] = await Promise.all([
      Promise.all(rubriques.map(async r => {
        const ids = [r.id, ...r.children.map(c => c.id)]
        const articles = await db.article.findMany({
          where: { ...visibleWhere(now), rubriqueId: { in: ids } },
          include: articleCardInclude,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 4,
        })
        return { rubrique: r, articles: articles.map(toCard) }
      })),
      (async (): Promise<ArticleCardPayload[]> => {
        const hotIds = viewsGrouped.map(g => g.articleId)
        return hotIds.length
          ? db.article.findMany({ where: { ...visibleWhere(now), id: { in: hotIds } }, include: articleCardInclude })
          : []
      })(),
      db.article.findMany({
        where: visibleWhere(now),
        include: articleCardInclude,
        orderBy: { views: 'desc' },
        take: 10,
      }),
    ])

    // 5. Les plus lus : top 30 jours complété par les vues totales
    let mostRead = hotArticles
    if (mostRead.length < 5) {
      const seen = new Set(mostRead.map(a => a.id))
      for (const a of topTotal) {
        if (mostRead.length >= 5) break
        if (!seen.has(a.id)) {
          mostRead.push(a)
          seen.add(a.id)
        }
      }
    }
    mostRead = mostRead.sort((a, b) => b.views - a.views).slice(0, 5)

    const [header, footer, intercalaire, sidebar] = [bannerHeader, bannerFooter, bannerIntercalaire, bannerSidebar]

    // Construction de la réponse, puis traduction des contenus
    const payload = {
      settings,
      rubriques,
      flash,
      featured: {
        main: mainRows.length ? toCard(mainRows[0]) : null,
        secondary: secondaryRows.map(toCard),
      },
      rubriqueBlocks,
      mostRead: mostRead.map(toCard),
      latestEpisodes,
      latestVideos: latestVideos.map(toCard),
      ads: { header, footer, intercalaire, sidebar },
    }

    // i18n : l'interface est traduite côté client (dictionnaires), les
    // contenus éditoriaux sont traduits ici avec cache en base.
    if (lang !== 'fr') {
      const jobs: Promise<unknown>[] = [
        (async () => { payload.settings.slogan = await translateText(payload.settings.slogan, lang) })(),
        translateTexts(payload.rubriques.map(r => r.name), lang).then(tr => {
          payload.rubriques.forEach((r, i) => { r.name = tr[i] ?? r.name })
        }),
        translateTexts(payload.flash.map(f => f.text), lang).then(tr => {
          payload.flash.forEach((f, i) => { f.text = tr[i] ?? f.text })
        }),
      ]
      if (payload.featured.main) jobs.push(translateCard(payload.featured.main, lang))
      jobs.push(translateCards(payload.featured.secondary, lang))
      for (const block of payload.rubriqueBlocks) {
        jobs.push(translateText(block.rubrique.name, lang).then(t => { block.rubrique.name = t }))
        jobs.push(translateCards(block.articles, lang))
      }
      jobs.push(translateCards(payload.mostRead, lang))
      jobs.push(translateCards(payload.latestVideos, lang))
      jobs.push(translateTexts(
        payload.latestEpisodes.map(e => e.title),
        lang,
      ).then(tr => {
        payload.latestEpisodes.forEach((e, i) => { if (e.title) e.title = tr[i] ?? e.title })
      }))
      await Promise.all(jobs)
    }

    return NextResponse.json(payload)
  } catch (e) {
    console.error('[public/home]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement de la page d\'accueil' }, { status: 500 })
  }
}
