// GET/POST /api/admin/socials — liens réseaux sociaux (§7.3)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction } from '@/lib/server/helpers'
import { safeHttpUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

const PLATFORMS = ['facebook', 'x', 'instagram', 'tiktok', 'youtube', 'threads', 'telegram', 'other']

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')
    const socials = await db.socialLink.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ socials })
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
    const platform = String(body?.platform ?? '').trim()
    const url = safeHttpUrl(body?.url)

    if (!PLATFORMS.includes(platform)) return bad('Plateforme invalide (facebook, x, instagram, tiktok, youtube, threads, telegram, other).')
    if (!url) return bad('L\'URL du réseau social est obligatoire.')

    const social = await db.socialLink.create({
      data: {
        platform,
        url,
        order: parseInt(String(body?.order ?? 0), 10) || 0,
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
    })

    await logAction(user, 'CREATE', 'SocialLink', social.id, `Nouveau lien social « ${platform} »`)
    return NextResponse.json({ social }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
