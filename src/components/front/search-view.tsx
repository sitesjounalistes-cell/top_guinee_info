'use client'
// Vue Recherche — §4.7, refonte « premium éditorial » : grand champ serif à
// filet avec bouton carré navy, résultats en liste de filets, invitation et
// état « aucun résultat » raffinés avec exploration par rubriques.
// Logique, contrats API et props inchangés.

import { useEffect, useState } from 'react'
import { Link, navigate } from '@/lib/router'
import { publicApi } from '@/lib/api'
import type { Rubrique } from '@/lib/types'
import { ArticleCard, Pagination } from '@/components/tg/shared'
import { ErrorState, ListSkeleton, RubriqueIcon, useAsyncData, useRubriques } from './common'
import { Search, SearchX } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function SearchView({ q, page }: { q: string; page: number }) {
  const { t } = useI18n()
  const [term, setTerm] = useState(q)
  useEffect(() => { setTerm(q) }, [q])
  const tops = useRubriques().filter((r) => !r.parentId && r.isActive).sort((a, b) => a.order - b.order).slice(0, 8)

  const { data, loading, error, reload } = useAsyncData(
    () => (q ? publicApi.articles({ q, page, limit: 8 }) : Promise.resolve(null)),
    `search|${q}|${page}`,
  )

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const t = term.trim()
    if (!t) return
    navigate(`/recherche?q=${encodeURIComponent(t)}`)
  }

  const items = data?.items || []
  const hasQuery = Boolean(q)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-7 md:py-10">
      {/* ── En-tête + formulaire ─────────────────────────────────── */}
      <header className="tg-fade-up">
        <div className="flex items-center gap-3.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-tg-red shrink-0" aria-hidden />
          <h1 className="font-display font-bold text-[28px] md:text-[36px] tracking-tight text-tg-navy leading-none">
            Recherche
          </h1>
        </div>

        <form
          role="search"
          onSubmit={submit}
          className="mt-6 md:mt-8 flex items-stretch border-b-2 border-zinc-300 focus-within:border-tg-navy transition-colors duration-300"
        >
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Un sujet, un événement, un nom…"
            aria-label="Votre recherche"
            className="flex-1 min-w-0 h-14 bg-transparent border-0 px-0 font-display text-xl text-tg-navy placeholder:font-sans placeholder:text-[15px] placeholder:text-zinc-400 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="shrink-0 w-14 h-14 bg-tg-navy hover:bg-tg-red text-white flex items-center justify-center transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tg-red"
          >
            <Search size={18} aria-hidden />
          </button>
        </form>

        {hasQuery && !loading && data && (
          <p className="mt-4 tg-kicker text-zinc-500 flex flex-wrap items-center gap-x-2.5 gap-y-1" role="status" aria-live="polite">
            {data.total > 0 ? (
              <>
                <span className="text-tg-navy">{data.total} résultat{data.total > 1 ? 's' : ''}</span>
                <span className="w-1 h-1 rotate-45 bg-zinc-300" aria-hidden />
                <span>pour</span>
                <span className="text-tg-red">«&nbsp;{q}&nbsp;»</span>
              </>
            ) : (
              <span>Aucun résultat pour «&nbsp;<span className="text-tg-red">{q}</span>&nbsp;»</span>
            )}
          </p>
        )}
      </header>

      {/* ── Sans requête : invitation élégante ───────────────────── */}
      {!hasQuery && (
        <div className="mt-10 md:mt-14 tg-fade-up text-center">
          <p className="tg-kicker text-zinc-400 flex items-center justify-center gap-3">
            <span className="tg-flag-stripe" aria-hidden><i /></span>
            Explorer la rédaction
            <span className="tg-flag-stripe" aria-hidden><i /></span>
          </p>
          <p className="mt-4 font-display font-bold text-xl md:text-[26px] text-tg-navy leading-snug tracking-tight">
            Que cherchez-vous aujourd'hui&nbsp;?
          </p>
          <p className="mt-2.5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Tapez un mot-clé dans le champ ci-dessus pour retrouver un article, ou explorez directement nos rubriques les plus consultées.
          </p>
          {tops.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {tops.map((r) => <RubriqueChip key={r.id} r={r} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Résultats ────────────────────────────────────────────── */}
      {hasQuery && (
        <div className="mt-8 md:mt-10">
          {loading ? (
            <ListSkeleton rows={5} />
          ) : error ? (
            <ErrorState message="La recherche n'a pas abouti. Vérifiez votre connexion puis réessayez." onRetry={reload} />
          ) : items.length === 0 ? (
            <NoResults q={q} tops={tops} />
          ) : (
            <div className="tg-fade-up">
              <div className="divide-y divide-zinc-200">
                {items.map((a) => (
                  <div key={a.id} className="py-5 first:pt-0 last:pb-0">
                    <ArticleCard article={a} variant="horizontal" />
                  </div>
                ))}
              </div>
              <Pagination
                page={data?.page || 1}
                pages={data?.pages || 1}
                makeHref={(p) => `/recherche?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ''}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Chip de rubrique populaire (→ /rubrique/slug) ────────────────────

function RubriqueChip({ r }: { r: Rubrique }) {
  return (
    <Link
      to={`/rubrique/${r.slug}`}
      className="inline-flex items-center gap-2 h-11 px-4 rounded-full border border-zinc-300 bg-white text-[12.5px] font-semibold text-zinc-600 hover:border-tg-navy hover:text-tg-navy transition-colors duration-300"
    >
      <RubriqueIcon icon={r.icon} size={14} style={{ color: r.color }} />
      {r.menuLabel || r.name}
    </Link>
  )
}

// ─── Aucun résultat : message + conseils + exploration ────────────────

function NoResults({ q, tops }: { q: string; tops: Rubrique[] }) {
  const { t } = useI18n()
  return (
    <div className="tg-fade-up text-center py-4 md:py-6">
      <span className="inline-flex w-14 h-14 rounded-full border border-tg-red/25 bg-tg-red/5 text-tg-red items-center justify-center">
        <SearchX size={22} aria-hidden />
      </span>
      <h2 className="mt-5 font-display font-bold text-xl md:text-2xl text-tg-navy tracking-tight">
        {t.noResults}
      </h2>
      <p className="mt-2.5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        {t.noResultsDesc}
      </p>
      <p className="mt-4 text-[12.5px] text-zinc-400 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>Moins de mots-clés</span>
        <span className="w-1 h-1 rotate-45 bg-zinc-300" aria-hidden />
        <span>Termes généraux</span>
        <span className="w-1 h-1 rotate-45 bg-zinc-300" aria-hidden />
        <span>Sans accents</span>
      </p>
      {tops.length > 0 && (
        <div className="mt-8">
          <p className="tg-kicker text-zinc-400 flex items-center justify-center gap-3">
            <span className="tg-flag-stripe" aria-hidden><i /></span>
            Explorer par rubrique
            <span className="tg-flag-stripe" aria-hidden><i /></span>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {tops.map((r) => <RubriqueChip key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
