'use client'
// Gestion du bandeau Flash Info (§4.8, §7.4)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import type { ArticleCardData, FlashInfo } from '@/lib/types'
import { useDebounced, fromInputDate, toInputDate } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Zap, Plus, Pencil, Trash2, Loader2, Clock, Link2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITIES: Record<number, { label: string; badge: string }> = {
  1: { label: 'Normale', badge: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  2: { label: 'Urgente', badge: 'bg-tg-yellow/25 text-yellow-800 border-tg-yellow/50' },
  3: { label: 'Ultime', badge: 'bg-tg-red/10 text-tg-red border-tg-red/40' },
}

interface FlashForm {
  text: string
  priority: string
  publishAt: string
  expiresAt: string
  articleId: string
}

const EMPTY_FORM: FlashForm = { text: '', priority: '1', publishAt: toInputDate(new Date()), expiresAt: '', articleId: 'none' }

export function FlashManager() {
  const [items, setItems] = useState<FlashInfo[]>([])
  const [articles, setArticles] = useState<ArticleCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FlashInfo | null>(null)
  const [form, setForm] = useState<FlashForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<FlashInfo | null>(null)
  const [q, setQ] = useState('')
  const mountedRef = useRef(false)
  const dq = useDebounced(q, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, a] = await Promise.all([
        adminApi.flash(),
        adminApi.articles({ status: 'PUBLISHED', limit: 100 }),
      ])
      setItems(f.flash)
      setArticles(a.items)
    } catch (e) {
      toast.error('Impossible de charger les flashs', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const filtered = items.filter((f) => !dq || f.text.toLowerCase().includes(dq.toLowerCase()))
  const now = Date.now()

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true) }
  const openEdit = (f: FlashInfo) => {
    setEditing(f)
    setForm({
      text: f.text,
      priority: String(f.priority || 1),
      publishAt: toInputDate(f.publishAt),
      expiresAt: toInputDate(f.expiresAt),
      articleId: f.articleId || 'none',
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.text.trim()) { toast.error('Le texte du flash est obligatoire.'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        text: form.text.trim(),
        priority: Number(form.priority) || 1,
        publishAt: fromInputDate(form.publishAt) || new Date().toISOString(),
        expiresAt: fromInputDate(form.expiresAt) || null,
        articleId: form.articleId === 'none' ? null : form.articleId,
        isActive: editing ? editing.isActive : true,
      }
      if (editing) {
        await adminApi.updateFlash(editing.id, payload)
        toast.success('Flash mis à jour')
      } else {
        await adminApi.createFlash(payload)
        toast.success('Flash ajouté au bandeau')
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (f: FlashInfo) => {
    try {
      await adminApi.updateFlash(f.id, { isActive: !f.isActive })
      setItems((arr) => arr.map((x) => (x.id === f.id ? { ...x, isActive: !f.isActive } : x)))
      toast.success(f.isActive ? 'Flash désactivé' : 'Flash activé', { description: f.text.slice(0, 80) })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteFlash(deleting.id)
      toast.success('Flash supprimé')
      setDeleting(null)
      await load()
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-tg-navy font-display">Flash Info</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bandeau défilant rouge en tête du site — priorités et expiration automatique.</p>
        </div>
        <Button onClick={openCreate} className="bg-tg-red hover:bg-tg-red-dark text-white shrink-0">
          <Plus size={16} /> Ajouter un flash
        </Button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un flash…" className="pl-9 h-10 bg-white" aria-label="Rechercher un flash" />
      </div>

      <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-zinc-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
            <Zap size={30} className="text-zinc-300" />
            <p className="font-semibold text-tg-navy">Aucun flash</p>
            <p className="text-sm text-muted-foreground">Créez votre premier flash info pour alerter les lecteurs en temps réel.</p>
            <Button onClick={openCreate} className="mt-2 bg-tg-red hover:bg-tg-red-dark text-white"><Plus size={15} /> Ajouter un flash</Button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto tg-scroll">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[240px]">Texte</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="hidden md:table-cell">Publication</TableHead>
                  <TableHead className="hidden lg:table-cell">Expiration</TableHead>
                  <TableHead className="hidden xl:table-cell">Article lié</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const expired = f.expiresAt && new Date(f.expiresAt).getTime() < now
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <p className="text-sm text-tg-navy font-medium line-clamp-2 max-w-md">{f.text}</p>
                        {expired && <Badge className="mt-1 bg-zinc-200 text-zinc-500 border border-zinc-300">Expirée</Badge>}
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', PRIORITIES[f.priority]?.badge)}>
                          {f.priority >= 3 ? '⚡ ' : ''}{PRIORITIES[f.priority]?.label || `Niveau ${f.priority}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={f.isActive} onCheckedChange={() => toggleActive(f)} aria-label={f.isActive ? 'Désactiver ce flash' : 'Activer ce flash'} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmt.dateTime(f.publishAt)}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-zinc-500">{f.expiresAt ? fmt.dateTime(f.expiresAt) : '—'}</TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[180px]">
                        {f.article ? (
                          <span className="text-xs text-tg-green font-medium line-clamp-1 inline-flex items-center gap-1"><Link2 size={11} /> {f.article.title}</span>
                        ) : <span className="text-xs text-zinc-400">Aucun</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" title="Modifier" onClick={() => openEdit(f)}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-red hover:bg-tg-red/10" title="Supprimer" onClick={() => setDeleting(f)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le flash' : 'Nouveau flash info'}</DialogTitle>
            <DialogDescription>
              Le texte défile dans le bandeau rouge en haut du site. Priorité « Urgente » ou « Ultime » = badge distinctif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="flash-text">Texte du flash <span className="text-tg-red">*</span></Label>
              <Textarea
                id="flash-text" rows={2} value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="Ex. : Le gouvernement annonce de nouvelles mesures économiques…"
                maxLength={220}
              />
              <p className="text-[11px] text-muted-foreground text-right">{form.text.length}/220</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Normale</SelectItem>
                    <SelectItem value="2">Urgente</SelectItem>
                    <SelectItem value="3">Ultime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flash-pub">Date / heure de publication</Label>
                <Input id="flash-pub" type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flash-exp">Expiration (facultatif)</Label>
              <Input id="flash-exp" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="text-sm" />
              <p className="text-[11px] text-muted-foreground">Passée cette date, le flash disparaît automatiquement du bandeau.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Article lié (facultatif)</Label>
              <Select value={form.articleId} onValueChange={(v) => setForm({ ...form, articleId: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun article lié" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun article lié</SelectItem>
                  {articles.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="max-w-full">
                      <span className="truncate block max-w-[300px]">{a.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Le texte du flash deviendra cliquable vers cet article.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : editing ? 'Enregistrer' : 'Publier le flash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce flash ?</AlertDialogTitle>
            <AlertDialogDescription>« {deleting?.text.slice(0, 100)} » disparaîtra immédiatement du bandeau. Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <Trash2 size={15} /> Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
