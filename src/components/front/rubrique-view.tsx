'use client'
// Vue Rubrique — §4.4, refonte « premium éditorial » : en-tête de presse
// (losange de rubrique + titre serif), filet signature, chips de
// sous-rubriques scrollables, article vedette pleine largeur, grille 4
// colonnes, section « Les plus lus » numérotée + encart publicitaire.
// Logique, contrats API et props inchangés.

import { useMemo } from 'react'
import { Link, navigate } from '@/lib/router'
import { publicApi, fmt } from '@/lib/api'
import type { Rubrique } from '@/lib/types'
import { ArticleCard, Breadcrumb, Pagination, SectionHeader } from '@/components/tg/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Eye } from 'lucide-react'
import {
  CardSkeleton, EmptyState, ErrorState, ImpressionBanner, RubriqueIcon,
  flattenRubriques, getHomeCached, useAsyncData,
} from './common'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' },
  { value: 'views', label: 'Plus lus' },
]

const RANK_COLORS = ['#D21034', '#c99700', '#00734B', '#14213D', '#a80c28']

function rubriqueHref(slug: string, opts: { sub?: string; page?: number; sort?: string }) {
  const p = new URLSearchParams()
  if (opts.sub) p.set('sub', opts.sub)
  if (opts.sort && opts.sort !== 'recent') p.set('sort', opts.sort)
  if (opts.page && opts.page > 1) p.set('page', String(opts.page))
  const s = p.toString()
  return `/rubrique/${slug}${s ? `?${s}` : ''}`
}

// Luminance approximative : texte blanc sur la couleur, sauf si trop claire
function readableOn(hex?: string | null): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#ffffff'
  const v = m[1]
  const lum =
    (0.299 * parseInt(v.slice(0, 2), 16) +
      0.587 * parseInt(v.slice(2, 4), 16) +
      0.114 * parseInt(v.slice(4, 6), 16)) / 255
  return lum > 0.62 ? '#14213D' : '#ffffff'
}

// Couleur trop claire pour porter du blanc → repli navy (contraste AA)
function isTooLight(hex?: string | null): boolean {
  return readableOn(hex) === '#14213D'
}

// Nom de la rubrique parente (rubrique consultée = sous-rubrique ?)
function parentNameOf(rubriques: Rubrique[] | undefined | null, slug: string): string | null {
  for (const root of rubriques || []) {
    if ((root.children || []).some((c) => c.slug === slug)) return root.name
  }
  return null
}

// ─── Chip de filtre (sous-rubrique) ───────────────────────────────────

function FilterChip({ to, active, activeColor, children }: {
  to: string; active: boolean; activeColor?: string; children: React.ReactNode
}) {
  const navyFallback = !activeColor || isTooLight(activeColor)
  // Link (routeur) n'accepte pas `style` → fond dynamique porté par un span
  return (
    <span
      className="inline-flex shrink-0 rounded-full"
      style={active && !navyFallback ? { backgroundColor: activeColor } : undefined}
    >
      <Link
        to={to}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 h-11 px-4 rounded-full border text-[12.5px] font-semibold whitespace-nowrap transition-colors duration-300',
          active
            ? navyFallback ? 'bg-tg-navy border-tg-navy text-white' : 'border-transparent text-white'
            : 'bg-white border-zinc-300 text-zinc-600 hover:border-tg-navy hover:text-tg-navy',
        )}
      >
        {children}
      </Link>
    </span>
  )
}

