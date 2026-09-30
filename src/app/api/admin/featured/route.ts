// GET/PUT /api/admin/featured — gestion de la Une : 1 principale + secondaires ordonnés (§4.7)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import {
  unauth, forbidden, bad, serverError, logAction, visibleWhere, articleCardInclude, toCard,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const now = new Date()
    const [mainRows, secondaryRows, candidates] = await Promise.all([
      db.article.findMany({
        where: { ...visibleWhere(now), featuredOrder: 1 },
        include: articleCardInclude,
        take: 1,
      }),
      db.article.findMany({
        where: { ...visibleWhere(now), featuredOrder: { gte: 2 } },
        include: articleCardInclude,
        orderBy: { featuredOrder: 'asc' },
        take: 10,
      }),
      // 10 derniers articles publiés hors Une
      db.article.findMany({
        where: { ...visibleWhere(now), featuredOrder: null },
        include: articleCardInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ])

    return NextResponse.json({
      main: mainRows.length ? toCard(mainRows[0]) : null,
      secondary: secondaryRows.map(toCard),
      candidates: candidates.map(toCard),
    })
  } catch (e) {
    return serverError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const body = await req.json().catch(() => ({}))
    const mainId = body?.mainId ? String(body.mainId) : null
    const secondaryIds: string[] = Array.isArray(body?.secondaryIds)
      ? body.secondaryIds.map((v: unknown) => String(v)).filter(Boolean).slice(0, 9)
      : []

    if (mainId && secondaryIds.includes(mainId)) {
      return bad('L\'article principal ne peut pas aussi figurer dans les secondaires.')
    }

    // Vérification d'existence
    const ids = [...new Set([mainId, ...secondaryIds].filter(Boolean) as string[])]
    if (ids.length) {
      const count = await db.article.count({ where: { id: { in: ids } } })
      if (count !== ids.length) return bad('Un des articles sélectionnés est introuvable.')
    }

    // Réinitialisation puis réattribution de l'ordre éditorial
    await db.article.updateMany({ data: { featuredOrder: null } })
    if (mainId) {
      await db.article.update({ where: { id: mainId }, data: { featuredOrder: 1 } })
    }
    for (let i = 0; i < secondaryIds.length; i++) {
      await db.article.update({ where: { id: secondaryIds[i] }, data: { featuredOrder: i + 2 } })
    }

    await logAction(
      user, 'UPDATE', 'Article', mainId,
      `Mise à jour de la Une (${mainId ? '1 principale' : 'sans principale'}${secondaryIds.length ? `, ${secondaryIds.length} secondaire(s)` : ''})`,
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
