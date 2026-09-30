'use client'
// Vue Article — §4.6 — refonte « premium éditorial » (Task 4-b)
// Progression de lecture tricolore, en-tête de presse (kicker rubrique, H1
// serif, chapo italique, méta auteur à pastille), couverture 16/9 zoomée,
// colonne de lecture 720px avec lettrine, pub in-article, sujets liés,
// sidebar sticky (pub, à lire aussi, les plus lus), grille similaire.
//
// NOTE (tâche 8 — SEO) : les articles sont désormais servis par la vraie
// page serveur src/app/article/[slug]/page.tsx (SSR, métadonnées
// dynamiques, JSON-LD). Ce composant n'est plus monté par le routeur —
// conservé comme référence d'implémentation client (hydratation complète,
// barre de progression) si l'on souhaite réactiver un rendu hybride.
// Il n'est importé nulle part : absent du bundle de production.

import { useEffect, useState } from 'react'
import { Link } from '@/lib/router'
import { publicApi, fmt } from '@/lib/api'
import type { Rubrique } from '@/lib/types'
import {
  ArticleCard, Breadcrumb, FadeImage, RichText, SectionHeader, ShareButtons, YouTubeEmbed,
} from '@/components/tg/shared'
import {
  ErrorState, ImpressionBanner, getHomeCached, shareUrl, useAsyncData,
} from './common'
import { NotFoundView } from './not-found-view'
import { ArrowRight, Clock, Eye } from 'lucide-react'

// Conteneur éditorial de l'article (en-tête, couverture, corps + sidebar)
const SHELL = 'max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8'

// Couleurs des rangs « Les plus lus » (rouge, or, vert, marine, grenat)
const RANK_COLORS = ['#D21034', '#c99700', '#00734B', '#14213D', '#a80c28']

