'use client'
// Front-office Topguinee.info — layout global premium (masthead de presse :
// barre utilitaire, logotype officiel centré, navigation éditoriale, recherche
// plein écran, footer raffiné, maintenance) + aiguillage des vues.
// Le shell (page.tsx) fournit route/settings/contacts/socials/flash.

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, navigate } from '@/lib/router'
import type { ContactChannel, FlashInfo, SiteSettings, SocialLink } from '@/lib/types'
import { cn } from '@/lib/utils'
import { safeHttpUrl } from '@/lib/sanitize'
import {
  FadeImage, FlashTicker, SocialIcon,
} from '@/components/tg/shared'
import { ImpressionBanner, RubriqueIcon, getHomeCached, useAsyncData, useRubriques } from './common'
import { NotFoundView } from './not-found-view'
import { HomeView } from './home-view'
import { RubriqueView } from './rubrique-view'
import { SearchView } from './search-view'
import { FMView } from './fm-view'
import { TVView } from './tv-view'
import { StaticPageView, ContactView } from './page-views'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowUp, ChevronDown, LifeBuoy, Mail, MapPin, Menu, MessageCircle, Phone, Radio,
  Search, Settings2, Tv, Wrench, X,
} from 'lucide-react'

// ─── Composant principal ─────────────────────────────────────────────

