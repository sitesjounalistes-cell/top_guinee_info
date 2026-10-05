// ─── Google Drive SANS API (aucune clé, aucun compte de service) ──────
//
// Objectif : permettre à la rédaction de coller un simple lien de partage
// Drive (« Tout le monde avec le lien ») pour diffuser un audio.
//
// 1. Streaming d'un FICHIER : l'endpoint public `uc?export=download`
//    renvoie le contenu pour les fichiers partagés publiquement (avec
//    `confirm=t` pour court-circuiter l'écran d'avertissement des gros
//    fichiers). Le serveur relaie le flux en suivant les redirections et
//    en transmettant l'en-tête Range → lecture progressive dans <audio>.
// 2. Listing d'un DOSSIER : `embeddedfolderview?id=…` retourne du HTML
//    statique public listant les fichiers (identifiant + nom). On y
//    prélève les fichiers audio pour l'import en épisodes.
//
// Limites assumées (contrepartie du « sans API ») : les fichiers doivent
// être partagés « Tout le monde avec le lien » ; Google peut changer ces
// endpoints non contractuels (on échoue proprement dans ce cas).

export interface PublicDriveStream {
  status: number
  contentType: string
  contentLength?: string
  contentRange?: string
  body: ReadableStream<Uint8Array>
}

/** Extrait l'identifiant d'un lien de FICHIER Drive (formats courants). */
export function driveFileIdOf(url: string): string {
  const patterns = [
    /drive\.google\.com\/file\/d\/([-\w]{10,})/,
    /drive\.google\.com\/(?:open|uc|u\/\d+\/uc)\?.*?[?&]id=([-\w]{10,})/,
    /drive\.google\.com\/open\?id=([-\w]{10,})/,
    /[?&]id=([-\w]{10,})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return ''
}

/** Extrait l'identifiant d'un lien de DOSSIER Drive (/folders/{id}). */
export function driveFolderIdOf(url: string): string {
  const m = url.match(/drive\.google\.com\/(?:drive\/)?folders\/([-\w]{10,})/)
  return m ? m[1] : ''
}

/** Clé de ressource (partages anciens modifiés) : `?resourcekey=…`. */
export function driveResourceKeyOf(url: string): string {
  const m = url.match(/[?&]resourcekey=([-\w]+)/)
  return m ? m[1] : ''
}

/** Lien Drive quelconque (fichier, dossier, uc, open…) ? */
export function isDriveLink(url: string): boolean {
  return /^(https?:)?\/\/(drive\.google\.com|docs\.google\.com)\//.test(url.trim())
}

// ─── Streaming public d'un fichier ─────────────────────────────────

/** URL de téléchargement public du fichier (avec resourcekey si fournie). */
function publicDownloadUrl(fileId: string, resourceKey?: string): string {
  let u = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`
  if (resourceKey) u += `&resourcekey=${encodeURIComponent(resourceKey)}`
  return u
}

/**
 * Diffuse un fichier Drive partagé publiquement, sans authentification.
 * Suit jusqu'à 3 redirections (uc → googleusercontent) en transmettant
 * Range. Retourne null si le fichier n'est pas publiquement accessible
 * (réponse HTML = écran de connexion/permission) ou introuvable.
 */
export async function publicDriveFileStream(
  fileId: string,
  range?: string | null,
  resourceKey?: string,
): Promise<PublicDriveStream | null> {
  if (!/^[-\w]{10,64}$/.test(fileId)) return null

  let url = publicDownloadUrl(fileId, resourceKey)
  for (let hop = 0; hop < 4; hop++) {
    const headers: Record<string, string> = {}
    if (range) headers.Range = range
    const res = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
      // aucun cookie ni identifiant transmis : contenu public uniquement
    })

    // Redirection → suivre (c'est le vrai flux sur googleusercontent)
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) return null
      url = new URL(loc, url).toString()
      continue
    }

    if (!res.ok || !res.body) return null

    // Page HTML = écran de permission/connexion → fichier non public
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.includes('text/html')) return null

    return {
      status: res.status,
      contentType: res.headers.get('content-type') || 'audio/mpeg',
      contentLength: res.headers.get('content-length') || undefined,
      contentRange: res.headers.get('content-range') || undefined,
      body: res.body,
    }
  }
  return null
}

// ─── Listing public d'un dossier ───────────────────────────────────

export interface DriveFolderEntry {
  fileId: string
  name: string
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma)$/i

/**
 * Liste les FICHIERS AUDIO d'un dossier Drive partagé publiquement
 * (« Tout le monde avec le lien »), via la vue embarquée statique.
 * Retourne null si le dossier n'est pas accessible publiquement.
 */
export async function listPublicDriveFolderAudios(
  folderId: string,
  resourceKey?: string,
  max = 50,
): Promise<DriveFolderEntry[] | null> {
  if (!/^[-\w]{10,64}$/.test(folderId)) return null

  let url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`
  if (resourceKey) url += `&resourcekey=${encodeURIComponent(resourceKey)}`

  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const html = await res.text()

  // Chaque fichier : <div class="flip-entry" id="FILE_ID"> …
  //                 <div class="flip-entry-title">Nom du fichier</div>
  const entries: DriveFolderEntry[] = []
  const re = /<div class="flip-entry" id="([-\w]{10,64})"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const name = decodeEntities(m[2]).trim()
    if (!AUDIO_EXT.test(name)) continue
    entries.push({ fileId: m[1], name })
    if (entries.length >= max) break
  }
  // Un dossier valide expose au moins une entrée quelconque ; zéro entrée
  // audio est un résultat légitime (dossier sans audio).
  if (entries.length === 0 && !/flip-entry/.test(html)) return null
  return entries
}

/** Entités HTML minimales des noms de fichiers Drive. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
}
