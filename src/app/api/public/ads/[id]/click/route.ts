// POST /api/public/ads/[id]/click — incrémente les clics d'une campagne (§7.9)
// Réponse OK même si la campagne n'existe plus (suivi d'audience non bloquant).
// Anti-fraude : limite de débit par IP + un seul clic compté par campagne
// et par IP sur une fenêtre glissante (facturation publicitaire fiable).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError, rateLimit, oncePerWindow, clientIp } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const DEDUP_WINDOW_MS = 15 * 60 * 1000 // 1 clic / campagne / IP / 15 min

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ip = clientIp(req)
    if (!rateLimit(`adclk:${ip}`, 60, 60_000)) return NextResponse.json({ ok: true })
    if (!oncePerWindow(`adclk:${ip}:${id}`, DEDUP_WINDOW_MS)) return NextResponse.json({ ok: true })

    await db.adCampaign.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    }).catch(() => null) // campagne absente → 200 silencieux
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
