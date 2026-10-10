// Sitemap dynamique — indexation des vraies pages : accueil + articles
// publiés (les vues hash de la SPA ne sont pas des URLs distinctes pour
// les crawlers ; les articles /article/<slug>, si). L'origine est déduite
// de la requête réelle : le sitemap reste juste sur vercel.app comme sur
// le domaine définitif, sans dépendre d'une variable d'environnement.
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { visibleWhere } from '@/lib/server/helpers'
import { siteOrigin } from '@/lib/server/site-origin'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin()
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
    { url: origin, changeFrequency: 'hourly', priority: 1 },
    ...articles.map(a => ({
      url: `${origin}/article/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
