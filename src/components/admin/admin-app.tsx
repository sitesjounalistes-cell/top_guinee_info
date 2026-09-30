'use client'
// Cockpit éditorial Topguinee.info — application back-office complète (§7)
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, UNAUTHORIZED_EVENT } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { TgUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { LoginView } from './login-view'
import { Overview } from './overview'
import { ArticlesList } from './articles-list'
import { ArticleEditor } from './article-editor'
import { FeaturedManager } from './featured-manager'
import { FlashManager } from './flash-manager'
import { RubriquesManager } from './rubriques-manager'
import { FMManager } from './fm-manager'
import { ContactsManager } from './contacts-manager'
import { MessagesInbox } from './messages-inbox'
import { AdsManager } from './ads-manager'
import { StatsView } from './stats-view'
import { SettingsView } from './settings-view'
import { LogsView } from './logs-view'
import { initials, ROLE_LABELS } from './admin-shared'
import {
  BarChart3, ExternalLink, FileText, FolderTree, History, Inbox, LayoutDashboard,
  Loader2, LogOut, Megaphone, Menu, Phone, Radio, Search, Settings, Star, Zap,
} from 'lucide-react'

// ─── Navigation du back-office ────────────────────────────────────
// minRole reflète exactement le contrôle d'accès serveur (§7.1) :
//  • JOURNALIST    : vue d'ensemble, ses articles, statistiques
//  • CHIEF_EDITOR  : tout le contenu — pas les paramètres ni le journal
//  • ADMIN         : tout

const ROLE_RANK: Record<string, number> = { JOURNALIST: 1, CHIEF_EDITOR: 2, ADMIN: 3 }

function hasMinRole(role: string | undefined, min: 'CHIEF_EDITOR' | 'ADMIN'): boolean {
  return (ROLE_RANK[role || ''] || 0) >= ROLE_RANK[min]
}

const NAV_ITEMS: { to: string; section: string; label: string; minRole?: 'CHIEF_EDITOR' | 'ADMIN'; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { to: '/admin', section: '', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { to: '/admin/articles', section: 'articles', label: 'Articles', icon: FileText },
  { to: '/admin/a-la-une', section: 'a-la-une', label: 'À la Une', icon: Star, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/flash', section: 'flash', label: 'Flash Info', icon: Zap, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/rubriques', section: 'rubriques', label: 'Rubriques', icon: FolderTree, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/fm', section: 'fm', label: 'FM & Podcasts', icon: Radio, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/contacts', section: 'contacts', label: 'Contacts', icon: Phone, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/messages', section: 'messages', label: 'Messagerie', icon: Inbox, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/publicite', section: 'publicite', label: 'Publicité', icon: Megaphone, minRole: 'CHIEF_EDITOR' },
  { to: '/admin/statistiques', section: 'statistiques', label: 'Statistiques', icon: BarChart3 },
  { to: '/admin/parametres', section: 'parametres', label: 'Paramètres', icon: Settings, minRole: 'ADMIN' },
  { to: '/admin/journal', section: 'journal', label: 'Journal d\'activité', icon: History, minRole: 'ADMIN' },
]

/** L'utilisateur courant peut-il ouvrir cette section ? (miroir du serveur) */
function canAccessSection(section: string, role: string | undefined): boolean {
  const item = NAV_ITEMS.find((i) => i.section === section)
  if (!item) return true // section inconnue → page d'erreur standard
  return !item.minRole || hasMinRole(role, item.minRole)
}

const SECTION_TITLES: Record<string, string> = {
  '': 'Vue d\'ensemble',
  articles: 'Articles',
  'a-la-une': 'À la Une',
  flash: 'Flash Info',
  rubriques: 'Rubriques',
  fm: 'FM & Podcasts',
  contacts: 'Contacts & réseaux sociaux',
  messages: 'Messagerie',
  publicite: 'Publicité',
  statistiques: 'Statistiques',
  parametres: 'Paramètres',
  journal: 'Journal d\'activité',
}

// ─── Sous-composants de layout (déclarés hors rendu) ──────────────

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-2">
      <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
        <img src="/brand/logo-map.png" alt="" className="w-7 h-7 object-contain" />
      </span>
      <div className="min-w-0">
        <p className="text-white font-bold font-display leading-tight truncate">Topguinee<span className="text-tg-red">.</span><span className="text-tg-yellow">info</span></p>
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Cockpit éditorial</p>
      </div>
    </div>
  )
}

