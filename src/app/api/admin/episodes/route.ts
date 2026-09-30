// GET/POST /api/admin/episodes — épisodes audio (§7.6), filtre ?emissionId=
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction, parseDate } from '@/lib/server/helpers'
import { safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const sp = new URL(req.url).searchParams
    const emissionId = (sp.get('emissionId') || '').trim()

    const episodes = await db.episode.findMany({
      where: emissionId ? { emissionId } : {},
      orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
      include: { emission: { select: { id: true, title: true, coverImage: true } } },
    })
    return NextResponse.json({ episodes })
  } catch (e) {
    return serverError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const body = await req.json().catch(() => ({}))
    const emissionId = String(body?.emissionId ?? '').trim()
    const title = String(body?.title ?? '').trim()
    const audioUrl = safeMediaUrl(body?.audioUrl)

    if (!emissionId) return bad('L\'émission est obligatoire.')
    const emission = await db.emission.findUnique({ where: { id: emissionId } })
    if (!emission) return bad('Émission introuvable.')
    if (!title) return bad('Le titre de l\'épisode est obligatoire.')
    if (!audioUrl) return bad('Le fichier audio est obligatoire.')

    let articleId: string | null = null
    if (body?.articleId) {
      const article = await db.article.findUnique({ where: { id: String(body.articleId) } })
      if (!article) return bad('Article lié introuvable.')
      articleId = article.id
    }

    const episode = await db.episode.create({
      data: {
        emissionId,
        title,
        description: String(body?.description ?? ''),
        audioUrl,
        duration: parseInt(String(body?.duration ?? 0), 10) || 0,
        guests: String(body?.guests ?? ''),
        articleId,
        publishAt: parseDate(body?.publishAt),
        isPublished: Boolean(body?.isPublished ?? false),
      },
      include: { emission: { select: { id: true, title: true, coverImage: true } } },
    })

    await logAction(user, 'CREATE', 'Episode', episode.id, `Nouvel épisode « ${title} » (${emission.title})`)
    return NextResponse.json({ episode }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
