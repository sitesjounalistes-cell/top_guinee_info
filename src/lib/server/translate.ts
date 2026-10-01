// Traduction automatique du contenu éditorial (côté serveur).
// ─────────────────────────────────────────────────────────────────────
// Chaque segment traduit est mis en cache en base (TranslationCache) :
// un texte n'est traduit qu'une seule fois par langue.
//
// Providers :
// • Par défaut (aucune configuration) : MyMemory — gratuit, sans clé,
//   adapté au démarrage (quotas anonymes limités ; le cache les préserve).
// • Recommandé en production : renseigner TRANSLATE_API_URL et
//   TRANSLATE_API_KEY (serveur compatible LibreTranslate :
//   POST { q, source, target, api_key }) pour des volumes plus grands.
import crypto from 'crypto'
import { db } from '@/lib/db'
import { isLang, type LangCode } from '@/lib/i18n/dicts'

const SOURCE_LANG = 'fr'

// Disjoncteur : si le provider rate-limite (gros volumes), on arrête de le
// solliciter pendant 5 minutes — la page est servie en français plutôt que
// de faire attendre le visiteur plusieurs dizaines de secondes.
const breaker = { fails: 0, openUntil: 0 }
const BREAKER_THRESHOLD = 6
const BREAKER_COOLDOWN = 5 * 60 * 1000

function breakerOpen(): boolean {
  return Date.now() < breaker.openUntil
}

/** Budget temps par requête HTTP (ms) : au-delà, la réponse part avec ce
 *  qui est déjà traduit — jamais de page qui traîne. */
const TIME_BUDGET = 9_000
let deadline = 0
function outOfTime(): boolean {
  return Date.now() > deadline
}
function recordFail() {
  breaker.fails += 1
  if (breaker.fails >= BREAKER_THRESHOLD) {
    breaker.openUntil = Date.now() + BREAKER_COOLDOWN
    breaker.fails = 0
    console.warn('[translate] provider limité — traductions suspendues 5 min (cache conservé)')
  }
}
function recordSuccess() {
  breaker.fails = 0
}

/** Découpe un texte en morceaux ≤ max chars (sur les espaces). */
function chunkText(text: string, max = 420): string[] {
  if (text.length <= max) return [text]
  const out: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max)
    if (cut <= 0) cut = max
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\s+/, '')
  }
  if (rest) out.push(rest)
  return out
}

async function translateChunkMyMemory(text: string, target: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${SOURCE_LANG}|${target}${process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const json = await res.json().catch(() => null) as { responseData?: { translatedText?: string } } | null
  const out = json?.responseData?.translatedText
  if (!out || /^(NO QUERY|INVALID|QUERY LENGTH|MYMEMORY WARNING)/i.test(out)) return null
  return out
}

async function translateChunkLibre(text: string, target: string): Promise<string | null> {
  const res = await fetch(process.env.TRANSLATE_API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text, source: SOURCE_LANG, target, format: 'text',
      api_key: process.env.TRANSLATE_API_KEY || undefined,
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return null
  const json = await res.json().catch(() => null) as { translatedText?: string } | null
  return json?.translatedText || null
}

async function translateChunk(text: string, target: string): Promise<string | null> {
  if (process.env.TRANSLATE_API_URL) return translateChunkLibre(text, target)
  return translateChunkMyMemory(text, target)
}

function keyOf(lang: string, text: string): string {
  return crypto.createHash('sha256').update(`${lang}:${text}`).digest('hex')
}

/**
 * Traduit un lot de textes (retourne les originaux en cas d'échec —
 * dégradation gracieuse : le site reste lisible dans la langue source).
 */
export async function translateTexts(texts: string[], lang: string): Promise<string[]> {
  if (!isLang(lang) || lang === SOURCE_LANG || !texts.length) return texts
  deadline = Date.now() + TIME_BUDGET

  // 1. Cache en base
  const unique = [...new Set(texts.map(t => t).filter(t => t && t.trim()))]
  const keys = unique.map(t => keyOf(lang, t))
  const cached = new Map<string, string>()
  try {
    const rows = await db.translationCache.findMany({ where: { key: { in: keys }, lang } })
    for (const r of rows) cached.set(r.source, r.text)
  } catch { /* base indisponible : on traduit sans cache */ }

  const missing = breakerOpen() ? [] : unique.filter(t => !cached.has(t))
  if (missing.length) {
    // 2. Traduction des segments manquants — petits lots parallèles pour
    //    ne pas marteler le service (le cache absorbe les répétitions)
    const CONCURRENCY = 6
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      if (breakerOpen() || outOfTime()) break
      const batch = missing.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(async (text) => {
        try {
          const parts = chunkText(text)
          const translated: string[] = []
          for (const part of parts) {
            const out = await translateChunk(part, lang)
            if (out == null) return null
            translated.push(out)
          }
          return translated.join(' ')
        } catch {
          return null
        }
      }))
      const okCount = results.filter(r => r != null).length
      if (okCount > 0) recordSuccess()
      for (let f = 0; f < batch.length - okCount; f++) recordFail()
      for (let j = 0; j < batch.length; j++) {
        if (results[j] != null) cached.set(batch[j], results[j] as string)
      }
    }
    // 3. Écriture du cache (best effort, sans bloquer la réponse)
    const toStore = [...cached.entries()].filter(([src]) => missing.includes(src))
    if (toStore.length) {
      void (async () => {
        try {
          await db.translationCache.createMany({
            data: toStore.map(([source, text]) => ({ key: keyOf(lang, source), lang, source: source.slice(0, 2000), text: text.slice(0, 5000) })),
            skipDuplicates: true,
          })
        } catch { /* cache best effort */ }
      })()
    }
  }

  return texts.map(t => cached.get(t) ?? t)
}

