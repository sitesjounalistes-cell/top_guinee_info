'use client'
// Vue TV — rubrique télévision activable (§4.9) : direct YouTube ou Facebook,
// puis vidéos de la rédaction (articles liés à une vidéo YouTube).
// Design « premium éditorial » : hero navy pleine largeur (bande tricolore),
// lecteur principal au filet fin, grille de vidéos serif.
// Les liens du direct sont fournis par le shell (settings déjà chargées).

import { useState } from 'react'
import { publicApi } from '@/lib/api'
import type { ArticleCardData } from '@/lib/types'
import { ArticleCard, SectionHeader } from '@/components/tg/shared'
import { EmptyState, ErrorState, useAsyncData } from './common'
import { Skeleton } from '@/components/ui/skeleton'
import { Facebook, PlayCircle, Tv, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TVViewProps {
  tvLabel?: string
  tvYoutubeUrl?: string
  tvFacebookUrl?: string
}

export function TVView({ tvLabel, tvYoutubeUrl, tvFacebookUrl }: TVViewProps) {
  const label = tvLabel || 'TV'
  const videos = useAsyncData(
    () => publicApi.articles({ hasVideo: '1', limit: 8, sort: 'recent' }),
    'tv-videos',
  )
  const items = (videos.data?.items || []).filter((a) => a.youtubeUrl)

  return (
    <div>
      {/* ── Hero navy pleine largeur ─────────────────────────────── */}
      <section className="relative bg-tg-navy-dark text-white tg-fade-up" aria-label="Bannière TV">
        <div className="tg-tricolor-band absolute top-0 left-0 right-0" aria-hidden><i /></div>
        <div className="tg-container py-12 md:py-16">
          <div className="flex items-center justify-between gap-10">
            <div className="min-w-0">
              <p className="tg-kicker text-tg-yellow flex items-center gap-3">
                <span className="tg-flag-stripe" aria-hidden><i /></span>
                Direct & vidéos
              </p>
              <h1 className="mt-4 font-display font-black text-[30px] md:text-[42px] leading-[1.05] tracking-tight">
                {label}
              </h1>
              <p className="mt-4 text-zinc-400 text-sm md:text-[15px] leading-relaxed max-w-xl">
                Suivez nos directs et retrouvez toutes les vidéos de la rédaction :
                journaux télévisés, reportages, interviews et plateaux de débats.
              </p>
            </div>
            {/* Médaillon « sur nos écrans » — signature TV */}
            <div
              className="hidden md:flex flex-col items-center justify-center gap-3 shrink-0 w-28 lg:w-32 aspect-square rounded-full border border-white/15 bg-white/[0.03]"
              aria-hidden
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-red opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tg-red" />
              </span>
              <Tv size={24} className="text-white/80" />
              <span className="tg-kicker text-[9px] text-zinc-400">Sur nos écrans</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Lecteur principal (direct YouTube / Facebook) ────────── */}
      <TVPlayer tvLabel={label} tvYoutubeUrl={tvYoutubeUrl} tvFacebookUrl={tvFacebookUrl} />

      {/* ── Vidéos de la rédaction ───────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <SectionHeader
          title="Vidéos de la rédaction"
          rubrique={null}
          action={<span className="hidden sm:inline-flex items-center gap-1.5 tg-kicker text-zinc-400">Reportages & plateaux</span>}
        />
        {videos.loading ? (
          <TVVideosSkeleton />
        ) : videos.error ? (
          <ErrorState
            message="Impossible de charger les vidéos. Vérifiez votre connexion puis réessayez."
            onRetry={videos.reload}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<PlayCircle size={22} aria-hidden />}
            title="Aucune vidéo pour le moment"
            description="Nos caméras préparent les prochains sujets. Les reportages de la rédaction arrivent bientôt !"
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {items.slice(0, 8).map((a) => (
              <ArticleCard key={a.id} article={a} variant="medium" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Lecteur principal : bascule YouTube / Facebook ──────────────────

function TVPlayer({ tvLabel, tvYoutubeUrl, tvFacebookUrl }: TVViewProps) {
  const yt = tvYoutubeUrl?.trim() || ''
  const fb = tvFacebookUrl?.trim() || ''
  const embedSrc = yt ? youtubeEmbedSrc(yt) : ''
  // Source initiale : YouTube si configuré et exploitable, sinon Facebook. Le
  // composant est remonté à chaque navigation → pas de resynchronisation.
  const [source, setSource] = useState<'youtube' | 'facebook'>(embedSrc ? 'youtube' : 'facebook')

  if (!yt && !fb) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <EmptyState
          icon={<Tv size={22} aria-hidden />}
          title="Aucun direct configuré pour le moment"
          description={`L'équipe de ${tvLabel} prépare sa prochaine retransmission. Revenez très vite !`}
        />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-12">
      <div className="tg-fade-up">
        {/* Sélecteur de source (si les deux sont disponibles) */}
        {embedSrc && fb && (
          <div className="flex items-center justify-center gap-2 mb-5" role="tablist" aria-label="Source du direct">
            <SourceTab
              active={source === 'youtube'}
              onClick={() => setSource('youtube')}
              icon={<Youtube size={15} aria-hidden />}
              label="YouTube"
            />
            <SourceTab
              active={source === 'facebook'}
              onClick={() => setSource('facebook')}
              icon={<Facebook size={15} aria-hidden />}
              label="Facebook"
            />
          </div>
        )}

        <div className="relative w-full aspect-video rounded-sm overflow-hidden border border-zinc-200 bg-black shadow-[0_10px_40px_-12px_rgba(20,33,61,0.35)]">
          {source === 'youtube' && embedSrc ? (
            <iframe
              src={embedSrc}
              title={`Direct ${tvLabel} — YouTube`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          ) : fb ? (
            <iframe
              src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(fb)}&show_text=false&autoplay=0&width=1280`}
              title={`Direct ${tvLabel} — Facebook`}
              allow="encrypted-media; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
              <Tv size={34} aria-hidden />
              <p className="text-sm">Lien YouTube non reconnu — vérifiez le paramétrage TV.</p>
            </div>
          )}
        </div>

        <p className="mt-3.5 text-center text-[11.5px] text-zinc-400 font-medium tracking-wide flex items-center justify-center gap-2">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-red opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tg-red" />
          </span>
          Direct {source === 'youtube' ? 'YouTube' : 'Facebook'} — si l&apos;écran reste noir, le direct n&apos;a pas encore commencé
        </p>
      </div>
    </div>
  )
}

function SourceTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-11 px-5 rounded-sm text-[12px] font-bold uppercase tracking-[0.12em] border transition-colors',
        active
          ? 'bg-tg-navy text-white border-tg-navy'
          : 'bg-white text-tg-navy border-zinc-300 hover:border-tg-navy',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// Construit la source d'embed YouTube :
// • URL de chaîne (youtube.com/channel/UC…) → direct permanent de la chaîne
// • URL de vidéo (watch / youtu.be / shorts / live / embed / v) → vidéo ou direct
function youtubeEmbedSrc(url: string): string {
  const ch = url.match(/channel\/(UC[\w-]{20,})/)
  if (ch) return `https://www.youtube.com/embed/live_stream?channel=${ch[1]}&autoplay=0`
  const id = youtubeIdOf(url)
  return id ? `https://www.youtube.com/embed/${id}?autoplay=0&rel=0` : ''
}

// ID YouTube tolérant aux formats watch / youtu.be / shorts / live / m. / embed / v
function youtubeIdOf(url: string): string {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : ''
}

// ─── Squelettes ──────────────────────────────────────────────────────

function TVVideosSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10" aria-busy="true" aria-label="Chargement des vidéos">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} aria-hidden>
          <Skeleton className="aspect-[3/2] rounded-sm" />
          <Skeleton className="h-2.5 w-16 mt-4" />
          <Skeleton className="h-5 w-full mt-2" />
          <Skeleton className="h-5 w-2/3 mt-2" />
        </div>
      ))}
    </div>
  )
}
