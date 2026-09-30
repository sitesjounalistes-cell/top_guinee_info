'use client'
// Utilitaires partagés du front-office Topguinee.info (agent 2-b)
// — hook de chargement idempotent (StrictMode-safe), bannière avec impression,
//   icônes de rubriques, squelettes de chargement, état d'erreur, cache home.

import { useCallback, useEffect, useRef, useState } from 'react'
import { publicApi } from '@/lib/api'
import type { AdBannerData, HomeData, Rubrique } from '@/lib/types'
import { AdBanner } from '@/components/tg/shared'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Landmark, TrendingUp, Users, Trophy, Music, Globe, Scale, Vote, Pickaxe, Goal,
  Newspaper, Radio, Star, Flame, Zap, BookOpen, Camera, Video, Mic, Leaf,
  Briefcase, Shield, GraduationCap, Plane, Heart, RefreshCw, WifiOff,
  type LucideIcon,
} from 'lucide-react'

// ─── Cache module : une seule requête home partagée (header + vues) ──

let homeCache: Promise<HomeData> | null = null

export function getHomeCached(): Promise<HomeData> {
  if (!homeCache) {
    homeCache = publicApi.home().catch((e) => {
      homeCache = null // permet un nouvel essai au prochain montage
      throw e
    })
  }
  return homeCache
}

// ─── Hook de chargement async idempotent (anti double-fetch StrictMode) ──
// L'état de chargement est DÉRIVÉ (state.key !== clé courante) : aucun
// setState synchrone dans l'effet, donc compatible React Compiler.

export function useAsyncData<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({
    key: '', data: null, error: null,
  })
  const [tick, setTick] = useState(0)
  const inflightRef = useRef<{ key: string; promise: Promise<T> } | null>(null)
  const cacheKey = `${key}#${tick}`

  useEffect(() => {
    let alive = true
    let p: Promise<T>
    const cached = inflightRef.current
    if (cached && cached.key === cacheKey) {
      p = cached.promise // réutilise la requête en cours (double invocation StrictMode)
    } else {
      p = Promise.resolve().then(loader)
      inflightRef.current = { key: cacheKey, promise: p }
      p.catch(() => {
        if (inflightRef.current?.key === cacheKey) inflightRef.current = null
      })
    }
    p.then(
      (d) => { if (alive) setState({ key: cacheKey, data: d, error: null }) },
      (e) => { if (alive) setState({ key: cacheKey, data: null, error: e?.message || 'Erreur de chargement' }) },
    )
    return () => { alive = false }
  }, [cacheKey])

  const loading = state.key !== cacheKey
  const error = state.key === cacheKey ? state.error : null
  const data = state.key === cacheKey ? state.data : null
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

// ─── Bannière publicitaire avec comptage d'impression (une seule fois) ──

export function ImpressionBanner({ banner, position, className }: {
  banner?: AdBannerData | null; position: string; className?: string
}) {
  const sentRef = useRef<string | null>(null)
  useEffect(() => {
    if (!banner?.id || sentRef.current === banner.id) return
    sentRef.current = banner.id
    fetch('/api/public/ads/impression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: banner.id }),
    }).catch(() => {})
  }, [banner?.id])
  return <AdBanner banner={banner} position={position} className={className} />
}

// ─── Icônes de rubriques (nom lucide stocké en base) ─────────────────

const RUBRIQUE_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  'trending-up': TrendingUp,
  users: Users,
  trophy: Trophy,
  music: Music,
  globe: Globe,
  scale: Scale,
  vote: Vote,
  pickaxe: Pickaxe,
  goal: Goal,
  radio: Radio,
  newspaper: Newspaper,
  star: Star,
  flame: Flame,
  zap: Zap,
  book: BookOpen,
  camera: Camera,
  video: Video,
  mic: Mic,
  heart: Heart,
  leaf: Leaf,
  briefcase: Briefcase,
  shield: Shield,
  'graduation-cap': GraduationCap,
  graduation: GraduationCap,
  plane: Plane,
}

export function RubriqueIcon({ icon, size = 14, className, style }: { icon?: string | null; size?: number; className?: string; style?: React.CSSProperties }) {
  const Icon = RUBRIQUE_ICONS[(icon || '').toLowerCase()] || Newspaper
  return <Icon size={size} className={cn('shrink-0', className)} style={style} aria-hidden />
}

// ─── Helpers rubriques ───────────────────────────────────────────────

export function flattenRubriques(list: Rubrique[] | undefined | null): Rubrique[] {
  const out: Rubrique[] = []
  for (const r of list || []) {
    out.push(r)
    if (r.children?.length) out.push(...r.children)
  }
  return out
}

export function useRubriques(): Rubrique[] {
  const { data } = useAsyncData(getHomeCached, 'home')
  return data?.rubriques || []
}

// URL absolue d'un article pour le partage — vraie page canonique (SEO)
export function shareUrl(slug: string) {
  if (typeof window === 'undefined') return `/article/${slug}`
  return `${window.location.origin}/article/${slug}`
}

// ─── États de chargement (squelettes) ────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)} aria-hidden>
      <Skeleton className="aspect-[3/2] w-full rounded-sm" />
      <div className="pt-4 space-y-2.5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-2.5 w-24 mt-1" />
      </div>
    </div>
  )
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-4', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}

export function LinesSkeleton({ lines = 5, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i % 3 === 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="w-[104px] aspect-[3/2] md:w-[140px] rounded-sm shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── État d'erreur avec bouton « Réessayer » ─────────────────────────

export function ErrorState({ message, onRetry, compact }: { message?: string; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center rounded-sm border border-dashed border-zinc-300 bg-tg-paper',
      compact ? 'p-6' : 'p-10 md:p-14',
    )} role="alert">
      <span className="w-12 h-12 rounded-full border border-tg-red/25 bg-tg-red/5 text-tg-red flex items-center justify-center">
        <WifiOff size={20} aria-hidden />
      </span>
      <p className="mt-4 font-display text-lg font-bold text-tg-navy">Oups, connexion interrompue</p>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md leading-relaxed">
        {message || 'Impossible de charger ce contenu. Vérifiez votre connexion internet puis réessayez.'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-6 bg-tg-red hover:bg-tg-red-dark text-white gap-2 min-h-[44px] rounded-sm px-6 font-semibold">
          <RefreshCw size={15} aria-hidden /> Réessayer
        </Button>
      )}
    </div>
  )
}

// ─── État vide élégant ────────────────────────────────────────────────

export function EmptyState({ icon, title, description, children }: {
  icon?: React.ReactNode; title: string; description?: string; children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-sm border border-dashed border-zinc-300 bg-tg-paper p-10 md:p-12">
      {icon && <span className="w-12 h-12 rounded-full border border-tg-navy/15 bg-tg-navy/5 text-tg-navy flex items-center justify-center">{icon}</span>}
      <p className="mt-4 font-display text-lg font-bold text-tg-navy">{title}</p>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>}
      {children}
    </div>
  )
}
