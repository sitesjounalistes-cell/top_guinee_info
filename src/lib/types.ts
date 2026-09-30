// Types partagés Topguinee.info — contrat entre API et UI

export type ArticleStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED'

export interface TgUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'CHIEF_EDITOR' | 'JOURNALIST'
  bio?: string | null
  avatarUrl?: string | null
  lastLoginAt?: string | null
  createdAt: string
}

export interface Rubrique {
  id: string
  name: string
  menuLabel?: string | null
  slug: string
  parentId?: string | null
  color: string
  icon: string
  imageUrl?: string | null
  order: number
  isActive: boolean
  children?: Rubrique[]
  parent?: Rubrique
  _count?: { articles: number }
}

export interface ArticleCardData {
  id: string
  title: string
  subtitle: string
  description: string
  slug: string
  coverImage?: string | null
  coverAlt: string
  status: ArticleStatus
  publishedAt?: string | null
  scheduledAt?: string | null
  views: number
  readTime: number
  youtubeUrl?: string | null
  featuredOrder?: number | null
  rubrique?: { id: string; name: string; slug: string; color: string } | null
  subRubrique?: { id: string; name: string; slug: string; color: string } | null
  author?: { id: string; name: string } | null
  tags?: { id: string; name: string; slug: string }[]
  _count?: { comments?: number }
}

export interface ArticleFull extends ArticleCardData {
  body: string
  createdAt: string
  updatedAt: string
  authorId: string
  rubriqueId: string
  subRubriqueId?: string | null
  media?: Media[]
}

export interface Media {
  id: string
  type: 'image' | 'video' | 'audio'
  url: string
  alt: string
  articleId?: string | null
  meta: string
  createdAt: string
}

export interface FlashInfo {
  id: string
  text: string
  articleId?: string | null
  priority: number // 1..3
  isActive: boolean
  publishAt: string
  expiresAt?: string | null
  article?: { slug: string; title: string } | null
}

export interface Emission {
  id: string
  title: string
  description: string
  coverImage?: string | null
  type: 'PODCAST' | 'CHRONIQUE' | 'FM'
  order: number
  isActive: boolean
  episodes?: Episode[]
}

export interface Episode {
  id: string
  emissionId: string
  title: string
  description: string
  audioUrl: string
  duration: number
  guests: string
  articleId?: string | null
  publishAt?: string | null
  isPublished: boolean
  listens: number
  emission?: { id: string; title: string; coverImage?: string | null }
  createdAt: string
}

export interface ContactChannel {
  id: string
  type: 'phone' | 'email' | 'whatsapp' | 'address' | 'other'
  label: string
  value: string
  order: number
  isActive: boolean
}

export interface SocialLink {
  id: string
  platform: string
  url: string
  order: number
  isActive: boolean
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  isRead: boolean
  isArchived: boolean
  receivedAt: string
}

export interface AdSlot {
  id: string
  name: string
  position: 'header' | 'footer' | 'sidebar' | 'in_article' | 'intercalaire' | 'habillage'
  format: string
  isActive: boolean
  campaigns?: AdCampaign[]
}

export interface AdCampaign {
  id: string
  slotId: string
  advertiserId?: string | null
  title: string
  imageUrl?: string | null
  linkUrl: string
  weight: number
  startDate: string
  endDate?: string | null
  impressions: number
  clicks: number
  isActive: boolean
  slot?: AdSlot
  advertiser?: { id: string; name: string } | null
}

export interface Advertiser {
  id: string
  name: string
  contact: string
  notes: string
  campaigns?: AdCampaign[]
}

export interface ActivityLogEntry {
  id: string
  userId?: string | null
  userLabel: string
  action: string
  entity: string
  entityId?: string | null
  detail: string
  createdAt: string
}

export interface SiteSettings {
  siteName: string
  slogan: string
  fmLabel: string
  logoUrl: string
  seoTitle: string
  seoDescription: string
  seoImage: string
  analyticsId: string
  maintenance: string // 'off' | 'on'
  fmEnabled: string   // 'off' | 'on' — section FM / Podcasts activable ou masquable
  tvEnabled: string   // 'off' | 'on' — rubrique TV (direct YouTube / Facebook)
  tvLabel: string
  tvYoutubeUrl: string  // direct ou vidéo YouTube embarquée (watch, live, youtu.be…)
  tvFacebookUrl: string // lien vidéo / direct Facebook (facebook.com/watch/live…)
}

// Résultat du test de connexion aux services de stockage externes (§7.10)
export interface StorageTestResult {
  cloudinary: { ok: boolean; message: string }
  drive: { ok: boolean; message: string }
}

export interface EditablePageData {
  key: string
  title: string
  content: string
  updatedAt: string
}

// ─── Réponses composées ──────────────────────────────────────────

export interface AdBannerData {
  id: string
  title: string
  imageUrl?: string | null
  linkUrl: string
  format: string
}

export interface HomeData {
  settings: SiteSettings
  rubriques: Rubrique[]
  flash: FlashInfo[]
  featured: { main: ArticleCardData | null; secondary: ArticleCardData[] }
  rubriqueBlocks: { rubrique: Rubrique; articles: ArticleCardData[] }[]
  mostRead: ArticleCardData[]
  latestEpisodes: Episode[]
  latestVideos: ArticleCardData[]
  ads: { header?: AdBannerData | null; footer?: AdBannerData | null; intercalaire?: AdBannerData | null; sidebar?: AdBannerData | null }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

export interface AdminOverview {
  cards: { articles: number; published: number; drafts: number; views: number; viewsWeek: number; messagesUnread: number; episodes: number; activeCampaigns: number; impressions: number; clicks: number }
  recentArticles: ArticleCardData[]
  recentMessages: ContactMessage[]
  recentLogs: ActivityLogEntry[]
  topArticles: ArticleCardData[]
}

export interface AdminStats {
  cards: { views: number; articles: number; avgReadTime: number; episodes: number; listens: number }
  timeline: { day: string; views: number }[]
  byRubrique: { name: string; color: string; views: number; count: number }[]
  byAuthor: { name: string; views: number; count: number }[]
  mediaMix: { name: string; value: number }[]
  topArticles: ArticleCardData[]
  bottomArticles: ArticleCardData[]
}
