// Proxy de sécurité (convention Next 16 — ex-« middleware ») — premier étage
// pour toutes les routes /api/*.
//
// 1. Anti-CSRF d'origine : un navigateur attache toujours l'en-tête Origin
//    aux requêtes mutatives (POST/PUT/PATCH/DELETE). Si Origin est présent
//    mais ne désigne pas notre propre hôte, la requête est rejetée — un
//    site tiers ne peut plus faire exécuter des actions en rideau via la
//    session d'un rédacteur connecté (complète SameSite=Lax). Les clients
//    sans Origin (curl, applications serveur) passent : l'authentification
//    reste le contrôle effectif.
// 2. Limite de débit globale par IP : premier étage généreux (le
//    rate-limiting fin reste au niveau de chaque route, en runtime Node).
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MUTATIVE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Rate-limit mémoire du middleware (par instance). */
const hits = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 300
const MAX_KEYS = 20_000

function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(key, arr)
    return true
  }
  arr.push(now)
  hits.set(key, arr)
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k)
  }
  return false
}

function ipOf(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean)
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^[0-9a-fA-F.:[\]]{3,45}$/.test(parts[i])) return parts[i]
    }
  }
  return 'local'
}

/** Origin de la requête désigne-t-elle l'hôte servi ? */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // client non-navigateur : pas d'indication, on laisse passer
  try {
    const originHost = new URL(origin).hostname.toLowerCase()
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0].toLowerCase()
    return Boolean(host) && originHost === host
  } catch {
    return false
  }
}

export function proxy(req: NextRequest) {
  // 1. Limite de débit globale (premier étage)
  if (rateLimited(`mw:${ipOf(req)}`)) {
    return NextResponse.json({ error: 'Trop de requêtes — réessayez dans un instant.' }, { status: 429 })
  }

  // 2. Anti-CSRF : Origin étrangère sur une requête mutative → refus
  if (MUTATIVE.has(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: 'Requête refusée (origine externe).' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
