// GET /api/admin/auth/me — utilisateur connecté ou 401
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { unauth, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return unauth()
    const user = await db.user.findUnique({
      where: { id: session.uid },
      select: {
        id: true, name: true, email: true, role: true,
        bio: true, avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
    })
    if (!user || !user.isActive) return unauth()
    return NextResponse.json({ user })
  } catch (e) {
    return serverError(e)
  }
}