export function ArticleView({ slug }: { slug: string }) {
  const { data, loading, error, reload } = useAsyncData(() => publicApi.article(slug), slug)
  const { data: home } = useAsyncData(getHomeCached, 'home')
  const { data: most } = useAsyncData(() => publicApi.articles({ sort: 'views', limit: 5 }), 'most-read')
  const [progress, setProgress] = useState(0)

  // Barre de progression de lecture (§4.11)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Titre du document
  useEffect(() => {
    if (data?.article) {
      document.title = `${data.article.title} — ${home?.settings?.siteName || 'Topguinee.info'}`
    }
  }, [data, home])

  if (loading) return <ArticleSkeleton />
  if (error || !data?.article) {
    return error ? (
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <ErrorState message="Impossible de charger cet article. Vérifiez votre connexion puis réessayez." onRetry={reload} />
      </div>
    ) : (
      <NotFoundView />
    )
  }

  const { article } = data
  const similar = data.similar || []
  const rub = article.rubrique
  const rubColor = rub?.color || '#D21034'
  const authorName = article.author?.name || 'Rédaction Topguinee'
  const initial = (authorName.charAt(0) || 'T').toUpperCase()
  const similarGrid = similar.slice(0, 4)

  return (
    <div>
      {/* Progression de lecture — filet tricolore 2px */}
      <div
        className="tg-read-progress"
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progression de lecture"
      />

      <article>
        {/* ── En-tête de presse ───────────────────────────────────── */}
        <header className={`${SHELL} pt-5 md:pt-8 tg-fade-up`}>
          <Breadcrumb
            items={[
              { label: 'Accueil', to: '/' },
              ...(rub ? [{ label: rub.name, to: `/rubrique/${rub.slug}` }] : []),
              { label: article.title.length > 46 ? `${article.title.slice(0, 46)}…` : article.title },
            ]}
          />

          <div className="mt-6 md:mt-8 max-w-[860px]">
            {rub && (
              <Link
                to={`/rubrique/${rub.slug}`}
                className="inline-flex items-center py-1.5 transition-opacity duration-300 hover:opacity-70"
                ariaLabel={`Rubrique ${rub.name}`}
              >
                <span className="tg-kicker inline-flex items-center gap-2" style={{ color: rubColor }}>
                  <span className="h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: rubColor }} aria-hidden />
                  {rub.name}
                </span>
              </Link>
            )}
            <h1 className="mt-3 font-display font-bold text-[30px] md:text-[40px] leading-[1.12] tracking-tight text-tg-navy text-balance">
              {article.title}
            </h1>
            {article.subtitle && (
              <p className="mt-4 font-display italic text-lg md:text-xl text-zinc-500 leading-relaxed text-pretty">
                {article.subtitle}
              </p>
            )}
          </div>

          {/* Méta auteur + partage */}
          <div className="mt-7 md:mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-zinc-200 pb-5 md:pb-6">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-tg-navy font-display text-[15px] font-bold text-white"
              >
                {initial}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-zinc-500">
                <span className="font-semibold text-tg-navy">{authorName}</span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span>{fmt.dateTime(article.publishedAt)}</span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} aria-hidden className="text-zinc-400" /> {article.readTime} min de lecture
                </span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={13} aria-hidden className="text-zinc-400" /> {fmt.num(article.views)} vues
                </span>
              </div>
            </div>
            <div className="ml-auto shrink-0">
              <ShareButtons url={shareUrl(article.slug)} title={article.title} />
            </div>
          </div>
        </header>

        {/* ── Couverture ──────────────────────────────────────────── */}
        <figure className={`${SHELL} tg-fade-up tg-fade-1 mt-7 md:mt-10`}>
          <div className="group relative aspect-[16/9] overflow-hidden rounded-sm border border-zinc-200 bg-tg-gray">
            <FadeImage
              src={article.coverImage}
              alt={article.coverAlt || article.title}
              fill
              sizes="(max-width:1024px) 100vw, 1100px"
              priority
              className="tg-zoom absolute inset-0"
            />
          </div>
          {article.coverAlt && article.coverAlt !== article.title && (
            <figcaption className="mt-2.5 text-center text-xs italic text-zinc-400">{article.coverAlt}</figcaption>
          )}
        </figure>

        {/* Vidéo YouTube */}
        {article.youtubeUrl && (
          <div className={`${SHELL} mt-6`}>
            <YouTubeEmbed url={article.youtubeUrl} title={article.title} />
          </div>
        )}

        {/* ── Corps + sidebar ─────────────────────────────────────── */}
        <div className={`${SHELL} tg-fade-up tg-fade-2 mt-9 md:mt-12`}>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
            {/* Colonne de lecture */}
            <div className="min-w-0">
              <div className="max-w-[720px] mx-auto lg:mx-0">
                <RichText html={article.body} className="tg-dropcap" />

                {/* Encart pub in-article (intercalaire) */}
                {home?.ads?.intercalaire && (
                  <div className="my-10 flex justify-center">
                    <ImpressionBanner banner={home.ads.intercalaire} position="intercalaire" className="w-full" />
                  </div>
                )}

                {/* Sujets liés */}
                {article.tags && article.tags.length > 0 && (
                  <div className="border-t border-zinc-200 pt-7" aria-label="Sujets liés">
                    <p className="tg-kicker flex items-center gap-2 text-zinc-400">
                      <span className="h-1.5 w-1.5 rotate-45 bg-tg-navy/60" aria-hidden />
                      Sujets liés
                    </p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {article.tags.map((t) => (
                        <Link
                          key={t.id}
                          to={`/recherche?q=${encodeURIComponent(t.name)}`}
                          className="inline-flex items-center rounded-sm border border-zinc-300 px-3 py-1.5 text-[12px] font-medium uppercase tracking-wide text-tg-navy transition-colors duration-300 hover:border-tg-red hover:text-tg-red"
                        >
                          #{t.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar sticky */}
            <aside className="mt-12 lg:mt-0 space-y-9 lg:sticky lg:top-24 lg:self-start" aria-label="Suggestions de lecture">
              {home?.ads?.sidebar && <ImpressionBanner banner={home.ads.sidebar} position="sidebar" />}

              {similar.length > 0 && (
                <section aria-label="À lire aussi">
                  <h2 className="flex items-center gap-2.5 border-b border-zinc-200 pb-3 font-display text-[18px] font-bold tracking-tight text-tg-navy">
                    <span className="h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: rubColor }} aria-hidden />
                    À lire aussi
                  </h2>
                  <div className="divide-y divide-zinc-200">
                    {similar.slice(0, 3).map((a) => (
                      <div key={a.id} className="py-4 first:pt-4 last:pb-0">
                        <ArticleCard article={a} variant="horizontal" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {most?.items && most.items.length > 0 && (
                <section aria-label="Les articles les plus lus">
                  <h2 className="flex items-center gap-2.5 border-b border-zinc-200 pb-3 font-display text-[18px] font-bold tracking-tight text-tg-navy">
                    <span className="h-2 w-2 shrink-0 rotate-45 bg-tg-red" aria-hidden />
                    Les plus lus
                  </h2>
                  <ol className="divide-y divide-zinc-200">
                    {most.items.slice(0, 5).map((a, i) => (
                      <li key={a.id} className="flex items-start gap-2.5 py-3.5 first:pt-4 last:pb-0">
                        <span
                          aria-hidden
                          className="w-5 shrink-0 pt-0.5 select-none text-center font-display text-[20px] font-bold leading-none"
                          style={{ color: RANK_COLORS[i % RANK_COLORS.length] }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ArticleCard article={a} variant="small" />
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </aside>
          </div>
        </div>
      </article>

      {/* ── À lire aussi — bas de page ────────────────────────────── */}
      {similarGrid.length > 0 && (
        <section className="mt-14 md:mt-20 bg-tg-paper" aria-label="Articles similaires">
          <div className="tg-tricolor-band" aria-hidden><i /></div>
          <div className={`${SHELL} tg-fade-up py-12 md:py-16`}>
            <SectionHeader
              title="À lire aussi"
              rubrique={rub ? ({ ...rub, icon: '', order: 0, isActive: true } as Rubrique) : null}
              action={
                rub ? (
                  <Link
                    to={`/rubrique/${rub.slug}`}
                    className="group/link inline-flex items-center gap-1.5 tg-kicker text-tg-red hover:text-tg-red-dark transition-colors py-1"
                  >
                    Toute la rubrique
                    <ArrowRight size={13} aria-hidden className="transition-transform duration-300 group-hover/link:translate-x-1" />
                  </Link>
                ) : undefined
              }
            />
            <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {similarGrid.map((a) => (
                <ArticleCard key={a.id} article={a} variant="medium" />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Squelette premium de la page article ───────────────────────────

function ArticleSkeleton() {
  const lines = ['w-full', 'w-11/12', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-full', 'w-1/2']
  return (
    <div className={`${SHELL} py-6 md:py-10`} aria-busy="true" aria-label="Chargement de l'article">
      <div className="h-3 w-52 animate-pulse rounded-sm bg-zinc-100" />
      <div className="mt-8 max-w-[860px] space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-zinc-100" />
        <div className="h-10 w-full animate-pulse rounded-sm bg-zinc-100" />
        <div className="h-10 w-4/5 animate-pulse rounded-sm bg-zinc-100" />
        <div className="mt-2 h-4 w-3/5 animate-pulse rounded-sm bg-zinc-100" />
      </div>
      <div className="mt-9 flex items-center gap-3 border-b border-zinc-200 pb-6">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-100" />
        <div className="space-y-2">
          <div className="h-3.5 w-32 animate-pulse rounded-sm bg-zinc-100" />
          <div className="h-3 w-56 animate-pulse rounded-sm bg-zinc-100" />
        </div>
      </div>
      <div className="mt-8 aspect-[16/9] w-full animate-pulse rounded-sm bg-zinc-100" />
      <div className="mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="max-w-[720px] space-y-3.5">
          {lines.map((w, i) => (
            <div key={i} className={`h-4 ${w} animate-pulse rounded-sm bg-zinc-100`} />
          ))}
        </div>
        <div className="mt-10 hidden space-y-8 lg:mt-0 lg:block">
          <div className="aspect-[4/3] w-full animate-pulse rounded-sm bg-zinc-100" />
          <div className="space-y-4">
            <div className="h-4 w-36 animate-pulse rounded-sm bg-zinc-100" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-16 w-16 shrink-0 animate-pulse rounded-sm bg-zinc-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-full animate-pulse rounded-sm bg-zinc-100" />
                  <div className="h-3.5 w-2/3 animate-pulse rounded-sm bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
