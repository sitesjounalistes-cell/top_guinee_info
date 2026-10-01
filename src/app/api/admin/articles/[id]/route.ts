// GET/PUT/DELETE /api/admin/articles/[id] — fiche, mise à jour, suppression (§7.5)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { sanitizeRichText, sanitizeInline, safeMediaUrl, safeHttpUrl } from '@/lib/sanitize'
import {
  unauth, bad, forbidden, notFound, serverError, logAction, parseDate, computeReadTime,
  uniqueSlugIn, articleFullInclude, toFull, normalizeTagNames, resolveTagId,
} from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']
/** Statuts accessibles à un JOURNALIST sur ses propres articles */
const JOURNALIST_STATUSES = ['DRAFT', 'REVIEW']

// ─── GET : fiche complète ──
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    const { id } = await params
    const article = await db.article.findUnique({ where: { id }, include: articleFullInclude })
    if (!article) return notFound('Article introuvable')
    return NextResponse.json({ article: toFull(article) })
  } catch (e) {
    return serverError(e)
  }
}

// ─── PUT : mise à jour ──
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    const { id } = await params

    const existing = await db.article.findUnique({ where: { id } })
    if (!existing) return notFound('Article introuvable')

    // Un JOURNALIST ne modifie que SES articles — pas ceux des autres rédacteurs
    const isChief = hasMinRole(user.role, 'CHIEF_EDITOR')
    if (!isChief && existing.authorId !== user.id) {
      return forbidden('Vous ne pouvez modifier que vos propres articles.')
    }

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return bad('Le titre ne peut pas être vide.')
      if (title.length > 250) return bad('Le titre est trop long (250 caractères maximum).')
      data.title = sanitizeInline(title)
    }
    if (body?.subtitle !== undefined) data.subtitle = sanitizeInline(String(body.subtitle))
    if (body?.description !== undefined) data.description = sanitizeInline(String(body.description))
    if (body?.body !== undefined) {
      // Nettoyage par liste blanche avant stockage (anti-XSS stocké)
      data.body = sanitizeRichText(String(body.body))
      data.readTime = computeReadTime(String(data.body))
    }
    if (body?.coverImage !== undefined) data.coverImage = body.coverImage ? safeMediaUrl(body.coverImage) || null : null
    if (body?.coverAlt !== undefined) data.coverAlt = String(body.coverAlt)

    if (body?.rubriqueId !== undefined) {
      const rubrique = await db.rubrique.findUnique({ where: { id: String(body.rubriqueId) } })
      if (!rubrique) return bad('Rubrique introuvable.')
      data.rubriqueId = rubrique.id
    }
    if (body?.subRubriqueId !== undefined) {
      if (!body.subRubriqueId) data.subRubriqueId = null
      else {
        const sub = await db.rubrique.findUnique({ where: { id: String(body.subRubriqueId) } })
        if (!sub) return bad('Sous-rubrique introuvable.')
        data.subRubriqueId = sub.id
      }
    }

    // Le changement d'auteur (réattribution) est réservé aux responsables
    if (body?.authorId !== undefined && body.authorId) {
      if (!isChief) return forbidden('Seul un responsable de rédaction peut réassigner un article.')
      const author = await db.user.findUnique({ where: { id: String(body.authorId) } })
      if (!author) return bad('Auteur introuvable.')
      data.authorId = author.id
    }

    if (body?.slug !== undefined && body.slug) {
      data.slug = await uniqueSlugIn(db.article, String(body.slug), id)
    }

    if (body?.status !== undefined) {
      if (!STATUSES.includes(body.status)) return bad('Statut invalide.')
      // Un JOURNALIST ne peut ni publier, ni dépublier, ni archiver
      if (!isChief && !JOURNALIST_STATUSES.includes(body.status)) {
        return forbidden('La publication est réservée aux responsables de rédaction.')
      }
      data.status = body.status
      // Passage à PUBLISHED sans date de publication → publier maintenant
      if (body.status === 'PUBLISHED' && !existing.publishedAt && body?.publishedAt === undefined) {
        data.publishedAt = new Date()
      }
    }

    // Programmation et mise à la Une : réservées aux responsables
    if (!isChief) {
      delete body.publishedAt
      delete body.scheduledAt
      delete body.featuredOrder
    }
    if (body?.publishedAt !== undefined) data.publishedAt = parseDate(body.publishedAt)
    if (body?.scheduledAt !== undefined) data.scheduledAt = parseDate(body.scheduledAt)
    if (body?.youtubeUrl !== undefined) data.youtubeUrl = body.youtubeUrl ? safeHttpUrl(body.youtubeUrl) || null : null
    if (body?.featuredOrder !== undefined) data.featuredOrder = body.featuredOrder === null ? null : parseInt(String(body.featuredOrder), 10) || null

    // Tags : remplacement complet
    if (body?.tags !== undefined) {
      const tagNames = normalizeTagNames(body.tags)
      const tagIds: string[] = []
      for (const name of tagNames) {
        tagIds.push(await resolveTagId(name))
      }
      await db.articleTag.deleteMany({ where: { articleId: id } })
      const uniqueTagIds = [...new Set(tagIds)]
      if (uniqueTagIds.length) {
        await db.articleTag.createMany({
          data: uniqueTagIds.map(tagId => ({ articleId: id, tagId })),
        })
      }
    }

    const article = await db.article.update({
      where: { id },
      data,
      include: articleFullInclude,
    })

    await logAction(user, 'UPDATE', 'Article', id, `Mise à jour de « ${article.title} »`)
    return NextResponse.json({ article: toFull(article) })
  } catch (e) {
    return serverError(e)
  }
}

// ─── DELETE ──
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    const { id } = await params

    const existing = await db.article.findUnique({ where: { id } })
    if (!existing) return notFound('Article introuvable')

    // Un JOURNALIST ne peut supprimer que SES articles non publiés
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) {
      if (existing.authorId !== user.id) {
        return forbidden('Vous ne pouvez supprimer que vos propres articles.')
      }
      if (!JOURNALIST_STATUSES.includes(existing.status)) {
        return forbidden('Un article publié ne peut être supprimé que par un responsable.')
      }
    }

    await db.article.delete({ where: { id } })
    await logAction(user, 'DELETE', 'Article', id, `Suppression de « ${existing.title} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
