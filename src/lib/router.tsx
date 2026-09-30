'use client'
// Routeur SPA à hash — contrainte sandbox : une seule page / est servie.
// Syntaxe : #/ , #/rubrique/slug , #/fm , #/contact , #/about ,
//           #/legal , #/privacy , #/recherche?q=... , #/admin , #/admin/articles …
// EXCEPTION SEO : les articles disposent de vraies pages serveur
// (/article/slug — prérendues, métadonnées dynamiques, indexables).
// Tout lien/navigate() vers /article/… déclenche une navigation réelle.

import { useEffect, useState, useCallback } from 'react'

export interface Route {
  path: string       // ex: '/article/mon-slug'
  segments: string[] // ex: ['article','mon-slug']
  query: URLSearchParams
  raw: string
}

/** Chemins servis par de vraies pages Next.js (SSR/SEO) — pas de hash. */
export function isRealRoute(path: string): boolean {
  return path === '/article' || path.startsWith('/article/')
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  return {
    path,
    segments: path.split('/').filter(Boolean),
    query: new URLSearchParams(queryPart || ''),
    raw,
  }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined'
      ? { path: '/', segments: [], query: new URLSearchParams(), raw: '/' }
      : parseHash()
  )
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash())
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(to: string) {
  const clean = to.startsWith('/') ? to : `/${to}`
  // Vraie page (article) : navigation complète pour obtenir l'URL canonique
  if (isRealRoute(clean)) {
    window.location.assign(clean)
    return
  }
  if (window.location.hash === `#${clean}`) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = clean
  }
}

export function useNavigate() {
  return useCallback((to: string) => navigate(to), [])
}

export function Link({ to, children, className, title, ariaLabel, ariaCurrent, ariaDisabled, tabIndex, onClick, style }: {
  to: string
  children: React.ReactNode
  className?: string
  title?: string
  ariaLabel?: string
  ariaCurrent?: 'page' | 'step' | 'location' | true | false
  ariaDisabled?: boolean
  tabIndex?: number
  onClick?: () => void
  style?: React.CSSProperties
}) {
  // Article : lien réel (crawlers + partage d'URL canonique + OG dynamique)
  if (isRealRoute(to)) {
    return (
      <a
        href={to}
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        aria-disabled={ariaDisabled || undefined}
        tabIndex={tabIndex}
        style={style}
        onClick={onClick}
      >
        {children}
      </a>
    )
  }
  return (
    <a
      href={`#${to}`}
      className={className}
      title={title}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-disabled={ariaDisabled || undefined}
      tabIndex={tabIndex}
      style={style}
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