export function FrontOffice({ route, settings, contacts, socials, flash, onOpenAdmin }: {
  route: { segments: string[]; query: URLSearchParams }
  settings: SiteSettings
  contacts: ContactChannel[]
  socials: SocialLink[]
  flash: FlashInfo[]
  onOpenAdmin: () => void
}) {
  const segments = route.segments
  const seg0 = segments[0] || ''
  const seg1 = segments[1] || ''
  const query = route.query

  // Titre du document à la charte SEO
  useEffect(() => {
    document.title = settings.seoTitle || `${settings.siteName} — ${settings.slogan}`
  }, [settings.seoTitle, settings.siteName, settings.slogan])

  const activeRubrique = seg0 === 'rubrique' ? seg1 : ''

  // ── Vue maintenance : plein écran, aucun layout classique ──
  if (settings.maintenance === 'on') {
    return <MaintenanceView settings={settings} contacts={contacts} />
  }

  const fmOn = settings.fmEnabled !== 'off'
  const tvOn = settings.tvEnabled === 'on'

  let view: React.ReactNode
  if (!seg0) {
    view = <HomeView />
  } else if (seg0 === 'rubrique' && seg1) {
    view = (
      <RubriqueView
        slug={seg1}
        sub={query.get('sub') || undefined}
        page={Number(query.get('page')) || 1}
        sort={query.get('sort') || 'recent'}
      />
    )
  } else if (seg0 === 'article' && seg1) {
    // Anciens liens #/article/slug : redirection vers la vraie page
    // canonique /article/slug (SSR, métadonnées dynamiques, indexable)
    view = <LegacyArticleRedirect slug={seg1} />
  } else if (seg0 === 'recherche') {
    view = <SearchView q={query.get('q') || ''} page={Number(query.get('page')) || 1} />
  } else if (seg0 === 'fm') {
    view = fmOn
      ? <FMView fmLabel={settings.fmLabel} />
      : <SectionUnavailable icon={<Radio size={22} aria-hidden />} label={settings.fmLabel || 'FM'} />
  } else if (seg0 === 'tv') {
    view = tvOn
      ? <TVView tvLabel={settings.tvLabel} tvYoutubeUrl={settings.tvYoutubeUrl} tvFacebookUrl={settings.tvFacebookUrl} />
      : <SectionUnavailable icon={<Tv size={22} aria-hidden />} label={settings.tvLabel || 'TV'} />
  } else if (seg0 === 'about') {
    view = <StaticPageView pageKey="about" fallbackTitle="À propos de nous" />
  } else if (seg0 === 'contact') {
    view = <ContactView />
  } else if (seg0 === 'legal') {
    view = <StaticPageView pageKey="legal" fallbackTitle="Mentions légales" />
  } else if (seg0 === 'privacy') {
    view = <StaticPageView pageKey="privacy" fallbackTitle="Politique de confidentialité" />
  } else {
    view = <NotFoundView />
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Lien d'évitement clavier (sans modifier le hash → routeur SPA) */}
      <button
        onClick={() => document.getElementById('contenu-principal')?.scrollIntoView()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-tg-navy focus:px-4 focus:py-2 focus:rounded-sm focus:shadow-lg focus:font-semibold"
      >
        Aller au contenu principal
      </button>
      <FlashTicker items={flash} />
      <SiteHeader
        settings={settings}
        socials={socials}
        contacts={contacts}
        activeRubrique={activeRubrique}
        activeSeg0={seg0}
        onOpenAdmin={onOpenAdmin}
        fmOn={fmOn}
        tvOn={tvOn}
      />
      <HeaderAd />
      <main className="flex-1 w-full" id="contenu-principal">
        {view}
      </main>
      <SiteFooter settings={settings} contacts={contacts} socials={socials} onOpenAdmin={onOpenAdmin} fmOn={fmOn} tvOn={tvOn} />
      <ScrollTopButton />
    </div>
  )
}

// ─── Bannière pub sous le header (toutes les pages) ──────────────────

function HeaderAd() {
  const { data } = useAsyncData(getHomeCached, 'home')
  if (!data?.ads?.header) return null
  return (
    <div className="tg-container w-full pt-5">
      <div className="flex justify-center">
        <ImpressionBanner banner={data.ads.header} position="header" className="w-full max-w-[970px]" />
      </div>
    </div>
  )
}

// ─── Header premium : barre utilitaire + masthead + navigation ───────

function SiteHeader({ settings, socials, contacts, activeRubrique, activeSeg0, onOpenAdmin, fmOn, tvOn }: {
  settings: SiteSettings
  socials: SocialLink[]
  contacts: ContactChannel[]
  activeRubrique: string
  activeSeg0: string
  onOpenAdmin: () => void
  fmOn: boolean
  tvOn: boolean
}) {
  const [term, setTerm] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Date de l'édition — initialisation paresseuse (rendu client uniquement,
  // le shell SPA ne peint FrontOffice qu'après chargement → pas d'hydratation)
  const [today] = useState(() => {
    const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
    return s.charAt(0).toUpperCase() + s.slice(1)
  })
  const rubriques = useRubriques()
  const tops = useMemo(
    () => (rubriques || []).filter((r) => !r.parentId && r.isActive).sort((a, b) => a.order - b.order),
    [rubriques],
  )

  const submitSearch = (q?: string) => {
    const value = (q ?? term).trim()
    if (!value) return
    setMobileOpen(false)
    setSearchOpen(false)
    navigate(`/recherche?q=${encodeURIComponent(value)}`)
  }

  const email = contacts.find((c) => c.type === 'email' && c.isActive)?.value
  const phone = contacts.find((c) => c.type === 'phone' && c.isActive)?.value

  return (
    <header role="banner">
      {/* ── Barre utilitaire (desktop) ─────────────────────────── */}
      <div className="hidden md:block bg-tg-navy-dark text-zinc-400 border-b border-white/5">
        <div className="tg-container h-9 flex items-center justify-between gap-6 text-[11.5px] font-medium tracking-wide">
          <p className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rotate-45 bg-tg-yellow shrink-0" aria-hidden />
            <span className="truncate">{today || '\u00A0'}</span>
          </p>
          <div className="flex items-center gap-5 shrink-0">
            {email && (
              <a href={`mailto:${email}`} className="hidden lg:flex items-center gap-1.5 hover:text-tg-yellow transition-colors">
                <Mail size={12} aria-hidden /> {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="hidden lg:flex items-center gap-1.5 hover:text-tg-yellow transition-colors">
                <Phone size={12} aria-hidden /> {phone}
              </a>
            )}
            {socials.length > 0 && (
              <nav aria-label="Réseaux sociaux" className="flex items-center gap-0.5 border-l border-white/10 pl-4">
                {socials.map((s) => (
                  <a
                    key={s.id}
                    href={safeHttpUrl(s.url) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.platform}
                    title={s.platform}
                    className="p-1.5 text-zinc-500 hover:text-tg-yellow transition-colors"
                  >
                    <SocialIcon platform={s.platform} size={13} />
                  </a>
                ))}
              </nav>
            )}
            <button
              onClick={onOpenAdmin}
              aria-label="Espace administrateur"
              title="Espace administrateur"
              className="p-1.5 text-zinc-600 hover:text-tg-yellow transition-colors"
            >
              <Settings2 size={13} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* ── Masthead : rangée mobile compacte (sticky) ─────────── */}
      <div className="md:hidden sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-1.5 h-14 px-3">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2.5 -ml-1.5 rounded-sm text-tg-navy hover:bg-tg-gray transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu size={21} />
          </button>
          {/* Logotype officiel (version claire, slogan inclus) */}
          <Link to="/" className="flex min-w-0 flex-1 justify-center" aria-label={`${settings.siteName} — ${settings.slogan}`}>
            <Image
              src="/brand/logo-lockup.png"
              alt={`${settings.siteName} — ${settings.slogan}`}
              width={720}
              height={413}
              priority
              className="h-10 w-auto"
            />
          </Link>
          {(fmOn || tvOn) && (
            <Link
              to={fmOn ? '/fm' : '/tv'}
              aria-label={fmOn ? (settings.fmLabel || 'Radio FM') : (settings.tvLabel || 'TV')}
              className="relative p-2.5 rounded-sm text-tg-navy hover:bg-tg-gray transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {fmOn ? <Radio size={19} aria-hidden /> : <Tv size={19} aria-hidden />}
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-red opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tg-red" />
              </span>
            </Link>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
            className="p-2.5 rounded-sm text-tg-navy hover:bg-tg-gray transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Search size={19} />
          </button>
        </div>
      </div>

      {/* ── Masthead : bloc central de presse (desktop) ────────── */}
      <div className="hidden md:block bg-white border-b border-zinc-200">
        <div className="tg-container py-5 lg:py-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Aile gauche : édition */}
          <div className="min-w-0">
            <p className="tg-kicker text-zinc-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rotate-45 bg-tg-red shrink-0" aria-hidden />
              Édition du jour
            </p>
            <p className="mt-1.5 font-display text-[15px] font-semibold text-tg-navy truncate">{today || '\u00A0'}</p>
          </div>

          {/* Bloc central : logotype officiel (emblème + mot-symbole + slogan) */}
          <Link
            to="/"
            className="group flex justify-center px-2 py-1"
            aria-label={`${settings.siteName} — ${settings.slogan}`}
          >
            <Image
              src="/brand/logo-lockup.png"
              alt={`${settings.siteName} — ${settings.slogan}`}
              width={720}
              height={413}
              priority
              className="h-24 lg:h-28 w-auto transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>

          {/* Aile droite : recherche + FM */}
          <div className="flex items-center justify-end gap-2">
            <form
              role="search"
              onSubmit={(e) => { e.preventDefault(); submitSearch() }}
              className="hidden xl:block relative"
            >
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" aria-hidden />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher sur le site"
                className="w-52 h-10 rounded-sm bg-tg-gray border border-zinc-200 pl-9 pr-3 text-[13.5px] text-tg-navy placeholder:text-zinc-400 focus:outline-none focus:border-tg-navy focus:bg-white transition-colors"
              />
            </form>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher"
              title="Rechercher"
              className="xl:hidden w-10 h-10 rounded-sm border border-zinc-200 text-tg-navy hover:border-tg-navy flex items-center justify-center transition-colors"
            >
              <Search size={17} />
            </button>
            {fmOn && (
              <Link
                to="/fm"
                title={settings.fmLabel || 'Radio FM'}
                className="relative hidden sm:flex items-center gap-2 h-10 px-4 rounded-sm bg-tg-navy hover:bg-tg-navy-light text-white text-[12.5px] font-semibold tracking-wide transition-colors"
              >
                <Radio size={15} className="text-tg-red" aria-hidden />
                <span className="hidden lg:inline">{settings.fmLabel || 'Top FM'}</span>
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-red opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tg-red ring-2 ring-white" />
                </span>
              </Link>
            )}
            {tvOn && (
              <Link
                to="/tv"
                title={settings.tvLabel || 'TV'}
                className="relative hidden sm:flex items-center gap-2 h-10 px-4 rounded-sm border border-tg-navy/25 hover:border-tg-navy bg-white text-tg-navy text-[12.5px] font-semibold tracking-wide transition-colors"
              >
                <Tv size={15} className="text-tg-red" aria-hidden />
                <span className="hidden lg:inline">{settings.tvLabel || 'TV'}</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Barre de navigation éditoriale (desktop, sticky) ───── */}
      <nav aria-label="Rubriques" className="hidden md:block sticky top-0 z-50 bg-tg-navy shadow-lg shadow-tg-navy/25">
        <div className="tg-container flex items-center">
          <HeaderNavItem to="/" active={activeSeg0 === ''} label="Accueil" />
          {tops.map((r) => {
            const children = (r.children || []).filter((c) => c.isActive).sort((a, b) => a.order - b.order)
            const active = activeRubrique === r.slug || children.some((c) => c.slug === activeRubrique)
            if (children.length === 0) {
              return <HeaderNavItem key={r.id} to={`/rubrique/${r.slug}`} active={active} label={r.menuLabel || r.name} />
            }
            return (
              <DropdownMenu key={r.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-1.5 h-11 px-3.5 text-[12px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-colors border-b-2 border-t-2 border-transparent',
                      active ? 'border-b-tg-yellow text-tg-yellow' : 'text-white/80 hover:text-white hover:bg-white/[0.06]',
                    )}
                  >
                    {r.menuLabel || r.name}
                    <ChevronDown size={11} className="opacity-50" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={0} className="w-60 rounded-sm rounded-t-none border-t-2 border-t-tg-yellow shadow-xl">
                  <DropdownMenuItem asChild>
                    <Link to={`/rubrique/${r.slug}`} className="cursor-pointer font-bold text-tg-navy text-[13px] py-2.5">
                      Tout voir — {r.name}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {children.map((c) => (
                    <DropdownMenuItem key={c.id} asChild>
                      <Link to={`/rubrique/${c.slug}`} className="cursor-pointer text-[13px] py-2">
                        <RubriqueIcon icon={c.icon} size={13} style={{ color: c.color }} />
                        {c.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })}
          <div className="flex-1" />
          {fmOn && (
            <Link
              to="/fm"
              className={cn(
                'flex items-center gap-2 h-11 px-3.5 text-[12px] font-bold uppercase tracking-[0.1em] border-b-2 border-t-2 border-transparent transition-colors',
                activeSeg0 === 'fm' ? 'border-b-tg-yellow text-tg-yellow' : 'text-tg-red hover:text-white',
              )}
            >
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-red opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tg-red" />
              </span>
              {settings.fmLabel || 'Top FM'}
            </Link>
          )}
          {tvOn && (
            <Link
              to="/tv"
              className={cn(
                'flex items-center gap-2 h-11 px-3.5 text-[12px] font-bold uppercase tracking-[0.1em] border-b-2 border-t-2 border-transparent transition-colors',
                activeSeg0 === 'tv' ? 'border-b-tg-yellow text-tg-yellow' : 'text-white/80 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              <Tv size={14} aria-hidden />
              {settings.tvLabel || 'TV'}
            </Link>
          )}
        </div>
      </nav>

      {/* ── Overlay de recherche plein écran ───────────────────── */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onSubmit={submitSearch} />

      {/* ── Menu mobile (Sheet) ────────────────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-sm p-0 bg-tg-navy-dark text-white border-white/10 overflow-y-auto tg-scroll tg-scroll-dark">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <div className="p-5 border-b border-white/10">
            <SheetClose asChild>
              <Link to="/" aria-label={`${settings.siteName} — accueil`} className="inline-flex">
                {/* Logotype officiel, version adaptée aux fonds sombres */}
                <Image
                  src="/brand/logo-lockup-dark.png"
                  alt={`${settings.siteName} — ${settings.slogan}`}
                  width={720}
                  height={413}
                  className="h-12 w-auto"
                />
              </Link>
            </SheetClose>
          </div>

          {/* Recherche mobile */}
          <form
            role="search"
            onSubmit={(e) => { e.preventDefault(); submitSearch() }}
            className="p-4 border-b border-white/10"
          >
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher sur le site"
                className="w-full h-11 rounded-sm bg-white/[0.07] border border-white/15 pl-10 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-tg-yellow/70"
              />
            </div>
          </form>

          {/* FM & TV */}
          {(fmOn || tvOn) && (
            <div className="px-4 py-3 border-b border-white/10">
              {fmOn && (
                <MobileNavLink to="/fm">
                  <span className="flex items-center gap-2.5 font-semibold text-[14px]">
                    <Radio size={16} className="text-tg-red" aria-hidden />
                    {settings.fmLabel || 'Top FM'} — Podcasts
                  </span>
                  <span className="h-2 w-2 rounded-full bg-tg-red animate-pulse" aria-hidden />
                </MobileNavLink>
              )}
              {tvOn && (
                <MobileNavLink to="/tv">
                  <span className="flex items-center gap-2.5 font-semibold text-[14px]">
                    <Tv size={16} className="text-tg-red" aria-hidden />
                    {settings.tvLabel || 'TV'} — Direct & vidéos
                  </span>
                  <span className="h-2 w-2 rounded-full bg-tg-red animate-pulse" aria-hidden />
                </MobileNavLink>
              )}
            </div>
          )}

          {/* Rubriques + sous-rubriques */}
          <nav aria-label="Rubriques" className="px-4 py-4 border-b border-white/10">
            <p className="tg-kicker text-white/40 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rotate-45 bg-tg-yellow" aria-hidden /> Rubriques
            </p>
            <MobileNavLink to="/">Accueil</MobileNavLink>
            {tops.map((r) => (
              <div key={r.id}>
                <MobileNavLink to={`/rubrique/${r.slug}`}>
                  <span className="flex items-center gap-2.5 font-semibold text-[14px]">
                    <RubriqueIcon icon={r.icon} size={15} style={{ color: r.color }} />
                    {r.menuLabel || r.name}
                  </span>
                </MobileNavLink>
                {(r.children || []).filter((c) => c.isActive).sort((a, b) => a.order - b.order).map((c) => (
                  <MobileNavLink key={c.id} to={`/rubrique/${c.slug}`} indent>
                    <span className="flex items-center gap-2.5 text-white/70 text-[13.5px]">
                      <RubriqueIcon icon={c.icon} size={13} style={{ color: c.color }} />
                      {c.name}
                    </span>
                  </MobileNavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Socials */}
          {socials.length > 0 && (
            <div className="px-4 py-4 border-b border-white/10">
              <p className="tg-kicker text-white/40 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rotate-45 bg-tg-yellow" aria-hidden /> Nous suivre
              </p>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.id}
                    href={safeHttpUrl(s.url) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.platform}
                    className="w-10 h-10 rounded-full border border-white/15 hover:bg-tg-yellow hover:text-tg-navy hover:border-tg-yellow flex items-center justify-center transition-colors"
                  >
                    <SocialIcon platform={s.platform} size={17} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Admin */}
          <div className="px-4 py-4">
            <button
              onClick={() => { setMobileOpen(false); onOpenAdmin() }}
              className="w-full h-11 rounded-sm border border-white/15 text-[13px] font-medium text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Settings2 size={15} aria-hidden /> Espace administrateur
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

// ─── Overlay de recherche plein écran ────────────────────────────────

function SearchOverlay({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void; onSubmit: (q: string) => void
}) {
  const [term, setTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[90] bg-tg-navy-dark/[0.985] flex flex-col tg-fade-up"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche sur le site"
    >
      <div className="tg-container flex justify-end pt-5">
        <button
          onClick={onClose}
          aria-label="Fermer la recherche"
          className="w-11 h-11 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/60 flex items-center justify-center transition-colors"
        >
          <X size={19} />
        </button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(term) }}
        className="flex-1 flex flex-col items-center justify-center px-6 pb-24 w-full max-w-3xl mx-auto"
      >
        <p className="tg-kicker text-tg-yellow flex items-center gap-3 mb-8">
          <span className="tg-flag-stripe" aria-hidden><i /></span>
          Recherche
          <span className="tg-flag-stripe" aria-hidden><i /></span>
        </p>
        <div className="relative w-full">
          <Search size={26} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none hidden sm:block" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Un sujet, un événement, une personnalité…"
            aria-label="Votre recherche"
            className="w-full bg-transparent border-0 border-b-2 border-white/20 focus:border-tg-yellow text-white font-display font-semibold text-[22px] sm:text-[32px] py-4 sm:pl-12 placeholder:text-white/25 focus:outline-none transition-colors"
          />
        </div>
        <p className="mt-5 text-[12px] text-white/35 tracking-wide">
          Appuyez sur <span className="text-white/70 font-semibold">Entrée</span> pour lancer la recherche
        </p>
      </form>
    </div>
  )
}

function HeaderNavItem({ to, active, label }: {
  to: string; active: boolean; label: string
}) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center h-11 px-3.5 text-[12px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-colors border-b-2 border-t-2 border-transparent',
        active ? 'border-b-tg-yellow text-tg-yellow' : 'text-white/80 hover:text-white hover:bg-white/[0.06]',
      )}
    >
      {label}
    </Link>
  )
}

function MobileNavLink({ to, children, indent }: {
  to: string; children: React.ReactNode; indent?: boolean
}) {
  return (
    <SheetClose asChild>
      <Link
        to={to}
        className={cn(
          'flex items-center justify-between min-h-[44px] rounded-sm px-3 text-[14px] hover:bg-white/[0.07] transition-colors',
          indent && 'pl-7',
        )}
      >
        {children}
      </Link>
    </SheetClose>
  )
}

// ─── Footer premium ──────────────────────────────────────────────────

function channelHref(c: ContactChannel): string | null {
  if (c.type === 'email') return `mailto:${c.value}`
  if (c.type === 'phone') return `tel:${c.value.replace(/\s/g, '')}`
  if (c.type === 'whatsapp') return `https://wa.me/${c.value.replace(/\D/g, '')}`
  return null
}

function FooterColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="tg-kicker text-white flex items-center gap-2 mb-5">
      <span className="w-2 h-2 rotate-45 bg-tg-red shrink-0" aria-hidden />
      {children}
    </p>
  )
}

function SiteFooter({ settings, contacts, socials, onOpenAdmin, fmOn, tvOn }: {
  settings: SiteSettings
  contacts: ContactChannel[]
  socials: SocialLink[]
  onOpenAdmin: () => void
  fmOn: boolean
  tvOn: boolean
}) {
  const rubriques = useRubriques()
  const { data: home } = useAsyncData(getHomeCached, 'home')
  const tops = (rubriques || []).filter((r) => !r.parentId && r.isActive).sort((a, b) => a.order - b.order).slice(0, 8)
  const activeContacts = contacts.filter((c) => c.isActive).sort((a, b) => a.order - b.order)

  return (
    <footer className="mt-auto bg-tg-navy-dark text-zinc-400" role="contentinfo">
      <div className="tg-tricolor-band" aria-hidden><i /></div>

      {/* Bannière pub footer */}
      {home?.ads?.footer && (
        <div className="tg-container pt-8">
          <div className="flex justify-center">
            <ImpressionBanner banner={home.ads.footer} position="footer" className="w-full max-w-[728px]" />
          </div>
        </div>
      )}

      <div className="tg-container py-12 md:py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-12">
        {/* Marque */}
        <div className="lg:col-span-4 pr-0 lg:pr-8">
          {/* Logotype officiel — version fond sombre (slogan inclus) */}
          <div>
            <Image
              src="/brand/logo-lockup-dark.png"
              alt={`${settings.siteName} — ${settings.slogan}`}
              width={720}
              height={413}
              className="h-20 lg:h-24 w-auto"
            />
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-zinc-500">
            {settings.seoDescription || `${settings.siteName}, votre média d'information de référence : politique, économie, société, sport et culture, en continu depuis la Guinée.`}
          </p>
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {socials.map((s) => (
                <a
                  key={s.id}
                  href={safeHttpUrl(s.url) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.platform}
                  title={s.platform}
                  className="w-10 h-10 rounded-full border border-white/15 text-zinc-400 hover:bg-tg-yellow hover:text-tg-navy hover:border-tg-yellow flex items-center justify-center transition-all duration-300 hover:-translate-y-0.5"
                >
                  <SocialIcon platform={s.platform} size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Rubriques */}
        <nav aria-label="Rubriques du site" className="lg:col-span-2">
          <FooterColumnTitle>Rubriques</FooterColumnTitle>
          <ul className="space-y-0.5 text-[13.5px]">
            {tops.map((r) => (
              <li key={r.id}>
                <Link to={`/rubrique/${r.slug}`} className="flex items-center gap-2 py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden />
                  {r.menuLabel || r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div className="lg:col-span-3">
          <FooterColumnTitle>Contact</FooterColumnTitle>
          <ul className="space-y-3 text-[13.5px]">
            {activeContacts.map((c) => {
              const href = channelHref(c)
              const Icon = c.type === 'email' ? Mail : c.type === 'phone' ? Phone : c.type === 'whatsapp' ? MessageCircle : c.type === 'address' ? MapPin : LifeBuoy
              return (
                <li key={c.id} className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-full border border-white/10 text-tg-yellow flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={12} aria-hidden />
                  </span>
                  {href ? (
                    <a href={href} target={c.type === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer" className="text-zinc-400 hover:text-tg-yellow transition-colors break-all py-1.5">
                      {c.value}
                    </a>
                  ) : (
                    <span className="text-zinc-400 break-all py-1.5">{c.value}</span>
                  )}
                </li>
              )
            })}
            {activeContacts.length === 0 && <li className="text-zinc-600">Contact disponible sur la page dédiée.</li>}
          </ul>
        </div>

        {/* Le média */}
        <div className="lg:col-span-3">
          <FooterColumnTitle>Le média</FooterColumnTitle>
          <ul className="space-y-0.5 text-[13.5px]">
            <li><Link to="/about" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">À propos de nous</Link></li>
            {fmOn && <li><Link to="/fm" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">{settings.fmLabel || 'Top FM'} — Podcasts</Link></li>}
            {tvOn && <li><Link to="/tv" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">{settings.tvLabel || 'TV'} — Direct & vidéos</Link></li>}
            <li><Link to="/contact" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">Nous contacter</Link></li>
            <li><Link to="/legal" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">Mentions légales</Link></li>
            <li><Link to="/privacy" className="block py-1.5 text-zinc-400 hover:text-tg-yellow transition-colors">Confidentialité</Link></li>
            <li>
              <button onClick={onOpenAdmin} className="py-1.5 text-zinc-600 hover:text-tg-yellow transition-colors inline-flex items-center gap-1.5">
                <Settings2 size={12} aria-hidden /> Espace admin
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Ligne finale */}
      <div className="border-t border-white/10">
        <div className="tg-container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-zinc-600">
          <p>© {new Date().getFullYear()} {settings.siteName} — Tous droits réservés</p>
          <p className="flex items-center gap-2.5">
            <span className="tg-flag-stripe" aria-hidden><i /></span>
            Fièrement conçu en Guinée
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Bouton retour en haut ───────────────────────────────────────────

function ScrollTopButton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Retour en haut de page"
      className={cn(
        'fixed bottom-6 right-6 z-50 w-11 h-11 rounded-sm bg-tg-navy text-white border border-white/10 shadow-xl flex items-center justify-center hover:bg-tg-red transition-all duration-300',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-3',
      )}
    >
      <ArrowUp size={19} aria-hidden />
    </button>
  )
}

// ─── Vue maintenance (settings.maintenance === 'on') ─────────────────

function MaintenanceView({ settings, contacts }: { settings: SiteSettings; contacts: ContactChannel[] }) {
  const email = contacts.find((c) => c.type === 'email' && c.isActive)?.value || 'topguinee.info@gmail.com'
  useEffect(() => {
    document.title = `Maintenance — ${settings.siteName}`
  }, [settings.siteName])
  return (
    <div className="min-h-screen bg-tg-navy-dark text-white flex flex-col items-center justify-center px-4 text-center tg-fade-up">
      <div className="tg-tricolor-band absolute top-0 left-0 right-0" aria-hidden><i /></div>
      <Image
        src="/brand/logo-lockup-dark.png"
        alt={`${settings.siteName} — ${settings.slogan}`}
        width={720}
        height={413}
        className="h-20 w-auto"
      />
      <h1 className="mt-6 font-display font-black text-2xl md:text-3xl tracking-tight">{settings.siteName}</h1>
      <div className="mt-10 flex items-center gap-4 rounded-sm border border-white/10 bg-white/[0.04] px-6 py-5 text-left max-w-md">
        <span className="w-11 h-11 rounded-full border border-tg-yellow/30 text-tg-yellow flex items-center justify-center shrink-0">
          <Wrench size={18} aria-hidden />
        </span>
        <div>
          <p className="font-display font-bold text-lg">Site en maintenance</p>
          <p className="text-[13.5px] text-zinc-400 mt-0.5">Nous peaufinons quelque chose de beau. Revenez très vite !</p>
        </div>
      </div>
      <a
        href={`mailto:${email}`}
        className="mt-9 inline-flex items-center gap-2 h-12 px-7 rounded-sm bg-tg-red hover:bg-tg-red-dark text-white text-sm font-semibold tracking-wide transition-colors min-h-[44px]"
      >
        <Mail size={15} aria-hidden /> Nous contacter par e-mail
      </a>
    </div>
  )
}

// ─── Vue 404 → voir ./not-found-view.tsx ─────────────────────────

// Section désactivée (FM ou TV masquée depuis les paramètres) — visiter
// l'URL directe n'est pas une erreur : on affiche un message élégant.
/** Redirection douce des anciens liens #/article/slug vers la page canonique. */
function LegacyArticleRedirect({ slug }: { slug: string }) {
  useEffect(() => {
    window.location.replace(`/article/${encodeURIComponent(slug)}`)
  }, [slug])
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center text-zinc-500">
      <p className="animate-pulse">Ouverture de l'article…</p>
    </div>
  )
}

function SectionUnavailable({ icon, label }: { icon: React.ReactNode; label: string }) {

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24" role="status">
      <div className="relative overflow-hidden rounded-sm border border-zinc-200 bg-tg-paper px-6 py-12 md:py-16 text-center tg-fade-up">
        <div className="tg-tricolor-band absolute top-0 left-0 right-0" aria-hidden><i /></div>
        <div className="mx-auto w-16 h-16 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-400">
          {icon}
        </div>
        <p className="mt-6 tg-kicker text-tg-red">Section momentanément indisponible</p>
        <h1 className="mt-3 font-display font-bold text-[26px] md:text-[32px] tracking-tight text-tg-navy">{label}</h1>
        <p className="mt-4 text-[14.5px] text-zinc-500 leading-relaxed max-w-md mx-auto">
          Cette rubrique est actuellement désactivée par la rédaction. Elle reviendra dès que
          nous aurons quelque chose de beau à vous partager.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center h-12 px-7 rounded-sm bg-tg-navy hover:bg-tg-red text-white text-sm font-semibold tracking-wide transition-colors min-h-[44px]"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
