// GET /api/admin/overview — cartes + flux récents du tableau de bord (§7.7)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, serverError, dayStr, articleCardInclude, toCard } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    const now = new Date()
    const since7 = dayStr(new Date(now.getTime() - 7 * 24 * 3600 * 1000))

    const [
      articles, published, drafts, viewsAgg, viewsWeekAgg,
      messagesUnread, episodes, activeCampaigns, impressionsAgg, clicksAgg,
    ] = await Promise.all([
      db.article.count(),
      db.article.count({ where: { status: 'PUBLISHED' } }),
      db.article.count({ where: { status: 'DRAFT' } }),
      db.article.aggregate({ _sum: { views: true } }),
      db.articleViewLog.aggregate({ where: { day: { gte: since7 } }, _sum: { count: true } }),
      db.contactMessage.count({ where: { isRead: false, isArchived: false } }),
      db.episode.count(),
      db.adCampaign.count({ where: { isActive: true } }),
      db.adCampaign.aggregate({ _sum: { impressions: true } }),
      db.adCampaign.aggregate({ _sum: { clicks: true } }),
    ])

    // Messages de lecteurs (e-mails, contenus) : réservés aux responsables de rédaction
    const canReadMessages = hasMinRole(user.role, 'CHIEF_EDITOR')

    const [recentArticles, recentMessages, recentLogs, topArticles] = await Promise.all([
      db.article.findMany({
        include: articleCardInclude,
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      canReadMessages
        ? db.contactMessage.findMany({ orderBy: { receivedAt: 'desc' }, take: 5 })
        : Promise.resolve([]),
      db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      db.article.findMany({
        where: { status: 'PUBLISHED' },
        include: articleCardInclude,
        orderBy: { views: 'desc' },
        take: 5,
      }),
    ])

    return NextResponse.json({
      cards: {
        articles,
        published,
        drafts,
        views: viewsAgg._sum.views ?? 0,
        viewsWeek: viewsWeekAgg._sum.count ?? 0,
        messagesUnread,
        episodes,
        activeCampaigns,
        impressions: impressionsAgg._sum.impressions ?? 0,
        clicks: clicksAgg._sum.clicks ?? 0,
      },
      recentArticles: recentArticles.map(toCard),
      recentMessages,
      recentLogs,
      topArticles: topArticles.map(toCard),
    })
  } catch (e) {
    return serverError(e)
  }
}