/** Traduit un texte unique. */
export async function translateText(text: string, lang: string): Promise<string> {
  const [out] = await translateTexts([text], lang)
  return out ?? text
}

/**
 * Traduit du HTML en préservant les balises : seuls les segments de texte
 * sont traduits, les balises/attributs (déjà sanitizés en amont) restent
 * intacts. Le split avec groupe capturant place le texte aux indices pairs
 * et les balises aux impairs.
 */
export async function translateHtml(html: string, lang: string): Promise<string> {
  if (!isLang(lang) || lang === SOURCE_LANG || !html) return html
  const segments = html.split(/(<[^>]+>)/g)
  const textIdx: number[] = []
  const texts: string[] = []
  segments.forEach((s, i) => {
    if (i % 2 === 0 && s.trim()) {
      textIdx.push(i)
      texts.push(s)
    }
  })
  if (!texts.length) return html
  const translated = await translateTexts(texts, lang)
  textIdx.forEach((segIdx, j) => { segments[segIdx] = translated[j] })
  return segments.join('')
}

// ─── Application aux structures des API publiques ─────────────────

interface CardLike {
  title: string
  subtitle: string
  description: string
  rubrique?: { name: string } | null
  subRubrique?: { name: string } | null
  tags?: { name: string }[]
}

/** Traduit les champs texte d'une carte article (sur place). */
export async function translateCard<T extends CardLike>(card: T, lang: string): Promise<T> {
  if (lang === SOURCE_LANG) return card
  // Références indexées (l'ordre des traductions reste aligné)
  // Champs les plus visibles uniquement (titres, sur-titres) : limiter le
  // volume maintient la traduction rapide malgré les quotas du provider.
  const fields: { get(): string; set(v: string): void }[] = []
  if (card.title) fields.push({ get: () => card.title, set: v => { card.title = v } })
  if (card.subtitle) fields.push({ get: () => card.subtitle, set: v => { card.subtitle = v } })
  if (card.rubrique?.name) fields.push({ get: () => card.rubrique!.name, set: v => { card.rubrique!.name = v } })
  if (card.subRubrique?.name) fields.push({ get: () => card.subRubrique!.name, set: v => { card.subRubrique!.name = v } })
  if (!fields.length) return card
  const out = await translateTexts(fields.map(f => f.get()), lang)
  fields.forEach((f, i) => f.set(out[i] ?? f.get()))
  return card
}

/** Traduit les cartes d'une liste (parallèle). */
export async function translateCards<T extends CardLike>(cards: T[], lang: string): Promise<T[]> {
  if (lang === SOURCE_LANG || !cards.length) return cards
  await Promise.all(cards.map(c => translateCard(c, lang)))
  return cards
}

/** Langue demandée par un client (?lang=xx) — 'fr' si absente/invalide. */
export function langOf(url: string): string {
  const lang = new URL(url).searchParams.get('lang') || ''
  return isLang(lang) ? lang : 'fr'
}
