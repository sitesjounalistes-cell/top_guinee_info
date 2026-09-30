// POST /api/admin/auth/logout — efface le cookie de session
import { NextResponse } from 'next/server'
import { clearSessionCookieHeader } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', clearSessionCookieHeader())
  return res
}
