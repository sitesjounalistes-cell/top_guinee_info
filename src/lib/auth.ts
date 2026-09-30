// Authentification & sécurité côté serveur (§7.2, §9.6)
// Sessions signées HMAC + hash scrypt — zéro dépendance externe.
// IMPORTANT : module serveur uniquement (utilisé dans /api/admin/*)
import crypto from 'crypto'

// ─── Secret de signature ──────────────────────────────────────────
// AUTH_SECRET est OBLIGATOIRE en production : sans lui, quiconque lit le
// code source pourrait forger un cookie de session valide (usurpation de
// n'importe quel compte). En dev uniquement, un secret éphémère est toléré
// (les sessions sont alors invalidées à chaque redémarrage).
let cachedSecret: string | null = null
let ephemeralSecret: string | null = null

function getSecret(): string {
  if (cachedSecret) return cachedSecret
  const env = (process.env.AUTH_SECRET || '').trim()
  if (env) {
    if (env.length < 32) {
      throw new Error('[auth] AUTH_SECRET est défini mais trop court : 32 caractères minimum sont requis.')
    }
    cachedSecret = env
    return cachedSecret
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] AUTH_SECRET manquant : définissez une variable d\'environnement AUTH_SECRET '
      + '(chaîne aléatoire d\'au moins 32 caractères, ex. `openssl rand -hex 32`) puis redémarrez. '
      + 'Refus de signer des sessions avec un secret connu du code source.',
    )
  }
  // Développement : secret éphémère + avertissement visible
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex')
    console.warn(
      '[auth] AUTH_SECRET non défini : utilisation d\'un secret éphémère pour cette session de développement '
      + '(les connexions seront perdues à chaque redémarrage). Définissez AUTH_SECRET dans .env pour la production.',
    )
  }
  return ephemeralSecret
}

export const SESSION_COOKIE = 'tg_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 h — expiration automatique (§7.2)

// ─── Mots de passe (scrypt salé) ──────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${key}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, key] = stored.split(':')
    if (scheme !== 'scrypt' || !salt || !key) return false
    const computed = crypto.scryptSync(password, salt, 32)
    const expected = Buffer.from(key, 'hex')
    return computed.length === expected.length && crypto.timingSafeEqual(computed, expected)
  } catch {
    return false
  }
}

// ─── Jetons de session signés ─────────────────────────────────────

interface SessionPayload { uid: string; role: string; exp: number }

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

export function signSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (!payload.uid || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ─── Cookies ──────────────────────────────────────────────────────

/** La requête arrive-t-elle chiffrée (HTTPS direct ou via proxy) ? */
function requestIsHttps(req: Request): boolean {
  const xfp = req.headers.get('x-forwarded-proto')
  if (xfp) return xfp.split(',')[0].trim().toLowerCase() === 'https'
  try {
    return new URL(req.url).protocol === 'https:'
  } catch {
    return false
  }
}

export function sessionCookieHeader(token: string, req?: Request): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    // Flag Secure dès que la connexion est chiffrée — jamais en HTTP clair
    // (sinon le cookie serait silencieusement ignoré par le navigateur).
    ...(req && requestIsHttps(req) ? ['Secure'] : []),
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  return parts.join('; ')
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`))
  const token = match ? match.slice(SESSION_COOKIE.length + 1) : null
  return verifySessionToken(token)
}

// ─── Verrouillage anti force-brute (§7.2, §9.6) ───────────────────

interface Attempt { fails: number; lockedUntil: number }
const attempts = new Map<string, Attempt>()
const MAX_FAILS = 5
const LOCK_MS = 10 * 60 * 1000

export function isLocked(email: string): { locked: boolean; remainingSec: number } {
  const a = attempts.get(email.toLowerCase())
  if (!a) return { locked: false, remainingSec: 0 }
  if (a.lockedUntil > Date.now()) {
    return { locked: true, remainingSec: Math.ceil((a.lockedUntil - Date.now()) / 1000) }
  }
  return { locked: false, remainingSec: 0 }
}

export function recordFailure(email: string) {
  const key = email.toLowerCase()
  const a = attempts.get(key) || { fails: 0, lockedUntil: 0 }
  a.fails += 1
  if (a.fails >= MAX_FAILS) {
    a.lockedUntil = Date.now() + LOCK_MS
    a.fails = 0
  }
  attempts.set(key, a)
}

export function recordSuccess(email: string) {
  attempts.delete(email.toLowerCase())
}

// ─── Rôles & garde de routes admin (§7.1) ────────────────────────

export type Role = 'ADMIN' | 'CHIEF_EDITOR' | 'JOURNALIST'
export type MinRole = Exclude<Role, 'JOURNALIST'>

const ROLE_RANK: Record<string, number> = { JOURNALIST: 1, CHIEF_EDITOR: 2, ADMIN: 3 }

/**
 * Hiérarchie des rôles :
 *  • JOURNALIST    — rédige SES articles (brouillon/relecture), uploads, lecture des stats
 *  • CHIEF_EDITOR  — gère tout le contenu (publication, une, rubriques, pubs, messages…)
 *  • ADMIN         — tout, y compris les paramètres du site et les secrets de stockage
 */
export function hasMinRole(role: string | null | undefined, min: MinRole): boolean {
  const r = ROLE_RANK[role || ''] || 0
  return r >= ROLE_RANK[min]
}

export async function requireUser(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return null
  const { db } = await import('@/lib/db')
  const user = await db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  if (!user || !user.isActive) return null
  return user
}
