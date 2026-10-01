'use client'
// Composants et utilitaires partagés du back-office Topguinee.info (§7)
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon } from 'lucide-react'
import { CloudUpload, FileAudio, Inbox, Loader2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/lib/api'
import { FadeImage } from '@/components/tg/shared'
import { sanitizeInline, stripHtml, type FontClass } from '@/lib/sanitize'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Briefcase, Camera, Coins, Flag, GraduationCap, Heart, Laptop, Leaf,
  Megaphone, Mic, Newspaper, Palette, Trophy, Users,
} from 'lucide-react'


// ─── Champ court enrichi : gras / italique / souligné / police ────

const FONT_CHOICES: { value: FontClass; label: string }[] = [
  { value: 'font-sans', label: 'Sans (Inter)' },
  { value: 'font-display', label: 'Éditorial (Playfair)' },
  { value: 'font-serif', label: 'Serif (Georgia)' },
  { value: 'font-mono', label: 'Mono' },
]

/**
 * Champ texte court avec mise en forme : titre, sous-titre, description…
 * Le HTML produit ne contient QUE des balises inline autorisées
 * (liste blanche) ; le champ est assaini au chargement et à la sortie.
 */
export function RichInput({ value, onChange, placeholder, ariaLabel, multiline = false, className, maxLengthPlainText }: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  ariaLabel?: string
  multiline?: boolean
  className?: string
  maxLengthPlainText?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string>('')

  // Resynchronise le DOM uniquement pour les changements EXTERNES
  // (chargement d'un article) — jamais pendant la frappe (curseur stable).
  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = sanitizeInline(value)
      lastEmitted.current = value
    }
  }, [value])

  const emit = () => {
    const html = ref.current?.innerHTML || ''
    lastEmitted.current = html
    onChange(html)
  }

  const exec = (cmd: string) => {
    ref.current?.focus()
    document.execCommand(cmd)
    emit()
  }

  /** Enveloppe la sélection dans un span portant la famille choisie. */
  const applyFont = (font: FontClass) => {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      toast.info("Sélectionnez d'abord le texte à mettre en forme.")
      return
    }
    const range = sel.getRangeAt(0)
    const fragment = range.extractContents()
    const span = document.createElement('span')
    span.className = font
    span.appendChild(fragment)
    range.insertNode(span)
    sel.removeAllRanges()
    emit()
  }

  const TOOL_BTN = 'h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-tg-navy hover:bg-tg-gray hover:text-tg-red transition-colors'

  return (
    <div className={cn('group/rich', className)} data-rich-field={ariaLabel}>
      <div
        className="flex items-center gap-0.5 pb-1 opacity-0 focus-within:opacity-100 group-hover/rich:opacity-60 transition-opacity"
      >
        <button type="button" className={TOOL_BTN} title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><BoldIcon size={14} /></button>
        <button type="button" className={TOOL_BTN} title="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><ItalicIcon size={14} /></button>
        <button type="button" className={TOOL_BTN} title="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><UnderlineIcon size={14} /></button>
        <span className="w-px h-4 bg-zinc-200 mx-0.5" aria-hidden />
        <select
          className="h-7 text-[12px] rounded-md border border-zinc-200 bg-white px-1.5 text-tg-navy hover:border-tg-red/40 cursor-pointer"
          title="Famille de police"
          defaultValue=""
          onChange={(e) => { if (e.target.value) applyFont(e.target.value as FontClass); e.target.selectedIndex = 0 }}
        >
          <option value="" disabled>Police…</option>
          {FONT_CHOICES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div
        ref={ref}
        className="rich-input w-full min-w-0 outline-none whitespace-pre-wrap break-words"
        style={multiline ? { minHeight: '5.5rem' } : undefined}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline || undefined}
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={() => {
          // Assainit les collages (Word, web) dès la sortie du champ
          const clean = sanitizeInline(ref.current?.innerHTML || '')
          if (ref.current) ref.current.innerHTML = clean
          lastEmitted.current = clean
          onChange(clean)
        }}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') e.preventDefault()
          if (maxLengthPlainText) {
            const plain = stripHtml(ref.current?.innerText || '')
            if (plain.length >= maxLengthPlainText && e.key !== 'Backspace' && e.key !== 'Delete' &&
                !e.ctrlKey && !e.metaKey && e.key.length === 1) {
              e.preventDefault()
            }
          }
        }}
        onPaste={(e) => {
          // Coller en texte brut : jamais de styles/HTML externes involontaires
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
      />
    </div>
  )
}

