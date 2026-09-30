// GET /api/public/home — données de la page d'accueil (§4, §5)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getSettings, visibleWhere, articleCardInclude, toCard,
  pickBanner, dayStr, EPISODE_VISIBLE,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()

    // 1. Paramètres + rubriques (racines actives avec enfants actifs)
    const [settings, rubriques] = await Promise.all([
      getSettings(),
      db.rubrique.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { order: 'asc' },
        include: {
          children: { where: { isActive: true }, orderBy: { order: 'asc' } },
        },
      }),
    ])

    // 2. Flash infos actives et non expirées
    const flash = await db.flashInfo.findMany({
      where: {
        isActive: true,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
      take: 10,
      // Article lié exposé uniquement s'il est déjà publié (pas de fuite pré-publication)
      include: { article: { where: visibleWhere(now), select: { slug: true, title: true } } },
    })

    // 3. À la Une : 1 principale + secondaires (max 6)
    const [mainRows, secondaryRows] = await Promise.all([
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
    ])

    // 4. Blocs par rubrique racine : 4 derniers articles publiés (rubrique + sous-rubriques)
    const rubriqueBlocks = await Promise.all(
      rubriques.map(async r => {
        const ids = [r.id, ...r.children.map(c => c.id)]
        const articles = await db.article.findMany({
          where: { ...visibleWhere(now), rubriqueId: { in: ids } },
          include: articleCardInclude,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 4,
        })
        return { rubrique: r, articles: articles.map(toCard) }
      }),
    )

    // 5. Les plus lus : top 5 sur 30 jours (ArticleViewLog), complété par les vues totales
    const since30 = dayStr(new Date(now.getTime() - 30 * 24 * 3600 * 1000))
    const grouped = await db.articleViewLog.groupBy({
      by: ['articleId'],
      where: { day: { gte: since30 } },
      _sum: { count: true },
      orderBy: { _sum: { count: 'desc' } },
      take: 5,
    })
    const hotIds = grouped.map(g => g.articleId)
    let mostRead = hotIds.length
      ? await db.article.findMany({
          where: { ...visibleWhere(now), id: { in: hotIds } },
          include: articleCardInclude,
        })
      : []
    if (mostRead.length < 5) {
      const topTotal = await db.article.findMany({
        where: visibleWhere(now),
        include: articleCardInclude,
        orderBy: { views: 'desc' },
        take: 10,
      })
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

    // 6. Derniers épisodes publiés (FM / podcasts) et dernières vidéos
    const [latestEpisodes, latestVideos] = await Promise.all([
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
    ])

    // 7. Bannières publicitaires (rotation pondérée par emplacement)
    const [header, footer, intercalaire, sidebar] = await Promise.all([
      pickBanner('header'),
      pickBanner('footer'),
      pickBanner('intercalaire'),
      pickBanner('sidebar'),
    ])

    return NextResponse.json({
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
    })
  } catch (e) {
    console.error('[public/home]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement de la page d\'accueil' }, { status: 500 })
  }
}
