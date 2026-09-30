// Sanitisation HTML par liste blanche — défense XSS centrale du projet.
// Utilisable côté SERVEUR (sauvegarde + rendu API) et côté CLIENT (rendu,
// éditeur) : sanitize-html fonctionne dans les deux environnements.
//
// Principe : on ne tente PAS de « filtrer le mauvais » (liste noire
// contournable) — on ne garde QUE le bon (balises, attributs et schémas
// explicitement autorisés). Tout le reste est supprimé.
import sanitizeHtml from 'sanitize-html'

// ─── Configuration éditoriale ─────────────────────────────────────

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's',
    'blockquote', 'q', 'cite', 'ul', 'ol', 'li', 'a', 'img', 'figure',
    'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'iframe', 'span', 'div', 'small', 'sup', 'sub', 'mark', 'code', 'pre',
    'audio', 'source',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    audio: ['controls', 'preload'],
    source: ['src', 'type'],
    '*': [], // aucun attribut global (pas de style, pas de class, pas de handlers)
  },
  // Schémas autorisés — javascript:, data:, vbscript:… sont rejetés par sanitize-html
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], audio: ['http', 'https'], source: ['http', 'https'] },
  allowProtocolRelative: false,
  // URL relatives autorisées (images uploadées : /uploads/…)
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // Iframes : uniquement YouTube (embed) — tout autre domaine est retiré
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'],
  allowIframeRelativeUrls: false,
  // <style>, <script>, event handlers… exclus par défaut (absents de allowedTags)
  allowVulnerableTags: false,
  transformTags: {
    // Les liens externes s'ouvrent sans contexte de la page (pas de reverse tabnabbing)
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  nestingLimit: 50,
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'option'],
}

/** Nettoie du HTML riche (corps d'article, page éditable). Idempotent. */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  return sanitizeHtml(html, RICH_TEXT_OPTIONS)
}

// ─── Validation d'URLs (champs administrables) ────────────────────

/**
 * Retourne l'URL si elle est sûre (http/https absolue), sinon ''.
 * Bloque javascript:, data:, vbscript:, les pseudo-protocoles et les URLs malformées.
 */
export function safeHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.trim()
  if (!s || s.length > 2048) return ''
  try {
    const u = new URL(s)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
  } catch {
    /* URL invalide */
  }
  return ''
}

/**
 * Comme safeHttpUrl, mais accepte aussi un chemin relatif du site
 * (/uploads/…, /api/public/…) pour les médias issus de l'upload local.
 */
export function safeMediaUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.trim()
  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') && s.length <= 2048) return s
  return safeHttpUrl(s)
}
