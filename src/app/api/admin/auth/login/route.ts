// POST /api/admin/auth/login — connexion au cockpit (§7.2, §9.6)
// Session signée HMAC (cookie tg_session 12 h), verrouillage après 5 échecs / 10 min.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  verifyPassword, isLocked, recordFailure, recordSuccess,
  signSession, sessionCookieHeader,
} from '@/lib/auth'
import { logAction, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Veuillez renseigner votre e-mail et votre mot de passe.' }, { status: 400 })
    }

    // Verrouillage anti force-brute
    const lock = isLocked(email)
    if (lock.locked) {
      const min = Math.max(1, Math.ceil(lock.remainingSec / 60))
      return NextResponse.json(
        { error: `Compte verrouillé temporairement — réessayez dans ${min} min` },
        { status: 423 },
      )
    }

    const user = await db.user.findUnique({ where: { email } })

    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailure(email)
      const nowLocked = isLocked(email)
      return NextResponse.json(
        { error: nowLocked.locked
          ? `Compte verrouillé temporairement — réessayez dans ${Math.max(1, Math.ceil(nowLocked.remainingSec / 60))} min`
          : 'Identifiants incorrects' },
        { status: 401 },
      )
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Compte désactivé. Contactez un administrateur.' }, { status: 403 })
    }

    recordSuccess(email)
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await logAction({ id: user.id, name: user.name }, 'LOGIN', 'User', user.id, `Connexion de ${user.name}`)

    const exp = Date.now() + 12 * 60 * 60 * 1000
    const token = signSession({ uid: user.id, role: user.role, exp })

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      lastLoginAt: new Date().toISOString(),
      createdAt: user.createdAt.toISOString(),
    }

    const res = NextResponse.json({ user: safeUser })
    res.headers.set('Set-Cookie', sessionCookieHeader(token))
    return res
  } catch (e) {
    return serverError(e)
  }
}