function AdminNav({ activeSection, unread, role, onNavigate }: {
  activeSection: string; unread: number; role: string; onNavigate?: () => void
}) {
  const items = NAV_ITEMS.filter((i) => !i.minRole || hasMinRole(role, i.minRole))
  return (
    <nav className="flex-1 overflow-y-auto tg-scroll px-3 py-4 space-y-0.5" aria-label="Navigation du back-office">
      {items.map((item) => {
        const active = activeSection === item.section
        return (
          <a
            key={item.section}
            href={`#${item.to}`}
            onClick={(e) => { e.preventDefault(); navigate(item.to); onNavigate?.() }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              active
                ? 'bg-tg-red text-white shadow-md'
                : 'text-zinc-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <item.icon size={17} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.section === 'messages' && unread > 0 && (
              <span className="bg-tg-yellow text-tg-navy text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </a>
        )
      })}
    </nav>
  )
}

function AdminUserCard({ user, onExitToSite, onLogout }: {
  user: TgUser; onExitToSite: () => void; onLogout: () => void
}) {
  return (
    <div className="p-3 border-t border-white/10 space-y-2">
      <div className="flex items-center gap-2.5 px-1">
        <span className="w-9 h-9 rounded-full bg-tg-yellow text-tg-navy font-bold text-sm flex items-center justify-center shrink-0">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user.name}</p>
          <p className="text-[11px] text-zinc-400 truncate">{ROLE_LABELS[user.role] || user.role}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={onExitToSite}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-medium py-2 transition-colors"
        >
          <ExternalLink size={13} /> Voir le site
        </button>
        <button
          onClick={onLogout}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-tg-red/90 hover:bg-tg-red text-white text-xs font-medium py-2 transition-colors"
        >
          <LogOut size={13} /> Déconnexion
        </button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────

export function AdminApp({ route, onExitToSite }: {
  route: { segments: string[]; query: URLSearchParams }
  onExitToSite: () => void
}) {
  const [user, setUser] = useState<TgUser | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'anon' | 'auth'>('loading')
  const [unread, setUnread] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const isAdminRoute = route.segments[0] === 'admin'
  const section = route.segments[1] || ''
  const subSection = route.segments[2] || ''

  // Vérification de session au montage
  useEffect(() => {
    if (!isAdminRoute) return
    let cancelled = false
    adminApi.me()
      .then((r) => { if (!cancelled) { setUser(r.user); setAuthState('auth') } })
      .catch(() => { if (!cancelled) setAuthState('anon') })
    return () => { cancelled = true }
  }, [isAdminRoute])

  // Session expirée en cours de travail (12 h, ou cookie invalide) :
  // toute requête authentifiée qui reçoit 401 rebascule vers le login,
  // avec un message explicite — plus d'échecs silencieux d'autosave.
  useEffect(() => {
    if (!isAdminRoute) return
    const onUnauthorized = () => {
      setUser((current) => {
        if (current) {
          toast.error('Session expirée', { description: 'Reconnectez-vous pour continuer — vos brouillons en cours sont conservés localement.' })
        }
        return null
      })
      setAuthState((s) => (s === 'auth' ? 'anon' : s))
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [isAdminRoute])

  // Badge messages non lus (relancé par la messagerie après action)
  const refreshBadges = useCallback(() => {
    if (authState !== 'auth') return
    adminApi.overview()
      .then((o) => setUnread(o.cards.messagesUnread || 0))
      .catch(() => {})
  }, [authState])

  useEffect(() => {
    refreshBadges()
  }, [refreshBadges, section])

  const handleLoggedIn = (u: TgUser) => {
    setUser(u)
    setAuthState('auth')
    navigate('/admin')
  }

  const handleLogout = async () => {
    try { await adminApi.logout() } catch { /* session déjà expirée */ }
    toast.success('Déconnexion effectuée', { description: 'À bientôt sur Topguinee.info !' })
    setUser(null)
    setAuthState('anon')
    setUnread(0)
    navigate('/admin')
  }

  // Hors route admin : ne rien rendre (géré par le front-office)
  if (!isAdminRoute) return null

  // Écran de chargement de session
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-tg-navy-dark via-tg-navy to-tg-navy-light flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-2xl flex items-center justify-center overflow-hidden">
          <img src="/brand/logo-map.png" alt="Logo Topguinee.info" className="w-12 h-12 object-contain" />
        </div>
        <div className="flex items-center gap-2.5 text-zinc-300 text-sm">
          <Loader2 size={16} className="animate-spin text-tg-yellow" /> Vérification de la session…
        </div>
        <Toaster richColors position="top-right" closeButton />
      </div>
    )
  }

  // Non connecté
  if (authState === 'anon' || !user) {
    return (
      <div>
        <LoginView onLoggedIn={handleLoggedIn} onExitToSite={onExitToSite} />
        <Toaster richColors position="top-right" closeButton />
      </div>
    )
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/admin/articles${searchQ.trim() ? `?q=${encodeURIComponent(searchQ.trim())}` : ''}`)
  }

  const renderSection = () => {
    // Contrôle d'accès côté client (miroir du serveur) : un rôle non
    // habilité qui ouvre l'URL directement voit un écran d'information.
    if (!canAccessSection(section, user.role)) {
      return (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="font-bold text-tg-navy text-lg">Accès restreint</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Votre rôle ({ROLE_LABELS[user.role] || user.role}) ne permet pas d&apos;ouvrir cette section.
            Contactez un administrateur si vous pensez que c&apos;est une erreur.
          </p>
          <Button onClick={() => navigate('/admin')} className="mt-4 bg-tg-red hover:bg-tg-red-dark text-white">Retour au tableau de bord</Button>
        </div>
      )
    }
    switch (section) {
      case '':
        return <Overview />
      case 'articles':
        if (subSection === 'new') return <ArticleEditor key="new" user={user} />
        if (subSection === 'edit') return <ArticleEditor key={`edit-${route.query.get('id') || ''}`} id={route.query.get('id')} user={user} />
        return <ArticlesList key={route.query.get('q') || ''} initialQ={route.query.get('q') || undefined} />
      case 'a-la-une': return <FeaturedManager />
      case 'flash': return <FlashManager />
      case 'rubriques': return <RubriquesManager />
      case 'fm': return <FMManager />
      case 'contacts': return <ContactsManager />
      case 'messages': return <MessagesInbox refreshBadges={refreshBadges} />
      case 'publicite': return <AdsManager />
      case 'statistiques': return <StatsView />
      case 'parametres': return <SettingsView />
      case 'journal': return <LogsView />
      default:
        return (
          <div className="py-20 text-center">
            <p className="text-4xl mb-3">🧭</p>
            <h2 className="font-bold text-tg-navy text-lg">Section introuvable</h2>
            <p className="text-sm text-muted-foreground mt-1">« /admin/{section} » n&apos;existe pas.</p>
            <Button onClick={() => navigate('/admin')} className="mt-4 bg-tg-red hover:bg-tg-red-dark text-white">Retour au tableau de bord</Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-tg-gray/60 flex">
      <Toaster richColors position="top-right" closeButton />

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-tg-navy shrink-0 fixed inset-y-0 left-0 z-30">
        <BrandLogo />
        <AdminNav activeSection={section} unread={unread} role={user.role} />
        <AdminUserCard user={user} onExitToSite={onExitToSite} onLogout={handleLogout} />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-zinc-200">
          <div className="flex items-center gap-3 px-4 md:px-6 h-16">
            {/* Menu mobile */}
            <Sheet open={mobileNav} onOpenChange={setMobileNav}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="lg:hidden text-tg-navy" aria-label="Ouvrir le menu">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 bg-tg-navy border-r-0">
                <SheetHeader className="p-0">
                  <SheetTitle className="sr-only">Menu du back-office</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  <BrandLogo />
                  <AdminNav activeSection={section} unread={unread} role={user.role} onNavigate={() => setMobileNav(false)} />
                  <AdminUserCard user={user} onExitToSite={onExitToSite} onLogout={handleLogout} />
                </div>
              </SheetContent>
            </Sheet>

            <h1 className="font-bold text-tg-navy font-display text-base md:text-lg truncate">
              {SECTION_TITLES[section] || 'Back-office'}
            </h1>

            {/* Recherche globale */}
            <form onSubmit={submitSearch} className="ml-auto relative w-full max-w-xs hidden sm:block" role="search">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Rechercher un article…"
                className="pl-9 h-9 text-sm bg-tg-gray/70 border-transparent focus-visible:bg-white"
                aria-label="Recherche globale d'articles"
              />
            </form>

            <button
              onClick={onExitToSite}
              className="ml-auto sm:ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-tg-green hover:text-tg-green-dark border border-tg-green/40 rounded-lg px-2.5 py-2 transition-colors shrink-0"
            >
              <ExternalLink size={13} /> <span className="hidden md:inline">Voir le site</span>
            </button>
          </div>
          {/* Liseré charte */}
          <div className="h-0.5 flex" aria-hidden>
            <div className="flex-[3] bg-tg-red" />
            <div className="flex-1 bg-tg-yellow" />
            <div className="flex-1 bg-tg-green" />
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 tg-fade-up" key={`${section}/${subSection}/${route.query.get('id') || route.query.get('q') || ''}`}>
          {renderSection()}
        </main>

        <footer className="px-6 py-4 text-center text-[11px] text-zinc-400">
          Topguinee.info — Cockpit éditorial · « L&apos;information au sommet de l&apos;actualité »
        </footer>
      </div>
    </div>
  )
}
