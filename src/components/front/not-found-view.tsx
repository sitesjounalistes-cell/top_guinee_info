'use client'
// Vue 404 — page premium éditoriale : chiffre géant en filigrane, filets,
// raccourcis de lecture (rubriques populaires), bande tricolore de marque.

import { Link } from '@/lib/router'
import { RubriqueIcon, useRubriques } from './common'
import { ArrowLeft, Search } from 'lucide-react'

export function NotFoundView() {
  const tops = useRubriques().filter((r) => !r.parentId && r.isActive).sort((a, b) => a.order - b.order).slice(0, 6)

  return (
    <section className="tg-container py-10 md:py-16" aria-label="Page introuvable">
      <div className="relative max-w-3xl mx-auto rounded-sm border border-zinc-200 bg-tg-paper tg-fade-up">
        <div className="px-6 py-12 md:py-16 text-center">
          {/* 404 géant en filigrane */}
          <p
            aria-hidden
            className="font-display font-black text-[110px] md:text-[160px] leading-[0.85] text-tg-navy/10 select-none"
          >
            404
          </p>
          <p className="tg-kicker text-tg-red -mt-4 md:-mt-8 flex items-center justify-center gap-2 relative">
            <span className="w-2 h-2 rotate-45 bg-tg-red shrink-0" aria-hidden />
            Erreur de navigation
          </p>
          <h1 className="mt-4 font-display font-bold text-[26px] md:text-[32px] tracking-tight text-tg-navy">
            Page introuvable
          </h1>
          <p className="mt-4 text-zinc-500 text-sm md:text-[15px] leading-relaxed max-w-md mx-auto">
            La page que vous cherchez a peut-être changé d&apos;adresse, ou n&apos;a jamais existé.
            Reprenez la route depuis l&apos;accueil, ou lancez une recherche pour retrouver votre lecture.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-sm bg-tg-navy hover:bg-tg-red text-white text-sm font-semibold tracking-wide transition-colors duration-300"
            >
              <ArrowLeft size={15} aria-hidden /> Retour à l&apos;accueil
            </Link>
            <Link
              to="/recherche"
              className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-sm border border-tg-navy text-tg-navy hover:bg-tg-navy hover:text-white text-sm font-semibold tracking-wide transition-colors duration-300"
            >
              <Search size={15} aria-hidden /> Rechercher
            </Link>
          </div>

          {/* Rubriques populaires */}
          {tops.length > 0 && (
            <div className="mt-10 pt-8 border-t border-zinc-200">
              <p className="tg-kicker text-zinc-400 mb-4">Poursuivez votre lecture</p>
              <div className="flex flex-wrap justify-center gap-2">
                {tops.map((r) => (
                  <Link
                    key={r.id}
                    to={`/rubrique/${r.slug}`}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-sm border border-zinc-200 bg-white text-[13px] font-medium text-tg-navy hover:border-tg-navy hover:text-tg-red transition-colors"
                  >
                    <RubriqueIcon icon={r.icon} size={13} style={{ color: r.color }} />
                    {r.menuLabel || r.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="tg-tricolor-band" aria-hidden><i /></div>
      </div>
    </section>
  )
}