// ─── Carte statistique (§7.1) ─────────────────────────────────────

export type StatTone = 'red' | 'green' | 'yellow' | 'navy'

const TONE_STYLE: Record<StatTone, { bg: string; text: string }> = {
  red: { bg: 'bg-tg-red/10', text: 'text-tg-red' },
  green: { bg: 'bg-tg-green/10', text: 'text-tg-green' },
  yellow: { bg: 'bg-tg-yellow/25', text: 'text-yellow-700' },
  navy: { bg: 'bg-tg-navy/8', text: 'text-tg-navy' },
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'navy' }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string; value: React.ReactNode; hint?: string; tone?: StatTone
}) {
  const t = TONE_STYLE[tone]
  return (
    <div className="bg-card rounded-2xl border border-zinc-200 p-4 flex items-start gap-3.5 tg-card-hover">
      <div className={cn('shrink-0 w-11 h-11 rounded-xl flex items-center justify-center', t.bg, t.text)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold text-tg-navy leading-tight tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  )
}

// ─── État vide ────────────────────────────────────────────────────

export function EmptyState({ icon: Icon = Inbox, title, description, action }: {
  icon?: React.ComponentType<{ size?: number; className?: string }>
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-2">
      <div className="w-14 h-14 rounded-2xl bg-tg-gray flex items-center justify-center text-zinc-400 mb-1">
        <Icon size={26} />
      </div>
      <p className="font-semibold text-tg-navy">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// ─── En-tête de section ───────────────────────────────────────────

export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-tg-navy font-display">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ─── Squelettes de chargement ─────────────────────────────────────

export function LinesSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 rounded-lg bg-zinc-100 animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[86px] rounded-2xl bg-zinc-100 animate-pulse" style={{ animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  )
}

// ─── Debounce ─────────────────────────────────────────────────────

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Dates : ISO ↔ datetime-local ─────────────────────────────────

export function toInputDate(d?: string | Date | null): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function fromInputDate(v: string): string | undefined {
  if (!v) return undefined
  const dt = new Date(v)
  return isNaN(dt.getTime()) ? undefined : dt.toISOString()
}

// ─── Zone d'upload image (drag & drop §7.5) ───────────────────────

export function ImageDropzone({ value, onChange, alt, onAltChange, aspect = 'aspect-video', label = 'Image de couverture', hint = 'PNG, JPG ou WebP — 5 Mo max' }: {
  value?: string | null
  onChange: (url: string | null) => void
  alt?: string
  onAltChange?: (alt: string) => void
  aspect?: string
  label?: string
  hint?: string
}) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file?: File | null) => {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) { setError('Fichier non reconnu : choisissez une image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image trop lourde (5 Mo maximum).'); return }
    setBusy(true)
    try {
      const res = await uploadFile(file, 'image')
      onChange(res.url)
      if (res.warning) toast.warning('Image importée avec réserve', { description: res.warning })
      else if (res.provider === 'cloudinary') toast.success('Image transférée sur Cloudinary')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'envoi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-tg-navy">{label}</Label>
      {value ? (
        <div className="space-y-2">
          <div className={cn('relative w-full rounded-xl overflow-hidden border border-zinc-200 group', aspect)}>
            <FadeImage src={value} alt={alt || label} fill sizes="600px" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 bg-tg-red text-white rounded-full p-1.5 shadow-md hover:bg-tg-red-dark transition-colors"
              aria-label="Supprimer l'image"
            >
              <X size={14} />
            </button>
          </div>
          {onAltChange && (
            <div>
              <Label htmlFor="img-alt" className="text-xs text-muted-foreground">Texte alternatif (accessibilité)</Label>
              <Input id="img-alt" value={alt || ''} onChange={(e) => onAltChange(e.target.value)} placeholder="Décrivez l'image…" className="mt-1 h-9" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={cn(
            'w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer',
            drag ? 'border-tg-green bg-tg-green/5' : 'border-zinc-300 hover:border-tg-red hover:bg-tg-gray/60'
          )}
        >
          {busy ? <Loader2 size={26} className="text-tg-red animate-spin" /> : <CloudUpload size={26} className="text-zinc-400" />}
          <span className="text-sm font-medium text-tg-navy">{busy ? 'Envoi en cours…' : 'Glissez une image ici ou cliquez pour parcourir'}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </button>
      )}
      {error && <p className="text-xs text-tg-red font-medium">{error}</p>}
      <input
        ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}

// ─── Zone d'upload audio (drag & drop §7.6) ───────────────────────

export function AudioDropzone({ value, onChange }: {
  value?: string | null
  onChange: (url: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file?: File | null) => {
    if (!file) return
    setError('')
    if (!/^(audio|video)\//.test(file.type) && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)) {
      setError('Fichier non reconnu : choisissez un fichier audio (MP3, WAV…).'); return
    }
    if (file.size > 60 * 1024 * 1024) { setError('Fichier audio trop lourd (60 Mo maximum).'); return }
    setBusy(true)
    try {
      const res = await uploadFile(file, 'audio')
      onChange(res.url)
      if (res.warning) toast.warning('Audio importé avec réserve', { description: res.warning })
      else if (res.provider === 'drive') toast.success('Audio transféré sur Google Drive')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'envoi.')
    } finally {
      setBusy(false)
    }
  }

  if (value) {
    return (
      <div className="rounded-xl border border-tg-green/40 bg-tg-green/5 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-tg-green/15 text-tg-green flex items-center justify-center shrink-0">
          <FileAudio size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-tg-green">Fichier audio chargé</p>
          <p className="text-[11px] text-muted-foreground truncate">{value}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>Remplacer</Button>
          <Button type="button" variant="ghost" size="icon" className="text-tg-red hover:text-tg-red hover:bg-tg-red/10" onClick={() => onChange(null)} aria-label="Retirer le fichier">
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
        className={cn(
          'w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer',
          drag ? 'border-tg-green bg-tg-green/5' : 'border-zinc-300 hover:border-tg-red hover:bg-tg-gray/60'
        )}
      >
        {busy ? <Loader2 size={24} className="text-tg-red animate-spin" /> : <FileAudio size={24} className="text-zinc-400" />}
        <span className="text-sm font-medium text-tg-navy">{busy ? 'Envoi en cours…' : 'Glissez le fichier audio ici ou cliquez'}</span>
        <span className="text-xs text-muted-foreground">MP3, WAV, M4A — 60 Mo max</span>
      </button>
      {error && <p className="text-xs text-tg-red font-medium">{error}</p>}
      <input
        ref={inputRef} type="file" accept="audio/*" className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}

// ─── Icônes de rubrique (§7.4) ────────────────────────────────────

export const RUBRIQUE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  newspaper: Newspaper, globe: Flag, coins: Coins, users: Users, trophy: Trophy,
  palette: Palette, laptop: Laptop, heart: Heart, leaf: Leaf, mic: Mic,
  camera: Camera, briefcase: Briefcase, 'graduation-cap': GraduationCap, megaphone: Megaphone,
}

export const RUBRIQUE_ICON_NAMES = Object.keys(RUBRIQUE_ICONS)

export function RubriqueIcon({ name, size = 16, className }: { name?: string | null; size?: number; className?: string }) {
  const Icon = (name && RUBRIQUE_ICONS[name]) || Newspaper
  return <Icon size={size} className={className} />
}

// ─── Palette de couleurs charte (§7.4) ────────────────────────────

export const CHART_COLORS = [
  '#D21034', '#FCD116', '#009460', '#14213D', '#a80c28', '#00734b',
  '#e37222', '#7c5cbf', '#0e7490', '#be185d', '#4d7c0f', '#b45309',
]

// ─── Export CSV client-side (§7.7) ────────────────────────────────

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── Initiales avatar ─────────────────────────────────────────────

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHIEF_EDITOR: 'Rédacteur en chef',
  JOURNALIST: 'Journaliste',
}
