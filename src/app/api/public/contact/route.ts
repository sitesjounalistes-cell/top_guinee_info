// POST /api/public/contact — formulaire de contact (§7.3)
// Validation + anti-spam (honeypot) + limite de débit (3 messages / 5 min / IP)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, clientIp, isEmail, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 5 * 60 * 1000
const MAX_PER_WINDOW = 3

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    const message = String(body?.message ?? '').trim()
    const honeypot = String(body?.honeypot ?? '')

    // Honeypot rempli → robot : on répond OK sans rien enregistrer
    if (honeypot) return NextResponse.json({ ok: true })

    // Validation
    if (name.length < 2) {
      return NextResponse.json({ error: 'Veuillez indiquer votre nom (2 caractères minimum).' }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 })
    }
    if (subject.length < 2) {
      return NextResponse.json({ error: 'Veuillez préciser l\'objet de votre message.' }, { status: 400 })
    }
    if (message.length < 10) {
      return NextResponse.json({ error: 'Votre message est trop court (10 caractères minimum).' }, { status: 400 })
    }
    if (name.length > 120 || subject.length > 200 || message.length > 5000 || email.length > 200) {
      return NextResponse.json({ error: 'Message trop long.' }, { status: 400 })
    }

    // Limite de débit simple en mémoire
    const ip = clientIp(req)
    if (!rateLimit(`contact:${ip}`, MAX_PER_WINDOW, WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Trop de messages envoyés. Merci de réessayer dans quelques minutes.' },
        { status: 429 },
      )
    }

    await db.contactMessage.create({
      data: { name, email, subject, message },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return serverError(e)
  }
}
