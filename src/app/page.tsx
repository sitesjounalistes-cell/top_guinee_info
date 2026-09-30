'use client'
// Shell SPA Topguinee.info — point d'entrée unique (contrainte sandbox : 1 seule route /)
// Routeur à hash : #/ (site public) et #/admin/* (cockpit éditorial)
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { publicApi } from '@/lib/api'
import { useHashRoute, navigate } from '@/lib/router'
import type { SiteSettings, ContactChannel, SocialLink, FlashInfo } from '@/lib/types'
import { FrontOffice } from '@/components/front/front-office'
import { AdminApp } from '@/components/admin/admin-app'

interface GlobalData {
  settings: SiteSettings
  contacts: ContactChannel[]
  socials: SocialLink[]
  flash: FlashInfo[]
}

export default function Page() {
  const route = useHashRoute()
  const [globals, setGlobals] = useState<GlobalData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadGlobals = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([publicApi.settings(), publicApi.flash()])
      setGlobals({
        settings: s.settings,
        contacts: s.contacts,
        socials: s.socials,
        flash: f.flash,
      })
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const isAdmin = route.segments[0] === 'admin'

  // Chargé au montage ET rechargé à chaque transition admin ↔ site public :
  // les changements de paramètres (maintenance, FM/TV activée…) sont ainsi
  // visibles immédiatement dès le retour sur le site.
  useEffect(() => { loadGlobals() }, [isAdmin, loadGlobals])

  // Rafraîchit le ticker Flash toutes les 90 s (réactivité Flash Info §4.8)
  useEffect(() => {
    const t = setInterval(() => {
      publicApi.flash()
        .then((f) => setGlobals((g) => (g ? { ...g, flash: f.flash } : g)))
        .catch(() => {})
    }, 90_000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-tg-navy">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-2xl flex items-center justify-center overflow-hidden">
          <img src="/brand/logo-map.png" alt="Logo Topguinee.info" className="w-[70px] h-[70px] object-contain" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-white font-bold text-xl font-display">
            Topguinee<span className="text-tg-red">.</span><span className="text-tg-yellow">info</span>
          </p>
          <p className="text-zinc-400 text-xs italic">« L&apos;information au-delà du factuel »</p>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 size={15} className="animate-spin text-tg-yellow" /> Chargement…
        </div>
        <div className="tg-flag-stripe" aria-hidden><i /></div>
      </div>
    )
  }

  if (loadError || !globals) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-tg-gray px-6 text-center">
        <p className="text-4xl" aria-hidden>📡</p>
        <h1 className="text-xl font-bold text-tg-navy">Connexion impossible</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Le site n&apos;a pas réussi à joindre le serveur. Vérifiez votre connexion puis réessayez.
        </p>
        <button
          onClick={loadGlobals}
          className="mt-2 inline-flex items-center gap-2 bg-tg-red hover:bg-tg-red-dark text-white font-semibold px-5 py-3 rounded-xl transition-colors"
        >
          <Loader2 size={16} /> Réessayer
        </button>
      </div>
    )
  }

  if (isAdmin) {
    return (
      <AdminApp
        route={{ segments: route.segments, query: route.query }}
        onExitToSite={() => navigate('/')}
      />
    )
  }

  return (
    <FrontOffice
      route={{ segments: route.segments, query: route.query }}
      settings={globals.settings}
      contacts={globals.contacts}
      socials={globals.socials}
      flash={globals.flash}
      onOpenAdmin={() => navigate('/admin')}
    />
  )
}
