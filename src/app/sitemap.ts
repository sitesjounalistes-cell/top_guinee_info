// Sitemap dynamique — indexation des vraies pages : accueil + articles
// publiés (les vues hash de la SPA ne sont pas des URLs distinctes pour
// les crawlers ; les articles /article/<slug>, si).
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { visibleWhere } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://topguinee.info'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let articles: { slug: string; updatedAt: Date; publishedAt: Date | null }[] = []
  try {
    articles = await db.article.findMany({
      where: visibleWhere(),
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    })
  } catch {
    // base indisponible : sitemap réduit à la page d'accueil
  }

  return [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    ...articles.map(a => ({
      url: `${SITE_URL}/article/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
