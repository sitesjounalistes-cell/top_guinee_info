// GET/POST /api/admin/articles — liste (tous statuts) et création d'articles (§7.4, §7.5)
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { sanitizeRichText, sanitizeInline, safeMediaUrl, safeHttpUrl } from '@/lib/sanitize'
import {
  unauth, bad, serverError, logAction, parseDate, computeReadTime,
  uniqueSlugIn, articleCardInclude, articleFullInclude, toCard, toFull,
  normalizeTagNames, resolveTagId,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

// ─── GET : listing admin (filtres q / status / rubriqueId / page / limit) ──
export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    const sp = new URL(req.url).searchParams
    const q = (sp.get('q') || '').trim()
    const status = (sp.get('status') || '').trim()
    const rubriqueId = (sp.get('rubriqueId') || '').trim()
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const limit = Math.min(48, Math.max(1, parseInt(sp.get('limit') || '12', 10) || 12))

    const where: Prisma.ArticleWhereInput = {}
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { subtitle: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (status && status !== 'all') where.status = status
    if (rubriqueId) {
      // rubrique racine : inclure ses sous-rubriques
      const children = await db.rubrique.findMany({ where: { parentId: rubriqueId }, select: { id: true } })
      where.rubriqueId = { in: [rubriqueId, ...children.map(c => c.id)] }
    }

    const [total, rows] = await Promise.all([
      db.article.count({ where }),
      db.article.findMany({
        where,
        include: articleCardInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: rows.map(toCard),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (e) {
    return serverError(e)
  }
}

// ─── POST : création ──
export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    const body = await req.json().catch(() => ({}))
    const title = String(body?.title ?? '').trim()
    const rubriqueId = String(body?.rubriqueId ?? '').trim()

    if (!title) return bad('Le titre est obligatoire.')
    if (title.length > 250) return bad('Le titre est trop long (250 caractères maximum).')
    if (!rubriqueId) return bad('La rubrique est obligatoire.')
    const rubrique = await db.rubrique.findUnique({ where: { id: rubriqueId } })
    if (!rubrique) return bad('Rubrique introuvable.')

    const subRubriqueId = body?.subRubriqueId ? String(body.subRubriqueId) : null
    if (subRubriqueId) {
      const sub = await db.rubrique.findUnique({ where: { id: subRubriqueId } })
      if (!sub) return bad('Sous-rubrique introuvable.')
    }

    const canPublish = hasMinRole(user.role, 'CHIEF_EDITOR')
    const status = ['DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'].includes(body?.status)
      // Un JOURNALIST ne peut créer qu'un brouillon ou une demande de relecture
      ? (canPublish ? body.status : (body.status === 'REVIEW' ? 'REVIEW' : 'DRAFT'))
      : 'DRAFT'
    const coverImage = body?.coverImage ? safeMediaUrl(body.coverImage) || null : null
    const slug = await uniqueSlugIn(db.article, title)
    // Le corps HTML est nettoyé par liste blanche AVANT stockage (anti-XSS stocké)
    const bodyHtml = sanitizeRichText(String(body?.body ?? ''))
    const readTime = computeReadTime(bodyHtml)

    const now = new Date()
    const publishedAt = status === 'PUBLISHED' && !body?.publishedAt
      ? now
      : parseDate(body?.publishedAt)
    const scheduledAt = canPublish ? parseDate(body?.scheduledAt) : null

    const tagNames = normalizeTagNames(body?.tags)
    const tagIds: string[] = []
    for (const name of tagNames) {
      tagIds.push(await resolveTagId(name))
    }
    const uniqueTagIds = [...new Set(tagIds)]

    const article = await db.article.create({
      data: {
        title: sanitizeInline(title),
        subtitle: sanitizeInline(String(body?.subtitle ?? '')),
        description: sanitizeInline(String(body?.description ?? '')),
        body: bodyHtml,
        slug,
        coverImage,
        coverAlt: String(body?.coverAlt ?? ''),
        rubriqueId,
        subRubriqueId,
        authorId: user.id,
        status,
        publishedAt,
        scheduledAt,
        youtubeUrl: body?.youtubeUrl ? safeHttpUrl(body.youtubeUrl) || null : null,
        readTime,
        tags: {
          create: uniqueTagIds.map(tagId => ({ tagId })),
        },
        ...(coverImage
          ? {
              media: {
                create: { type: 'image', url: coverImage, alt: String(body?.coverAlt ?? '') },
              },
            }
          : {}),
      },
      include: articleFullInclude,
    })

    await logAction(user, 'CREATE', 'Article', article.id, `Création de l'article « ${title} »`)
    return NextResponse.json({ article: toFull(article) }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
