// GET/POST /api/admin/rubriques — arborescence des rubriques (§7.4)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction, uniqueSlugIn } from '@/lib/server/helpers'
import { safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()

    const rubriques = await db.rubrique.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { articles: true } } },
    })
    return NextResponse.json({ rubriques })
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
    const name = String(body?.name ?? '').trim()
    if (!name) return bad('Le nom de la rubrique est obligatoire.')
    if (name.length > 80) return bad('Le nom est trop long (80 caractères maximum).')

    let parentId: string | null = null
    if (body?.parentId) {
      const parent = await db.rubrique.findUnique({ where: { id: String(body.parentId) } })
      if (!parent) return bad('Rubrique parente introuvable.')
      parentId = parent.id
    }

    const slug = await uniqueSlugIn(db.rubrique, body?.slug ? String(body.slug) : name)

    const rubrique = await db.rubrique.create({
      data: {
        name,
        menuLabel: body?.menuLabel ? String(body.menuLabel) : null,
        slug,
        parentId,
        color: body?.color ? String(body.color) : '#D21034',
        icon: body?.icon ? String(body.icon) : 'newspaper',
        imageUrl: body?.imageUrl ? safeMediaUrl(body.imageUrl) || null : null,
        order: Number.isFinite(parseInt(String(body?.order ?? 0), 10)) ? parseInt(String(body?.order ?? 0), 10) : 0,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
    })

    await logAction(user, 'CREATE', 'Rubrique', rubrique.id, `Création de la rubrique « ${name} »`)
    return NextResponse.json({ rubrique }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
