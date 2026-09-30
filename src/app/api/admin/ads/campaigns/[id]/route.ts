// PUT/DELETE /api/admin/ads/campaigns/[id]
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, bad, notFound, serverError, logAction, parseDate } from '@/lib/server/helpers'
import { safeHttpUrl, safeMediaUrl } from '@/lib/sanitize'

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

    const existing = await db.adCampaign.findUnique({ where: { id } })
    if (!existing) return notFound('Campagne introuvable')

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body?.slotId !== undefined) {
      const slot = await db.adSlot.findUnique({ where: { id: String(body.slotId) } })
      if (!slot) return bad('Emplacement introuvable.')
      data.slotId = slot.id
    }
    if (body?.advertiserId !== undefined) {
      if (!body.advertiserId) {
        data.advertiserId = null
      } else {
        const advertiser = await db.advertiser.findUnique({ where: { id: String(body.advertiserId) } })
        if (!advertiser) return bad('Annonceur introuvable.')
        data.advertiserId = advertiser.id
      }
    }
    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (!title) return bad('Le titre de la campagne est obligatoire.')
      data.title = title
    }
    if (body?.imageUrl !== undefined) data.imageUrl = body.imageUrl ? safeMediaUrl(body.imageUrl) || null : null
    if (body?.linkUrl !== undefined) data.linkUrl = safeHttpUrl(body.linkUrl)
    if (body?.weight !== undefined) data.weight = Math.max(1, parseInt(String(body.weight), 10) || 1)
    if (body?.startDate !== undefined) data.startDate = parseDate(body.startDate) ?? new Date()
    if (body?.endDate !== undefined) data.endDate = parseDate(body.endDate)
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive)

    const campaign = await db.adCampaign.update({
      where: { id },
      data,
      include: {
        slot: true,
        advertiser: { select: { id: true, name: true } },
      },
    })
    await logAction(user, 'UPDATE', 'AdCampaign', id, `Mise à jour de la campagne « ${campaign.title} »`)
    return NextResponse.json({ campaign })
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

    const existing = await db.adCampaign.findUnique({ where: { id } })
    if (!existing) return notFound('Campagne introuvable')

    await db.adCampaign.delete({ where: { id } })
    await logAction(user, 'DELETE', 'AdCampaign', id, `Suppression de la campagne « ${existing.title} »`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
