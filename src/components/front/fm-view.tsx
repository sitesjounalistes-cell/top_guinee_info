'use client'
// Vue FM — §4.9 : émissions, épisodes avec lecteurs audio, écoutes.
// Design « premium éditorial » : hero navy pleine largeur (bande tricolore),
// cartes d'émission au filet fin, épisodes en liste séparée par filets.

import { publicApi, fmt } from '@/lib/api'
import type { Episode } from '@/lib/types'
import { FadeImage, AudioPlayer } from '@/components/tg/shared'
import { EmptyState, ErrorState, useAsyncData } from './common'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Headphones, MicOff, Radio } from 'lucide-react'

const TYPE_META: Record<string, { label: string; color: string }> = {
  FM: { label: 'Émission FM', color: '#D21034' },
  PODCAST: { label: 'Podcast', color: '#009460' },
  CHRONIQUE: { label: 'Chronique', color: '#14213D' },
}

export function FMView({ fmLabel }: { fmLabel?: string }) {
  const { data, loading, error, reload } = useAsyncData(() => publicApi.emissions(), 'emissions')
  const label = data?.fmLabel || fmLabel || 'Top FM'
  const emissions = data?.emissions || []

  return (
    <div>
      {/* ── Hero navy pleine largeur ─────────────────────────────── */}
      <section className="relative bg-tg-navy-dark text-white tg-fade-up" aria-label="Bannière FM">
        <div className="tg-tricolor-band absolute top-0 left-0 right-0" aria-hidden><i /></div>
        <div className="tg-container py-12 md:py-16">
          <div className="flex items-center justify-between gap-10">
            <div className="min-w-0">
              <p className="tg-kicker text-tg-yellow flex items-center gap-3">
                <span className="tg-flag-stripe" aria-hidden><i /></span>
                Podcasts & chroniques
              </p>
              <h1 className="mt-4 font-display font-black text-[30px] md:text-[42px] leading-[1.05] tracking-tight">
                {label}
              </h1>
              <p className="mt-4 text-zinc-400 text-sm md:text-[15px] leading-relaxed max-w-xl">
                Écoutez ou réécoutez les émissions de la rédaction : journaux parlés, débats, chroniques
                et grands entretiens. Un clic suffit, où que vous soyez.
              </p>
            </div>
            {/* Médaillon « en antenne » — signature radio, discret */}
            <div
              className="hidden md:flex flex-col items-center justify-center gap-3 shrink-0 w-28 lg:w-32 aspect-square rounded-full border border-white/15 bg-white/[0.03]"
              aria-hidden
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-yellow opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tg-yellow" />
              </span>
              <Radio size={24} className="text-white/80" />
              <span className="tg-kicker text-[9px] text-zinc-400">En antenne</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Émissions ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-7">
        {loading ? (
          <FMSkeleton />
        ) : error ? (
          <ErrorState
            message="Impossible de charger les émissions. Vérifiez votre connexion puis réessayez."
            onRetry={reload}
          />
        ) : emissions.length === 0 ? (
          <EmptyState
            icon={<MicOff size={22} aria-hidden />}
            title="Aucune émission disponible pour le moment"
            description="Nos micros préparent les prochains épisodes. Revenez très vite — le meilleur de la radio arrive !"
          />
        ) : (
          emissions.map((em) => {
            const meta = TYPE_META[em.type] || TYPE_META.FM
            const count = em.episodes?.length || 0
            return (
              <section
                key={em.id}
                className="rounded-sm border border-zinc-200 bg-white tg-fade-up"
                aria-label={`Émission ${em.title}`}
              >
                {/* En-tête d'émission : couverture + kicker + titre serif */}
                <div className="p-4 md:p-6 flex flex-col sm:flex-row gap-4 md:gap-6">
                  <div className="group relative w-32 md:w-44 aspect-[3/2] rounded-sm overflow-hidden shrink-0 bg-tg-gray">
                    <FadeImage
                      src={em.coverImage}
                      alt={`Couverture de l'émission ${em.title}`}
                      fill
                      sizes="176px"
                      className="tg-zoom"
                    />
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="tg-kicker inline-flex items-center gap-1.5" style={{ color: meta.color }}>
                      <span className="w-1.5 h-1.5 rotate-45 shrink-0" style={{ backgroundColor: meta.color }} aria-hidden />
                      {meta.label}
                    </p>
                    <h2 className="mt-1.5 font-display font-bold text-xl md:text-[22px] tracking-tight text-tg-navy leading-snug">
                      {em.title}
                    </h2>
                    {em.description && (
                      <p className="mt-2 text-sm text-zinc-500 leading-relaxed line-clamp-2">{em.description}</p>
                    )}
                  </div>
                  {count > 0 && (
                    <p className="hidden sm:block tg-kicker text-[9.5px] text-zinc-400 shrink-0 pt-1" aria-hidden>
                      {count} épisode{count > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Épisodes — liste séparée par filets */}
                <div className="border-t border-zinc-200">
                  {count === 0 ? (
                    <p className="px-4 md:px-6 py-5 text-[13px] text-zinc-400 italic">
                      Aucun épisode publié pour cette émission — les prochains arrivent bientôt.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-100" aria-label={`Épisodes de ${em.title}`}>
                      {em.episodes!.map((ep) => (
                        <li key={ep.id} className="px-4 md:px-6 py-5">
                          <EpisodeRow ep={ep} emissionTitle={em.title} color={meta.color} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

// Rangée d'épisode : kicker émission, titre serif, méta + lecteur compact.
// Le lecteur compact évite de répéter le titre déjà affiché en éditorial
// (les contrôles vitesse/volume apparaissent d'eux-mêmes dès md).
function EpisodeRow({ ep, emissionTitle, color }: { ep: Episode; emissionTitle: string; color: string }) {
  return (
    <div>
      <p className="tg-kicker text-[9.5px]" style={{ color }}>{emissionTitle}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <h3 className="font-display font-semibold text-[16px] md:text-[17px] leading-snug text-tg-navy min-w-0">
          {ep.title}
        </h3>
        <p className="flex items-center gap-2 text-[11px] font-medium text-zinc-400 tabular-nums shrink-0">
          <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden /> {fmt.duration(ep.duration)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Headphones size={11} aria-hidden /> {fmt.num(ep.listens)} écoutes</span>
          <span aria-hidden>·</span>
          <span>{fmt.short(ep.publishAt)}</span>
        </p>
      </div>
      {ep.description && (
        <p className="mt-1.5 text-[13px] text-zinc-500 leading-relaxed line-clamp-2">{ep.description}</p>
      )}
      <div className="mt-3.5">
        <AudioPlayer src={ep.audioUrl} title={ep.title} emission={emissionTitle} compact />
      </div>
    </div>
  )
}

// Squelette premium : deux cartes d'émission avec couverture + lecteur
function FMSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Chargement des émissions">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-sm border border-zinc-200 bg-white" aria-hidden>
          <div className="p-4 md:p-6 flex flex-col sm:flex-row gap-4 md:gap-6">
            <Skeleton className="w-32 md:w-44 aspect-[3/2] rounded-sm shrink-0" />
            <div className="flex-1 space-y-3 py-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
          <div className="border-t border-zinc-100 px-4 md:px-6 py-5 space-y-3">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-14 w-full rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}
