'use client'
// Vue Accueil — §4.2 : À la Une (composition magazine), intercalaires pub,
// blocs par rubrique (grand article + liste filets), Les plus lus, Médias.

import { Link } from '@/lib/router'
import type { AdBannerData, Episode } from '@/lib/types'
import { fmt } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ArticleCard, AudioPlayer, FeaturedCarousel, RichInline, SectionHeader, YouTubeEmbed,
} from '@/components/tg/shared'
import {
  CardsSkeleton, EmptyState, ErrorState, ImpressionBanner, getHomeCached, useAsyncData,
} from './common'
import { ArrowRight, Headphones, ListVideo, Play, TrendingUp } from 'lucide-react'

const RANK_COLORS = ['#D21034', '#c99700', '#00734B', '#14213D', '#a80c28']

export function HomeView() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsyncData(getHomeCached, 'home')

  if (loading) return <HomeSkeleton />
  if (error || !data) return <ErrorState message="Impossible de charger la page d'accueil." onRetry={reload} />

  const { featured, rubriqueBlocks, mostRead, latestEpisodes, latestVideos, ads } = data
  const secondary = featured.secondary || []
  // Rubriques activables (§4.9) : FM/Podcasts et TV peuvent être désactivées
  // depuis Paramètres → FM & TV. Les blocs correspondants disparaissent alors.
  const fmOn = data.settings?.fmEnabled !== 'off'
  const tvOn = data.settings?.tvEnabled === 'on'
  const showEpisodes = fmOn && (latestEpisodes?.length || 0) > 0
  const showVideos = latestVideos.length > 0

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-10 md:space-y-14">

      {/* ── 1. À la Une — composition magazine ──────────────────── */}
      <section aria-label="À la une" className="tg-fade-up">
        <SectionHeader
          title={t.featured}
          rubrique={null}
          action={
            <span className="hidden sm:inline-flex items-center gap-1.5 tg-kicker text-zinc-400">
              <TrendingUp size={12} aria-hidden /> {t.todaysEssential}
            </span>
          }
        />
        {/* Défilement des articles à la Une : la principale puis les
            secondaires, en grandes cartes qui se succèdent automatiquement
            (pause au survol, flèches et points de navigation). */}
        {featured.main || secondary.length > 0 ? (
          <FeaturedCarousel
            articles={[featured.main, ...secondary].filter(Boolean) as NonNullable<typeof featured.main>[]}
          />
        ) : (
          <EmptyState
            icon={<ListVideo size={20} aria-hidden />}
            title={t.preparing}
            description={t.preparingDesc}
          />
        )}
      </section>

      {/* ── 2. Intercalaire pub ─────────────────────────────────── */}
      <IntercalaireAd banner={ads?.intercalaire} />

      {/* ── 3. Blocs par rubrique : grand article + liste ───────── */}
      {rubriqueBlocks.map((block, bi) => (
        <div key={block.rubrique.id} className="space-y-10 md:space-y-14">
          <section aria-label={`Rubrique ${block.rubrique.name}`} className="tg-fade-up">
            <SectionHeader
              title={block.rubrique.name}
              rubrique={block.rubrique}
              action={
                <Link
                  to={`/rubrique/${block.rubrique.slug}`}
                  className="group/link inline-flex items-center gap-1.5 tg-kicker text-tg-red hover:text-tg-red-dark transition-colors py-1"
                >
                  {t.seeAll}
                  <ArrowRight size={13} aria-hidden className="transition-transform duration-300 group-hover/link:translate-x-1" />
                </Link>
              }
            />
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Grand article */}
              {block.articles[0] && (
                <div>
                  <ArticleCard article={block.articles[0]} variant="large" />
                </div>
              )}
              {/* Liste filets */}
              {block.articles.length > 1 && (
                <div className="divide-y divide-zinc-200 lg:pl-2">
                  {block.articles.slice(1, 4).map((a) => (
                    <div key={a.id} className="py-5 first:pt-0 lg:first:pt-1 last:pb-0">
                      <ArticleCard article={a} variant="horizontal" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          {bi % 2 === 0 && <IntercalaireAd banner={ads?.intercalaire} />}
        </div>
      ))}

      {/* ── 4. Les plus lus + colonne latérale ──────────────────── */}
      {(mostRead.length > 0 || showEpisodes || ads?.sidebar) && (
        <section className="tg-fade-up grid lg:grid-cols-3 gap-8 lg:gap-10" aria-label="Les articles les plus lus">
          <div className="lg:col-span-2 min-w-0">
            <SectionHeader
              title={t.mostRead}
              rubrique={null}
              action={<span className="tg-kicker text-tg-red">{t.top5}</span>}
            />
            <ol>
              {mostRead.slice(0, 5).map((a, i) => (
                <li key={a.id} className="flex items-center gap-4 md:gap-5 py-5 border-b border-zinc-200 last:border-b-0 first:pt-2">
                  <span
                    className="font-display font-bold text-[44px] md:text-[52px] leading-none w-10 md:w-12 text-center shrink-0 select-none text-zinc-200 transition-colors duration-300"
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
          </div>

          <aside className="space-y-6 min-w-0">
            {ads?.sidebar && <ImpressionBanner banner={ads.sidebar} position="sidebar" />}
            {showEpisodes && (
              <div className="rounded-sm border border-zinc-200 bg-tg-paper p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200">
                  <h3 className="font-display font-bold text-[17px] text-tg-navy flex items-center gap-2.5">
                    <span className="w-2 h-2 rotate-45 bg-tg-green shrink-0" aria-hidden />
                    {t.latestEpisodes}
                  </h3>
                  <Link to="/fm" className="text-[11px] font-semibold uppercase tracking-wider text-tg-red hover:text-tg-red-dark transition-colors">
                    {t.listenAll}
                  </Link>
                </div>
                <div className="space-y-3.5">
                  {latestEpisodes.slice(0, 3).map((ep) => (
                    <AudioPlayer key={ep.id} src={ep.audioUrl} title={ep.title} emission={ep.emission?.title} compact />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>
      )}

      {/* ── 5. Médias : vidéos + podcasts ───────────────────────── */}
      {(showVideos || showEpisodes) && (
        <section
          className={cn('tg-fade-up gap-8 lg:gap-10', showVideos && showEpisodes ? 'grid lg:grid-cols-2' : 'block')}
          aria-label={t.mediaHub}
        >
          {/* Vidéos */}
          {showVideos && (
          <div className={cn('min-w-0', !showEpisodes && 'max-w-3xl')}>
            <SectionHeader
              title={t.videos}
              rubrique={null}
              action={tvOn ? (
                <Link to="/tv" className="group/link inline-flex items-center gap-1.5 tg-kicker text-tg-red hover:text-tg-red-dark transition-colors py-1">
                  {t.watchLive}
                  <ArrowRight size={13} aria-hidden className="transition-transform duration-300 group-hover/link:translate-x-1" />
                </Link>
              ) : undefined}
            />
            {latestVideos.length > 0 ? (
              <>
                <div className="rounded-sm overflow-hidden border border-zinc-200 shadow-sm">
                  <YouTubeEmbed url={latestVideos[0].youtubeUrl} title={latestVideos[0].title} />
                  <Link
                    to={`/article/${latestVideos[0].slug}`}
                    className="block px-4 py-3.5 font-display font-semibold text-[15.5px] text-tg-navy hover:text-tg-red transition-colors leading-snug"
                  >
                    <RichInline html={latestVideos[0].title} />
                  </Link>
                </div>
                {latestVideos.length > 1 && (
                  <div className="mt-2 divide-y divide-zinc-200">
                    {latestVideos.slice(1, 4).map((a) => (
                      <div key={a.id} className="py-4 first:pt-4 last:pb-0">
                        <ArticleCard article={a} variant="horizontal" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState icon={<Play size={20} aria-hidden />} title="Aucune vidéo pour le moment" description="Nos reportages vidéo arrivent bientôt." />
            )}
            </div>
          )}

          {/* {t.podcasts} — masqué si la rubrique FM est désactivée */}
          {showEpisodes && (
          <div className="min-w-0">
            <SectionHeader
              title="{t.podcasts}"
              rubrique={null}
              action={
                <Link to="/fm" className="group/link inline-flex items-center gap-1.5 tg-kicker text-tg-red hover:text-tg-red-dark transition-colors py-1">
                  {t.seeAll}
                  <ArrowRight size={13} aria-hidden className="transition-transform duration-300 group-hover/link:translate-x-1" />
                </Link>
              }
            />
            {latestEpisodes?.length > 0 ? (
              <div className="space-y-3.5">
                {latestEpisodes.slice(0, 4).map((ep) => (
                  <EpisodeLine key={ep.id} ep={ep} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Headphones size={20} aria-hidden />} title="Aucun épisode pour le moment" description="Les podcasts de la rédaction arrivent bientôt." />
            )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// Ligne épisode compacte (média du bas de page d'accueil)
function EpisodeLine({ ep }: { ep: Episode }) {
  return (
    <div className="rounded-sm border border-zinc-200 bg-tg-paper p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="tg-kicker text-[10px] text-tg-green">{ep.emission?.title || 'Podcast'}</p>
          <p className="font-display font-semibold text-[15px] text-tg-navy truncate mt-1">{ep.title}</p>
          <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
            {fmt.duration(ep.duration)} · {fmt.num(ep.listens)} écoutes · {fmt.short(ep.publishAt)}
          </p>
        </div>
      </div>
      <AudioPlayer src={ep.audioUrl} title={ep.title} emission={ep.emission?.title} compact />
    </div>
  )
}

// Intercalaire pub — ne rend RIEN si aucune bannière (pas d'espace vide)
function IntercalaireAd({ banner }: { banner?: AdBannerData | null }) {
  if (!banner) return null
  return (
    <div className="flex justify-center">
      <ImpressionBanner banner={banner} position="intercalaire" className="w-full max-w-[728px]" />
    </div>
  )
}

// Squelette d'accueil
function HomeSkeleton() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-10" aria-busy="true" aria-label="Chargement de la page d'accueil">
      <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8">
          <div className="aspect-[16/9] lg:aspect-auto lg:h-[500px] bg-zinc-100 animate-pulse rounded-sm" />
        </div>
        <div className="space-y-5">
          <div className="aspect-[3/2] bg-zinc-100 animate-pulse rounded-sm" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 py-1">
              <div className="w-[104px] aspect-[3/2] bg-zinc-100 animate-pulse rounded-sm shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-2.5 w-14 bg-zinc-100 rounded animate-pulse" />
                <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <CardsSkeleton count={4} />
      <CardsSkeleton count={4} />
    </div>
  )
}
