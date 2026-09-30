// GET /api/admin/stats?period=day|week|month|all — statistiques de consultation (§7.7)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { unauth, serverError, dayStr, articleCardInclude, toCard } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    const sp = new URL(req.url).searchParams
    const period = sp.get('period') || 'month'
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 0
    const now = new Date()

    // Fenêtre de la timeline : toujours 30 points (30 derniers jours)
    const timelineStart = dayStr(new Date(now.getTime() - 29 * 24 * 3600 * 1000))
    // Fenêtre de la période choisie pour les cartes / ventilations
    const sinceStr = days ? dayStr(new Date(now.getTime() - (days - 1) * 24 * 3600 * 1000)) : null

    // Agrégats calculés en base (groupBy) : plus de chargement complet des
    // logs de vues — le volume transféré ne dépend plus du nombre de jours.
    const [byArticleAgg, byDayAgg] = await Promise.all([
      db.articleViewLog.groupBy({
        by: ['articleId'],
        where: sinceStr ? { day: { gte: sinceStr } } : {},
        _sum: { count: true },
      }),
      db.articleViewLog.groupBy({
        by: ['day'],
        where: { day: { gte: timelineStart } },
        _sum: { count: true },
      }),
    ])
    const perArticle = new Map<string, number>(byArticleAgg.map(r => [r.articleId, r._sum.count || 0]))
    const perDay = new Map<string, number>(byDayAgg.map(r => [r.day, r._sum.count || 0]))
    const views = byArticleAgg.reduce((sum, r) => sum + (r._sum.count || 0), 0)

    // Timeline 30 points complétée à zéro
    const timeline: { day: string; views: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = dayStr(new Date(now.getTime() - i * 24 * 3600 * 1000))
      timeline.push({ day: d, views: perDay.get(d) || 0 })
    }

    // Articles : select ciblé — ne charge JAMAIS le corps des articles
    // (champ le plus volumineux) pour de simples ventilations.
    const [articles, episodes] = await Promise.all([
      db.article.findMany({
        select: {
          id: true, status: true, readTime: true, youtubeUrl: true,
          rubrique: { select: { id: true, name: true, color: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      db.episode.aggregate({ _sum: { listens: true }, _count: true }),
    ])

    const published = articles.filter(a => a.status === 'PUBLISHED')

    const byRubriqueMap = new Map<string, { name: string; color: string; views: number; count: number }>()
    const byAuthorMap = new Map<string, { name: string; views: number; count: number }>()
    let texteCount = 0
    let videoCount = 0
    let readTimeSum = 0

    for (const a of published) {
      readTimeSum += a.readTime
      if (a.youtubeUrl) videoCount++; else texteCount++

      const keyR = a.rubrique.id
      const r = byRubriqueMap.get(keyR) || { name: a.rubrique.name, color: a.rubrique.color, views: 0, count: 0 }
      r.count += 1
      r.views += perArticle.get(a.id) || 0
      byRubriqueMap.set(keyR, r)

      const keyA = a.author.id
      const au = byAuthorMap.get(keyA) || { name: a.author.name, views: 0, count: 0 }
      au.count += 1
      au.views += perArticle.get(a.id) || 0
      byAuthorMap.set(keyA, au)
    }

    const byRubrique = [...byRubriqueMap.values()].sort((a, b) => b.views - a.views)
    const byAuthor = [...byAuthorMap.values()].sort((a, b) => b.views - a.views).slice(0, 10)

    // Top / flop articles publiés
    const [topArticles, bottomArticles] = await Promise.all([
      db.article.findMany({
        where: { status: 'PUBLISHED' },
        include: articleCardInclude,
        orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
      }),
      db.article.findMany({
        where: { status: 'PUBLISHED' },
        include: articleCardInclude,
        orderBy: [{ views: 'asc' }, { publishedAt: 'desc' }],
        take: 5,
      }),
    ])

    return NextResponse.json({
      cards: {
        views,
        articles: articles.length,
        avgReadTime: published.length ? Math.round(readTimeSum / published.length) : 0,
        episodes: episodes._count,
        listens: episodes._sum.listens ?? 0,
      },
      timeline,
      byRubrique,
      byAuthor,
      mediaMix: [
        { name: 'Texte', value: texteCount },
        { name: 'Vidéo', value: videoCount },
        { name: 'Audio', value: episodes._count },
      ],
      topArticles: topArticles.map(toCard),
      bottomArticles: bottomArticles.map(toCard),
    })
  } catch (e) {
    return serverError(e)
  }
}
