// Client API typé Topguinee.info — toutes les communications front ↔ back
import { currentLang } from '@/lib/i18n'
import type {
  ArticleCardData, ArticleFull, Paginated, HomeData, FlashInfo, Emission, Episode,
  Rubrique, SiteSettings, ContactChannel, SocialLink, ContactMessage, AdSlot,
  AdCampaign, Advertiser, ActivityLogEntry, AdminOverview, AdminStats,
  EditablePageData, TgUser, AdBannerData, StorageTestResult,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────────

/** Erreur API avec statut HTTP — permet de distinguer 401/403/429/500. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Émis quand une requête authentifiée reçoit 401 (session expirée). */
export const UNAUTHORIZED_EVENT = 'tg:unauthorized'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // i18n : les API publiques reçoivent la langue du visiteur — le serveur
  // traduit les contenus éditoriaux (cache en base) ; l'interface, elle,
  // est traduite côté client via les dictionnaires.
  let target = url
  if (url.startsWith('/api/public/') && !url.includes('lang=')) {
    const lang = currentLang()
    if (lang && lang !== 'fr') target += `${url.includes('?') ? '&' : '?'}lang=${lang}`
  }
  const res = await fetch(target, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Session expirée pendant le travail : l'application bascule vers le
    // login (hors écran de connexion lui-même, où 401 = mauvais identifiants).
    if (res.status === 401 && !url.includes('/api/admin/auth/login')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
    throw new ApiError((data as { error?: string }).error || `Erreur ${res.status}`, res.status)
  }
  return data as T
}

function qs(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export interface UploadResult {
  url: string
  provider?: 'cloudinary' | 'drive' | 'local'
  warning?: string | null
}

export async function uploadFile(file: File, type: 'image' | 'audio' | 'video'): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', type)
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Échec de l\'envoi')
  return data as UploadResult
}

// ─── Public ───────────────────────────────────────────────────────

export const publicApi = {
  home: () => request<HomeData>('/api/public/home'),
  flash: () => request<{ flash: FlashInfo[] }>('/api/public/flash'),
  settings: () => request<{ settings: SiteSettings; contacts: ContactChannel[]; socials: SocialLink[] }>('/api/public/settings'),
  emissions: () => request<{ emissions: Emission[]; fmLabel: string }>('/api/public/emissions'),
  page: (key: string) => request<{ page: EditablePageData }>(`/api/public/page/${key}`),
  articles: (params: { rubrique?: string; sub?: string; q?: string; tag?: string; page?: number; limit?: number; hasVideo?: string; sort?: string }) =>
    request<Paginated<ArticleCardData>>(`/api/public/articles${qs(params)}`),
  article: (slug: string) => request<{ article: ArticleFull; similar: ArticleCardData[] }>(`/api/public/articles/${slug}`),
  contact: (body: { name: string; email: string; subject: string; message: string; honeypot?: string }) =>
    request<{ ok: boolean }>('/api/public/contact', { method: 'POST', body: JSON.stringify(body) }),
  adClick: (campaignId: string) => request<{ ok: boolean }>(`/api/public/ads/${campaignId}/click`, { method: 'POST' }),
}