export function RubriqueView({ slug, sub, page, sort }: { slug: string; sub?: string; page: number; sort: string }) {
  // Métadonnées de rubrique + sous-rubriques + pubs (cache partagé)
  const { data: home } = useAsyncData(getHomeCached, 'home')
  const rubrique = useMemo(
    () => flattenRubriques(home?.rubriques).find((r) => r.slug === slug) || null,
    [home, slug],
  )
  const subs = useMemo(
    () => (rubrique?.children || []).filter((c) => c.isActive).sort((a, b) => a.order - b.order),
    [rubrique],
  )
  const subName = sub ? flattenRubriques(home?.rubriques).find((r) => r.slug === sub)?.name : null
  const parentName = useMemo(() => parentNameOf(home?.rubriques, slug), [home, slug])

  const key = [slug, sub || '', page, sort].join('|')
  const { data, loading, error, reload } = useAsyncData(
    () => publicApi.articles({ rubrique: slug, sub, page, sort, limit: 9 }),
    key,
  )
  const { data: most } = useAsyncData(() => publicApi.articles({ sort: 'views', limit: 5 }), 'most-read')

  const title = rubrique?.name || decodeURIComponent(slug).replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  const items = data?.items || []
  const color = rubrique?.color || '#D21034'
  const countLabel = data
    ? `${fmt.num(data.total)} article${data.total > 1 ? 's' : ''}`
    : 'Toute l\'actualité en continu'

  return (
    <div className="tg-container py-6 md:py-9">
      <Breadcrumb
        items={[
          { label: 'Accueil', to: '/' },
          { label: title, to: sub ? `/rubrique/${slug}` : undefined },
          ...(sub ? [{ label: subName || sub }] : []),
        ]}
      />

      {/* ── En-tête de rubrique (presse) ─────────────────────────── */}
      <header className="mt-5 md:mt-7 tg-fade-up">
        <div className="flex items-start gap-4 md:gap-5">
          <span className="relative w-10 h-10 md:w-11 md:h-11 shrink-0 mt-1" aria-hidden>
            <span className="absolute inset-0 rotate-45 rounded-[3px]" style={{ backgroundColor: color }} />
            <span className="absolute inset-0 flex items-center justify-center" style={{ color: readableOn(color) }}>
              <RubriqueIcon icon={rubrique?.icon} size={16} />
            </span>
          </span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-[28px] md:text-[36px] tracking-tight text-tg-navy leading-[1.1]">
              {title}
            </h1>
            <p className="mt-2.5 tg-kicker text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{countLabel}</span>
              {parentName && (
                <span className="flex items-center gap-3">
                  <span className="w-1 h-1 rotate-45 bg-zinc-300" aria-hidden />
                  dans {parentName}
                </span>
              )}
              {subName && (
                <span className="flex items-center gap-3">
                  <span className="w-1 h-1 rotate-45 bg-zinc-300" aria-hidden />
                  Sous-rubrique : {subName}
                </span>
              )}
            </p>
          </div>
        </div>
        {/* Filet signature : trait fin pleine largeur + accent 80px couleur rubrique */}
        <div className="relative mt-5 md:mt-6 border-b border-zinc-200" aria-hidden>
          <span className="absolute left-0 -bottom-px h-[2px] w-20" style={{ backgroundColor: color }} />
        </div>
      </header>

      {/* ── Filtres : sous-rubriques + tri ───────────────────────── */}
      <div
        className="mt-5 md:mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 tg-fade-up tg-fade-1"
        role="group"
        aria-label="Filtrer par sous-rubrique et trier"
      >
        {subs.length > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto tg-scroll [scrollbar-width:thin] pb-1.5 -mb-1.5">
            <FilterChip to={rubriqueHref(slug, { sort })} active={!sub}>
              Tout
            </FilterChip>
            {subs.map((s: Rubrique) => (
              <FilterChip
                key={s.id}
                to={rubriqueHref(slug, { sub: s.slug, sort })}
                active={sub === s.slug}
                activeColor={s.color}
              >
                <RubriqueIcon icon={s.icon} size={13} style={sub === s.slug ? undefined : { color: s.color }} />
                {s.name}
              </FilterChip>
            ))}
          </div>
        )}
        <div className={cn('shrink-0', subs.length === 0 && 'ml-auto')}>
          <Select value={sort} onValueChange={(v) => navigate(rubriqueHref(slug, { sub, sort: v }))}>
            <SelectTrigger
              className="w-[176px] h-10 rounded-sm border-zinc-300 bg-white text-[13px] hover:border-tg-navy data-[state=open]:border-tg-navy"
              aria-label="Trier les articles"
            >
              <SelectValue placeholder="Trier" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Articles ─────────────────────────────────────────────── */}
      <div className="mt-7 md:mt-9 min-w-0">
        {loading ? (
          <RubriqueSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Eye size={22} aria-hidden />}
            title={sub ? `Aucun article dans « ${subName || sub} »` : `Aucun article dans « ${title} »`}
            description="Cette rubrique attend encore ses premiers articles. Revenez bientôt — la rédaction travaille dessus !"
          >
            {sub && (
              <Link to={rubriqueHref(slug, { sort })} className="mt-5 text-sm font-semibold text-tg-red hover:text-tg-red-dark transition-colors">
                ← Voir toute la rubrique
              </Link>
            )}
          </EmptyState>
        ) : (
          <div className="tg-fade-up tg-fade-2">
            {/* Article vedette pleine largeur */}
            <ArticleCard article={items[0]} variant="large" />
            {items.length > 1 && (
              <div className="mt-8 md:mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
                {items.slice(1).map((a) => (
                  <ArticleCard key={a.id} article={a} variant="medium" />
                ))}
              </div>
            )}
            <Pagination
              page={data?.page || 1}
              pages={data?.pages || 1}
              makeHref={(p) => rubriqueHref(slug, { sub, sort, page: p })}
            />
          </div>
        )}
      </div>

      {/* ── Les plus lus + publicité latérale ────────────────────── */}
      {(most?.items?.length || home?.ads?.sidebar) ? (
        <section
          className="mt-12 md:mt-16 pt-10 md:pt-12 border-t border-zinc-200 grid lg:grid-cols-3 gap-8 lg:gap-10 tg-fade-up"
          aria-label="Les articles les plus lus"
        >
          <div className="lg:col-span-2 min-w-0">
            {most?.items?.length ? (
              <>
                <SectionHeader
                  title="Les plus lus"
                  rubrique={null}
                  action={<span className="tg-kicker text-tg-red shrink-0">Top 5</span>}
                />
                <ol>
                  {most.items.slice(0, 5).map((a, i) => (
                    <li key={a.id} className="flex items-center gap-4 md:gap-5 py-5 border-b border-zinc-200 last:border-b-0 first:pt-2">
                      <span
                        className="font-display font-bold text-[44px] md:text-[52px] leading-none w-10 md:w-12 text-center shrink-0 select-none"
                        style={{ color: RANK_COLORS[i % RANK_COLORS.length] }}
                        aria-label={`Classé ${i + 1}`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <ArticleCard article={a} variant="horizontal" />
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
          {home?.ads?.sidebar && (
            <aside className="hidden lg:block lg:col-start-3" aria-label="Publicité">
              <ImpressionBanner banner={home.ads.sidebar} position="sidebar" />
            </aside>
          )}
        </section>
      ) : null}
    </div>
  )
}

// Squelette premium : vedette + grille 4 colonnes
function RubriqueSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement des articles">
      <Skeleton className="aspect-[16/9] w-full rounded-sm" />
      <div className="mt-5 max-w-2xl space-y-2.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
