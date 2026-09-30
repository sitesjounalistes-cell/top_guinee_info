// POST /api/public/episodes/listen — incrémente le compteur d'écoutes d'un épisode
// Tolère l'absence d'episodeId (no-op) pour ne jamais perturber le lecteur audio.
// Anti-fraude : limite de débit par IP + une seule écoute comptée par épisode
// et par IP sur une fenêtre glissante.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError, rateLimit, oncePerWindow, clientIp } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const DEDUP_WINDOW_MS = 30 * 60 * 1000 // 1 écoute / épisode / IP / 30 min

export async function POST(req: Request) {
  try {
    const ip = clientIp(req)
    if (!rateLimit(`listen:${ip}`, 60, 60_000)) return NextResponse.json({ ok: true })
    if (!oncePerWindow(`listen:${ip}`, DEDUP_WINDOW_MS)) return NextResponse.json({ ok: true })

    const body = await req.json().catch(() => ({}))
    const episodeId = String(body?.episodeId ?? '').trim()
    if (episodeId) {
      if (!oncePerWindow(`listen:${ip}:${episodeId}`, DEDUP_WINDOW_MS)) {
        return NextResponse.json({ ok: true })
      }
      await db.episode.update({
        where: { id: episodeId },
        data: { listens: { increment: 1 } },
      }).catch(() => null) // épisode absent → 200 silencieux
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