// ─── Admin ────────────────────────────────────────────────────────

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ user: TgUser }>('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>('/api/admin/auth/logout', { method: 'POST' }),
  me: () => request<{ user: TgUser }>('/api/admin/auth/me'),

  overview: () => request<AdminOverview>('/api/admin/overview'),
  stats: (period: string) => request<AdminStats>(`/api/admin/stats?period=${period}`),
  logs: (params: { type?: string; userId?: string } = {}) =>
    request<{ logs: ActivityLogEntry[] }>(`/api/admin/logs${qs(params)}`),

  articles: (params: { q?: string; status?: string; rubriqueId?: string; page?: number; limit?: number } = {}) =>
    request<Paginated<ArticleCardData>>(`/api/admin/articles${qs(params)}`),
  article: (id: string) => request<{ article: ArticleFull }>(`/api/admin/articles/${id}`),
  createArticle: (body: Record<string, unknown>) =>
    request<{ article: ArticleFull }>('/api/admin/articles', { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (id: string, body: Record<string, unknown>) =>
    request<{ article: ArticleFull }>(`/api/admin/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteArticle: (id: string) => request<{ ok: boolean }>(`/api/admin/articles/${id}`, { method: 'DELETE' }),
  duplicateArticle: (id: string) =>
    request<{ article: ArticleFull }>(`/api/admin/articles/${id}/duplicate`, { method: 'POST' }),

  featured: () => request<{ main: ArticleCardData | null; secondary: ArticleCardData[]; candidates: ArticleCardData[] }>('/api/admin/featured'),
  setFeatured: (mainId: string | null, secondaryIds: string[]) =>
    request<{ ok: boolean }>('/api/admin/featured', { method: 'PUT', body: JSON.stringify({ mainId, secondaryIds }) }),

  rubriques: () => request<{ rubriques: Rubrique[] }>('/api/admin/rubriques'),
  createRubrique: (body: Record<string, unknown>) => request<{ rubrique: Rubrique }>('/api/admin/rubriques', { method: 'POST', body: JSON.stringify(body) }),
  updateRubrique: (id: string, body: Record<string, unknown>) => request<{ rubrique: Rubrique }>(`/api/admin/rubriques/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRubrique: (id: string) => request<{ ok: boolean }>(`/api/admin/rubriques/${id}`, { method: 'DELETE' }),

  flash: () => request<{ flash: FlashInfo[] }>('/api/admin/flash'),
  createFlash: (body: Record<string, unknown>) => request<{ flash: FlashInfo }>('/api/admin/flash', { method: 'POST', body: JSON.stringify(body) }),
  updateFlash: (id: string, body: Record<string, unknown>) => request<{ flash: FlashInfo }>(`/api/admin/flash/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFlash: (id: string) => request<{ ok: boolean }>(`/api/admin/flash/${id}`, { method: 'DELETE' }),

  emissions: () => request<{ emissions: Emission[] }>('/api/admin/emissions'),
  createEmission: (body: Record<string, unknown>) => request<{ emission: Emission }>('/api/admin/emissions', { method: 'POST', body: JSON.stringify(body) }),
  updateEmission: (id: string, body: Record<string, unknown>) => request<{ emission: Emission }>(`/api/admin/emissions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEmission: (id: string) => request<{ ok: boolean }>(`/api/admin/emissions/${id}`, { method: 'DELETE' }),

  episodes: (emissionId?: string) => request<{ episodes: Episode[] }>(`/api/admin/episodes${qs({ emissionId })}`),
  createEpisode: (body: Record<string, unknown>) => request<{ episode: Episode }>('/api/admin/episodes', { method: 'POST', body: JSON.stringify(body) }),
  updateEpisode: (id: string, body: Record<string, unknown>) => request<{ episode: Episode }>(`/api/admin/episodes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEpisode: (id: string) => request<{ ok: boolean }>(`/api/admin/episodes/${id}`, { method: 'DELETE' }),
  importDriveFolder: (body: { emissionId: string; folderUrl: string; isPublished: boolean }) =>
    request<{ created: number; skipped: number; episodes: { id: string; title: string }[] }>('/api/admin/episodes/drive-import', { method: 'POST', body: JSON.stringify(body) }),

  contacts: () => request<{ contacts: ContactChannel[] }>('/api/admin/contacts'),
  createContact: (body: Record<string, unknown>) => request<{ contact: ContactChannel }>('/api/admin/contacts', { method: 'POST', body: JSON.stringify(body) }),
  updateContact: (id: string, body: Record<string, unknown>) => request<{ contact: ContactChannel }>(`/api/admin/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteContact: (id: string) => request<{ ok: boolean }>(`/api/admin/contacts/${id}`, { method: 'DELETE' }),

  socials: () => request<{ socials: SocialLink[] }>('/api/admin/socials'),
  createSocial: (body: Record<string, unknown>) => request<{ social: SocialLink }>('/api/admin/socials', { method: 'POST', body: JSON.stringify(body) }),
  updateSocial: (id: string, body: Record<string, unknown>) => request<{ social: SocialLink }>(`/api/admin/socials/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSocial: (id: string) => request<{ ok: boolean }>(`/api/admin/socials/${id}`, { method: 'DELETE' }),

  messages: (params: { status?: string; q?: string } = {}) =>
    request<{ messages: ContactMessage[] }>(`/api/admin/messages${qs(params)}`),
  updateMessage: (id: string, body: { isRead?: boolean; isArchived?: boolean }) =>
    request<{ message: ContactMessage }>(`/api/admin/messages/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMessage: (id: string) => request<{ ok: boolean }>(`/api/admin/messages/${id}`, { method: 'DELETE' }),

  slots: () => request<{ slots: AdSlot[] }>('/api/admin/ads/slots'),
  updateSlot: (id: string, body: { isActive?: boolean; name?: string }) =>
    request<{ slot: AdSlot }>(`/api/admin/ads/slots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  campaigns: () => request<{ campaigns: AdCampaign[] }>('/api/admin/ads/campaigns'),
  createCampaign: (body: Record<string, unknown>) => request<{ campaign: AdCampaign }>('/api/admin/ads/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  updateCampaign: (id: string, body: Record<string, unknown>) => request<{ campaign: AdCampaign }>(`/api/admin/ads/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCampaign: (id: string) => request<{ ok: boolean }>(`/api/admin/ads/campaigns/${id}`, { method: 'DELETE' }),
  advertisers: () => request<{ advertisers: Advertiser[] }>('/api/admin/ads/advertisers'),
  createAdvertiser: (body: Record<string, unknown>) => request<{ advertiser: Advertiser }>('/api/admin/ads/advertisers', { method: 'POST', body: JSON.stringify(body) }),

  settings: () => request<{ settings: SiteSettings; pages: EditablePageData[] }>('/api/admin/settings'),
  updateSettings: (body: Partial<SiteSettings> & Record<string, unknown>) => request<{ settings: SiteSettings }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) }),
  updatePage: (key: string, body: { title: string; content: string }) =>
    request<{ page: EditablePageData }>(`/api/admin/settings/pages/${key}`, { method: 'PUT', body: JSON.stringify(body) }),
  testStorage: () => request<StorageTestResult>('/api/admin/storage/test', { method: 'POST' }),
}

// ─── Utilitaires UI ───────────────────────────────────────────────

export function pickBanner(campaigns: AdCampaign[], format?: string): AdBannerData | null {
  const now = Date.now()
  const active = campaigns.filter(c =>
    c.isActive && c.imageUrl &&
    new Date(c.startDate).getTime() <= now &&
    (!c.endDate || new Date(c.endDate).getTime() >= now)
  )
  if (!active.length) return null
  const pool: AdCampaign[] = []
  for (const c of active) for (let i = 0; i < Math.max(1, c.weight); i++) pool.push(c)
  const picked = pool[Math.floor(Math.random() * pool.length)]
  return { id: picked.id, title: picked.title, imageUrl: picked.imageUrl, linkUrl: picked.linkUrl, format: format || picked.slot?.format || '' }
}

export const fmt = {
  date(d?: string | Date | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  },
  dateTime(d?: string | Date | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' à ' + new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  },
  short(d?: string | Date | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  },
  num(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M'
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' k'
    return String(n)
  },
  duration(sec: number) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  },
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 90)
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', REVIEW: 'En relecture', PUBLISHED: 'Publié',
  UNPUBLISHED: 'Dépublié', ARCHIVED: 'Archivé',
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  REVIEW: 'bg-tg-yellow/20 text-yellow-800 border-tg-yellow/50',
  PUBLISHED: 'bg-tg-green/15 text-tg-green-dark border-tg-green/40',
  UNPUBLISHED: 'bg-orange-100 text-orange-700 border-orange-200',
  ARCHIVED: 'bg-zinc-100 text-zinc-400 border-zinc-200',
}
