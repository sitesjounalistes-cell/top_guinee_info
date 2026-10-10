// Origine RÉELLE du site telle que servie (vercel.app, domaine final,
// local…). Déduite des en-têtes de la requête — utilisée par tout ce qui
// doit exposer des URLs absolues au monde extérieur : Open Graph (aperçu
// de partage WhatsApp/Facebook/LinkedIn), JSON-LD, sitemap, canonical.
// Pointer sur un domaine non déployé donnerait des aperçus vides et un
// sitemap injoignable. Repli : NEXT_PUBLIC_SITE_URL.
import { headers } from 'next/headers'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://topguineeinfo.vercel.app'

export async function siteOrigin(): Promise<string> {
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    if (host && !/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
      const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
      return `${proto}://${host}`
    }
    if (host) return `http://${host}`
  } catch { /* hors contexte requête */ }
  return SITE_URL
}

/** URL absolue fidèle à l'origine réelle (les crawlers ne lisent pas les relatives). */
export function absolutize(url: string | undefined | null, origin: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}
