'use client'
// Gestion de la Une — sélection manuelle éditoriale (§4.7, §7.4)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import type { ArticleCardData } from '@/lib/types'
import { FadeImage } from '@/components/tg/shared'
import { EmptyState, LinesSkeleton, PageHeader, useDebounced } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ArrowDown, ArrowUp, Check, Crown, ListPlus, RefreshCw, Save, Search, Star, X,
} from 'lucide-react'

const MAX_SECONDARY = 6

export function FeaturedManager() {
  const [main, setMain] = useState<ArticleCardData | null>(null)
  const [secondary, setSecondary] = useState<ArticleCardData[]>([])
  const [candidates, setCandidates] = useState<ArticleCardData[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const mountedRef = useRef(false)

  const dq = useDebounced(q, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.featured()
      setMain(res.main)
      setSecondary(res.secondary || [])
      setCandidates(res.candidates || [])
    } catch (e) {
      toast.error('Impossible de charger la Une', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const filtered = candidates.filter((a) =>
    !dq || a.title.toLowerCase().includes(dq.toLowerCase()) || (a.rubrique?.name || '').toLowerCase().includes(dq.toLowerCase())
  )

  const promoteMain = (a: ArticleCardData) => {
    if (main?.id === a.id) return
    const oldMain = main
    setMain(a)
    setSecondary((s) => s.filter((x) => x.id !== a.id))
    if (oldMain) setSecondary((s) => [...s, oldMain].slice(0, MAX_SECONDARY))
    setJustSaved(false)
  }

  const addSecondary = (a: ArticleCardData) => {
    if (secondary.length >= MAX_SECONDARY) {
      toast.warning(`Maximum ${MAX_SECONDARY} articles secondaires.`, { description: 'Retirez un article avant d\'en ajouter un autre.' })
      return
    }
    setSecondary((s) => [...s, a])
    setJustSaved(false)
  }

  const removeSecondary = (id: string) => {
    setSecondary((s) => s.filter((x) => x.id !== id))
    setJustSaved(false)
  }

  const moveSecondary = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= secondary.length) return
    const next = [...secondary]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSecondary(next)
    setJustSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      await adminApi.setFeatured(main?.id ?? null, secondary.map((a) => a.id))
      toast.success('Une enregistrée', {
        description: main ? `Article principal : « ${main.title} » + ${secondary.length} secondaire(s).` : 'Aucun article principal sélectionné.',
      })
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 4000)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const dirty = justSaved

  if (loading) {
    return (
      <div>
        <PageHeader title="À la Une" description="Chargement de la sélection éditoriale…" />
        <LinesSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="À la Une"
        description="Sélection manuelle : 1 article principal + jusqu'à 6 articles secondaires, ordre éditorial."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
              <RefreshCw size={15} /> Actualiser
            </Button>
            <Button
              onClick={save} disabled={saving}
              className={cn('text-white font-semibold', dirty ? 'bg-tg-green hover:bg-tg-green-dark' : 'bg-tg-red hover:bg-tg-red-dark')}
            >
              {saving ? <><span className="animate-spin"><RefreshCw size={15} /></span> Enregistrement…</> : <><Save size={15} /> Enregistrer la Une</>}
            </Button>
          </>
        }
      />

      {justSaved && (
        <div className="rounded-xl border border-tg-green/40 bg-tg-green/10 text-tg-green-dark text-sm font-medium px-4 py-2.5 flex items-center gap-2">
          <Check size={16} /> La nouvelle Une est en ligne sur la page d&apos;accueil.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Sélection actuelle */}
        <div className="space-y-5">
          <section className="bg-card rounded-2xl border border-zinc-200 p-4">
            <h2 className="font-bold text-tg-navy flex items-center gap-2 mb-3">
              <Crown size={16} className="text-tg-yellow" /> Article principal
              <Badge className="ml-1 bg-tg-yellow/20 text-yellow-800 border-tg-yellow/50 border">1 maximum</Badge>
            </h2>
            {main ? (
              <div className="rounded-xl border border-tg-yellow/60 overflow-hidden">
                <div className="relative aspect-[16/7]">
                  <FadeImage src={main.coverImage} alt={main.coverAlt || main.title} fill sizes="500px" />
                  <span className="absolute top-2 left-2 bg-tg-yellow text-tg-navy text-[10px] font-bold uppercase px-2 py-1 rounded">À la Une</span>
                  <button
                    onClick={() => { setMain(null); setJustSaved(false) }}
                    className="absolute top-2 right-2 bg-tg-red text-white rounded-full p-1.5 shadow hover:bg-tg-red-dark transition-colors"
                    aria-label="Retirer l'article principal"
                  ><X size={13} /></button>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-tg-navy text-sm line-clamp-2">{main.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{main.rubrique?.name || '—'} · {fmt.date(main.publishedAt)}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-muted-foreground">
                Aucun article principal. Choisissez-en un dans les candidats →
              </div>
            )}
          </section>

          <section className="bg-card rounded-2xl border border-zinc-200 p-4">
            <h2 className="font-bold text-tg-navy flex items-center gap-2 mb-3">
              <Star size={16} className="text-tg-red" /> Articles secondaires
              <Badge variant="outline" className={cn('ml-1', secondary.length >= MAX_SECONDARY ? 'border-tg-red/50 text-tg-red' : 'border-zinc-300 text-zinc-500')}>
                {secondary.length}/{MAX_SECONDARY}
              </Badge>
            </h2>
            {secondary.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun article secondaire pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-2">
                {secondary.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-zinc-200 p-2 hover:bg-tg-gray/50 transition-colors">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-tg-navy text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0">
                      <FadeImage src={a.coverImage} alt={a.coverAlt || a.title} fill sizes="60px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-tg-navy line-clamp-1">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.rubrique?.name || '—'}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveSecondary(i, -1)} aria-label="Monter">
                        <ArrowUp size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === secondary.length - 1} onClick={() => moveSecondary(i, 1)} aria-label="Descendre">
                        <ArrowDown size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-tg-red hover:bg-tg-red/10" onClick={() => removeSecondary(a.id)} aria-label="Retirer">
                        <X size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Candidats */}
        <section className="bg-card rounded-2xl border border-zinc-200 p-4">
          <h2 className="font-bold text-tg-navy flex items-center gap-2 mb-3">
            <ListPlus size={16} className="text-tg-green" /> Candidats publiés
            <Badge variant="outline" className="ml-1 border-zinc-300 text-zinc-500">{filtered.length}</Badge>
          </h2>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer les candidats…" className="pl-9 h-9 text-sm" aria-label="Filtrer les candidats" />
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Aucun candidat" description="Aucun article publié ne correspond à cette recherche." />
          ) : (
            <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto tg-scroll pr-1">
              {filtered.map((a) => {
                const isMain = main?.id === a.id
                const inSec = secondary.some((s) => s.id === a.id)
                return (
                  <li key={a.id} className={cn('flex items-center gap-2.5 rounded-xl border p-2 transition-colors', isMain || inSec ? 'border-tg-green/40 bg-tg-green/5' : 'border-zinc-200 hover:bg-tg-gray/50')}>
                    <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0">
                      <FadeImage src={a.coverImage} alt={a.coverAlt || a.title} fill sizes="60px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-tg-navy line-clamp-1">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.rubrique?.name || '—'} · {fmt.short(a.publishedAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isMain && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-tg-yellow/60 text-yellow-800 hover:bg-tg-yellow hover:text-tg-navy" onClick={() => promoteMain(a)} disabled={inSec}>
                          <Crown size={12} /> Principal
                        </Button>
                      )}
                      {!inSec && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-tg-green/50 text-tg-green hover:bg-tg-green hover:text-white" onClick={() => addSecondary(a)} disabled={isMain}>
                          <Star size={12} /> Secondaire
                        </Button>
                      )}
                      {isMain && <Badge className="bg-tg-yellow/25 text-yellow-800 border border-tg-yellow/50">Principal</Badge>}
                      {inSec && <Badge className="bg-tg-green/15 text-tg-green-dark border border-tg-green/40">Sélectionné</Badge>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
