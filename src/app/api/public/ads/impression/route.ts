// POST /api/public/ads/impression — incrémente les impressions d'une campagne
// Appelé par le front à l'affichage effectif de la bannière.
// Anti-fraude : limite de débit par IP + une seule impression comptée par
// campagne et par IP sur une fenêtre glissante (les réponses restent OK
// pour ne jamais perturber l'affichage).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError, rateLimit, oncePerWindow, clientIp } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const DEDUP_WINDOW_MS = 15 * 60 * 1000 // 1 impression / campagne / IP / 15 min

export async function POST(req: Request) {
  try {
    const ip = clientIp(req)
    if (!rateLimit(`adimp:${ip}`, 60, 60_000)) return NextResponse.json({ ok: true })
    if (!oncePerWindow(`adimp:${ip}`, DEDUP_WINDOW_MS)) return NextResponse.json({ ok: true })

    const body = await req.json().catch(() => ({}))
    const campaignId = String(body?.campaignId ?? '').trim()
    if (campaignId) {
      if (!oncePerWindow(`adimp:${ip}:${campaignId}`, DEDUP_WINDOW_MS)) {
        return NextResponse.json({ ok: true })
      }
      await db.adCampaign.update({
        where: { id: campaignId },
        data: { impressions: { increment: 1 } },
      }).catch(() => null) // campagne absente → 200 silencieux
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
