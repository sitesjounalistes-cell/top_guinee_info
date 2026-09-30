// PUT /api/admin/settings/pages/[key] — édition des pages libres (about, legal, privacy)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction } from '@/lib/server/helpers'
import { sanitizeRichText } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = ['about', 'legal', 'privacy']

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { key } = await params

    if (!ALLOWED_KEYS.includes(key)) {
      return bad('Clé de page invalide (about, legal, privacy).', 404)
    }

    const body = await req.json().catch(() => ({}))
    const title = String(body?.title ?? '').trim()
    // Contenu HTML éditable : nettoyé par liste blanche avant stockage (anti-XSS stocké)
    const content = sanitizeRichText(String(body?.content ?? ''))

    if (!title) return bad('Le titre de la page est obligatoire.')

    const page = await db.editablePage.upsert({
      where: { key },
      create: { key, title, content },
      update: { title, content },
    })

    await logAction(user, 'UPDATE', 'EditablePage', key, `Mise à jour de la page « ${title} »`)
    return NextResponse.json({
      page: {
        key: page.key,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
