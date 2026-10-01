'use client'
// Sélecteur de langue du site public — FR / EN / ES / IT / AR / ZH.
// Le changement recharge la page : l'interface est traduite par les
// dictionnaires, les contenus par le serveur (cache en base).

import { LANGS, type LangCode } from '@/lib/i18n/dicts'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Languages } from 'lucide-react'

export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, t, changeLang } = useI18n()

  return (
    <label
      className={cn(
        'inline-flex items-center gap-1.5 select-none',
        compact ? 'text-zinc-500 hover:text-tg-yellow' : 'text-zinc-400 hover:text-tg-yellow',
      )}
      title={`${t.language} — ${t.translationNotice}`}
    >
      <Languages size={14} aria-hidden />
      <select
        value={lang}
        onChange={(e) => changeLang(e.target.value as LangCode)}
        className="bg-transparent border-none outline-none cursor-pointer text-[11.5px] font-medium tracking-wide"
        style={compact ? { color: 'inherit' } : { color: 'inherit' }}
        aria-label={t.language}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="text-tg-navy bg-white">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
