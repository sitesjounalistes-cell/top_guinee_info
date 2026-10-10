// GET/POST /api/admin/ads/campaigns — campagnes publicitaires (§7.9, §8)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, serverError, logAction, parseDate } from '@/lib/server/helpers'
import { safeHttpUrl, safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

/**
 * Lien de redirection fidèle : un lien saisi sans schéma (« www.exemple.com »)
 * est complété en https:// AVANT validation — le clic publicitaire honore
 * toujours la cible fournie par la rédaction.
 */
function normalizeLinkUrl(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return safeHttpUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`)
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const campaigns = await db.adCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        slot: true,
        advertiser: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ campaigns })
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
    const slotId = String(body?.slotId ?? '').trim()
    const title = String(body?.title ?? '').trim()

    if (!slotId) return bad('L\'emplacement est obligatoire.')
    const slot = await db.adSlot.findUnique({ where: { id: slotId } })
    if (!slot) return bad('Emplacement introuvable.')
    if (!title) return bad('Le titre de la campagne est obligatoire.')

    let advertiserId: string | null = null
    if (body?.advertiserId) {
      const advertiser = await db.advertiser.findUnique({ where: { id: String(body.advertiserId) } })
      if (!advertiser) return bad('Annonceur introuvable.')
      advertiserId = advertiser.id
    }

    const campaign = await db.adCampaign.create({
      data: {
        slotId,
        advertiserId,
        title,
        imageUrl: body?.imageUrl ? safeMediaUrl(body.imageUrl) || null : null,
        // Cible de la bannière rendue cliquable sur le site public : http(s) obligatoire
        linkUrl: normalizeLinkUrl(body?.linkUrl),
        weight: Math.max(1, parseInt(String(body?.weight ?? 1), 10) || 1),
        startDate: parseDate(body?.startDate) ?? new Date(),
        endDate: parseDate(body?.endDate),
        isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
      },
      include: {
        slot: true,
        advertiser: { select: { id: true, name: true } },
      },
    })

    await logAction(user, 'CREATE', 'AdCampaign', campaign.id, `Nouvelle campagne « ${title} » (${slot.position})`)
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (e) {
    return serverError(e)
  }
}
