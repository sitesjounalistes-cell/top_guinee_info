// PUT/DELETE /api/admin/socials/[id]
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction } from '@/lib/server/helpers'
import { safeHttpUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.socialLink.findUnique({ where: { id } })
    if (!existing) return notFound('Lien social introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.platform !== undefined) {
      const platform = String(body.platform).trim()
      if (!platform) return bad('La plateforme est obligatoire.')
      data.platform = platform
    }
    if (body?.url !== undefined) {
      const url = safeHttpUrl(body.url)
      if (!url) return bad('L\'URL est obligatoire.')
      data.url = url
    }
    if (body?.order !== undefined) data.order = parseInt(String(body.order), 10) || 0
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const social = await db.socialLink.update({ where: { id }, data })
    await logAction(user, 'UPDATE', 'SocialLink', id, `Mise à jour du lien « ${social.platform} »`)
    return NextResponse.json({ social })
  } catch (e) {
    return serverError(e)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const { id } = await params

    const existing = await db.socialLink.findUnique({ where: { id } })
    if (!existing) return notFound('Lien social introuvable')

    await db.socialLink.delete({ where: { id } })
    await logAction(user, 'DELETE', 'SocialLink', id, `Suppression du lien « ${existing.platform} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
