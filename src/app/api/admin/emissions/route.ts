// GET/POST /api/admin/emissions — émissions FM / podcasts (§7.6)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction } from '@/lib/server/helpers'
import { safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

const TYPES = ['PODCAST', 'CHRONIQUE', 'FM']

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const emissions = await db.emission.findMany({
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      include: {
        episodes: {
          orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
          include: { emission: { select: { id: true, title: true, coverImage: true } } },
        },
      },
    })
    return NextResponse.json({ emissions })
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
    const title = String(body?.title ?? '').trim()
    if (!title) return bad('Le titre de l\'émission est obligatoire.')

    const type = TYPES.includes(body?.type) ? body.type : 'PODCAST'

    const emission = await db.emission.create({
      data: {
        title,
        description: String(body?.description ?? ''),
        coverImage: body?.coverImage ? safeMediaUrl(body.coverImage) || null : null,
        type,
        order: parseInt(String(body?.order ?? 0), 10) || 0,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
    })

    await logAction(user, 'CREATE', 'Emission', emission.id, `Création de l'émission « ${title} »`)
    return NextResponse.json({ emission }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
