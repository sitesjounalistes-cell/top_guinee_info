// GET /api/public/articles/[slug] — article complet + articles similaires
// Incrémente les vues (compteur + journal quotidien ArticleViewLog)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  visibleWhere, articleFullInclude, articleCardInclude, toFull, toCard,
  notFound, serverError, dayStr, getSettings, type ArticleCardPayload,
  clientIp, isBot, oncePerWindow,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const now = new Date()

    const article = await db.article.findUnique({
      where: { slug },
      include: articleFullInclude,
    })

    // 404 si absent ou non visible publiquement (brouillon, dépublié, programmé, non publié)
    if (!article) return notFound('Article introuvable')
    const visible =
      article.status === 'PUBLISHED' &&
      !!article.publishedAt && article.publishedAt.getTime() <= now.getTime() &&
      (!article.scheduledAt || article.scheduledAt.getTime() <= now.getTime())
    if (!visible) return notFound('Article introuvable')

    // Compteur de vues fiabilisé : un rafraîchissement répété ou un robot
    // ne gonfle plus les statistiques (1 vue / IP / article / heure).
    const countView = !isBot(req) && oncePerWindow(`view:${clientIp(req)}:${article.slug}`, 60 * 60 * 1000)
    const day = dayStr(now)
    if (countView) await Promise.all([
      db.article.update({ where: { id: article.id }, data: { views: { increment: 1 } } }),
      db.articleViewLog.upsert({
        where: { articleId_day: { articleId: article.id, day } },
        create: { articleId: article.id, day, count: 1 },
        update: { count: { increment: 1 } },
      }),
    ]).catch(e => console.error('[public/articles/:slug] compteur de vues', e))

    // Articles similaires : même rubrique d'abord, puis tags communs, puis récents
    const excludeIds = new Set([article.id])
    const similar: ArticleCardPayload[] = []

    const sameRubrique = await db.article.findMany({
      where: { ...visibleWhere(now), rubriqueId: article.rubriqueId, id: { not: article.id } },
      include: articleCardInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 4,
    })
    for (const a of sameRubrique) {
      if (similar.length < 4 && !excludeIds.has(a.id)) {
        similar.push(a)
        excludeIds.add(a.id)
      }
    }

    if (similar.length < 4 && article.tags.length > 0) {
      const tagIds = article.tags.map(t => t.tag.id)
      const byTags = await db.article.findMany({
        where: {
          ...visibleWhere(now),
          id: { notIn: [...excludeIds] },
          tags: { some: { tagId: { in: tagIds } } },
        },
        include: articleCardInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      })
      for (const a of byTags) {
        if (similar.length < 4 && !excludeIds.has(a.id)) {
          similar.push(a)
          excludeIds.add(a.id)
        }
      }
    }

    if (similar.length < 4) {
      const recent = await db.article.findMany({
        where: { ...visibleWhere(now), id: { notIn: [...excludeIds] } },
        include: articleCardInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 4 - similar.length,
      })
      for (const a of recent) {
        if (similar.length < 4 && !excludeIds.has(a.id)) {
          similar.push(a)
          excludeIds.add(a.id)
        }
      }
    }

    // Settings inclus (titre de page côté front, tolère l'absence)
    const settings = await getSettings()

    return NextResponse.json({
      settings,
      article: toFull(article),
      similar: similar.map(toCard),
    })
  } catch (e) {
    return serverError(e)
  }
}
