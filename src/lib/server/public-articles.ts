// Logique partagée de listing public d'articles — utilisée par
// /api/public/articles et /api/public/search (alias)
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  visibleWhere, articleCardInclude, toCard,
} from './helpers'

export async function listPublicArticles(sp: URLSearchParams) {
  const now = new Date()
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const limitRaw = parseInt(sp.get('limit') || '12', 10) || 12
  const limit = Math.min(48, Math.max(1, limitRaw))
  // Terme borné : évite les requêtes géantes et l'amplification de coût
  const q = (sp.get('q') || '').trim().slice(0, 80)
  const rubriqueSlug = sp.get('rubrique') || ''
  const subSlug = sp.get('sub') || ''
  const tagSlug = sp.get('tag') || ''
  const hasVideo = sp.get('hasVideo') === '1'
  const sort = sp.get('sort') || 'recent'

  const where = visibleWhere(now)

  // Filtre rubrique racine (inclut ses sous-rubriques) — ignoré si `sub` fourni
  if (subSlug) {
    const sub = await db.rubrique.findUnique({ where: { slug: subSlug } })
    if (!sub) return { items: [], total: 0, page, pages: 1 }
    where.rubriqueId = sub.id
  } else if (rubriqueSlug) {
    const r = await db.rubrique.findUnique({
      where: { slug: rubriqueSlug },
      include: { children: { select: { id: true } } },
    })
    if (!r) return { items: [], total: 0, page, pages: 1 }
    where.rubriqueId = { in: [r.id, ...r.children.map(c => c.id)] }
  }

  if (tagSlug) {
    const tag = await db.tag.findUnique({ where: { slug: tagSlug } })
    if (!tag) return { items: [], total: 0, page, pages: 1 }
    where.tags = { some: { tagId: tag.id } }
  }

  if (hasVideo) where.youtubeUrl = { not: null }

    // Recherche sur les champs courts — PAS sur le corps HTML
    // (colonne volumineuse, LIKE %q% non indexable => scan complet à chaque recherche)
    // mode insensitive : PostgreSQL est sensible à la casse par défaut
    // (SQLite l'était de facto pour l'ASCII).
    if (q) {
      where.AND = [{
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { subtitle: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }]
    }

  let orderBy: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: 'desc' }, { createdAt: 'desc' }]
  if (sort === 'views') orderBy = [{ views: 'desc' }, { publishedAt: 'desc' }]
  else if (sort === 'oldest') orderBy = [{ publishedAt: 'asc' }]

  const [total, rows] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      include: articleCardInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return {
    items: rows.map(toCard),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}
