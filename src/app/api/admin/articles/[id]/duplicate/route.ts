// POST /api/admin/articles/[id]/duplicate — dupliquer un article en brouillon (§7.5)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import {
  unauth, forbidden, notFound, serverError, logAction,
  uniqueSlugIn, articleFullInclude, toFull,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    const { id } = await params

    const source = await db.article.findUnique({
      where: { id },
      include: { tags: { select: { tag: { select: { id: true } } } } },
    })
    if (!source) return notFound('Article introuvable')

    // Un JOURNALIST ne duplique que ses propres articles
    if (!hasMinRole(user.role, 'CHIEF_EDITOR') && source.authorId !== user.id) {
      return forbidden('Vous ne pouvez dupliquer que vos propres articles.')
    }

    const title = `${source.title} (copie)`.slice(0, 250)
    const slug = await uniqueSlugIn(db.article, `${source.slug}-copie`)

    const copy = await db.article.create({
      data: {
        title,
        subtitle: source.subtitle,
        description: source.description,
        body: source.body,
        slug,
        coverImage: source.coverImage,
        coverAlt: source.coverAlt,
        rubriqueId: source.rubriqueId,
        subRubriqueId: source.subRubriqueId,
        authorId: user.id,
        status: 'DRAFT',
        publishedAt: null,
        scheduledAt: null,
        featuredOrder: null,
        youtubeUrl: source.youtubeUrl,
        readTime: source.readTime,
        views: 0,
        tags: {
          create: source.tags.map(t => ({ tagId: t.tag.id })),
        },
      },
      include: articleFullInclude,
    })

    await logAction(user, 'CREATE', 'Article', copy.id, `Duplication de « ${source.title} »`)
    return NextResponse.json({ article: toFull(copy) }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
