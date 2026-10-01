'use client'
// i18n côté client : langue courante persistée (localStorage + cookie),
// direction d'écriture (arabe = RTL) et hook de traduction.
// Le changement de langue recharge la page : les API publiques reçoivent
// ?lang=… et la page article SSR lit le cookie — tout le site est servi
// dans la langue choisie, interface ET contenus.

import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_LANG, getDict, isLang, langDir, type Dict, type LangCode } from './dicts'

const STORAGE_KEY = 'tg_lang'
const COOKIE = 'tg_lang'

function readInitial(): LangCode {
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const m = /(?:^|;\s*)tg_lang=([a-z]{2})/.exec(document.cookie)
    const stored = window.localStorage.getItem(STORAGE_KEY) || (m ? m[1] : '')
    if (isLang(stored) && stored) return stored
    // Sinon : langue du navigateur si gérée
    const nav = (navigator.language || '').slice(0, 2).toLowerCase()
    if (isLang(nav)) return nav
  } catch { /* accès refusé : français */ }
  return DEFAULT_LANG
}

let current: LangCode = readInitial()
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): LangCode {
  return current
}

/** Langue courante hors React (pour les appels API). */
export function currentLang(): LangCode {
  if (current === DEFAULT_LANG && typeof window !== 'undefined') {
    // première lecture avant initialisation du store
    current = readInitial()
  }
  return current
}

export function setLang(lang: LangCode) {
  if (lang === current) return
  current = lang
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
    document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
  } catch { /* stockage indisponible */ }
  for (const fn of listeners) fn()
  // Recharge toutes les données dans la nouvelle langue (SPA + pages SSR)
  window.location.reload()
}

/** Applique lang/dir sur <html> (appelé au démarrage du shell). */
export function applyDocumentLang(lang: LangCode) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dir = langDir(lang)
}

export function useI18n(): { lang: LangCode; t: Dict; changeLang: (l: LangCode) => void } {
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LANG)
  const changeLang = useCallback((l: LangCode) => setLang(l), [])
  return { lang, t: getDict(lang), changeLang }
}
