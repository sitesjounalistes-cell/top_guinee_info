'use client'
// Gestion des rubriques — arborescence (§7.4)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, slugify } from '@/lib/api'
import type { Rubrique } from '@/lib/types'
import { RubriqueIcon, RUBRIQUE_ICON_NAMES, CHART_COLORS, ImageDropzone } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  ArrowDown, ArrowUp, FolderTree, Loader2, Pencil, Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RubForm {
  name: string
  menuLabel: string
  slug: string
  color: string
  icon: string
  imageUrl: string | null
  parentId: string
}

const EMPTY_FORM: RubForm = { name: '', menuLabel: '', slug: '', color: CHART_COLORS[0], icon: 'newspaper', imageUrl: null, parentId: 'none' }

export function RubriquesManager() {
  const [rubriques, setRubriques] = useState<Rubrique[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Rubrique | null>(null)
  const [form, setForm] = useState<RubForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Rubrique | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.rubriques()
      setRubriques(r.rubriques)
    } catch (e) {
      toast.error('Impossible de charger les rubriques', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const tree = useMemo(() => {
    const roots = rubriques.filter((r) => !r.parentId).sort((a, b) => a.order - b.order)
    return roots.map((r) => ({
      ...r,
      children: rubriques.filter((c) => c.parentId === r.id).sort((a, b) => a.order - b.order),
    }))
  }, [rubriques])

  const siblingsOf = (r: Rubrique): Rubrique[] =>
    rubriques.filter((x) => (r.parentId ? x.parentId === r.parentId : !x.parentId)).sort((a, b) => a.order - b.order)

  const move = async (r: Rubrique, dir: -1 | 1) => {
    const sibs = siblingsOf(r)
    const idx = sibs.findIndex((s) => s.id === r.id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= sibs.length) return
    const other = sibs[target]
    setBusyId(r.id)
    try {
      await Promise.all([
        adminApi.updateRubrique(r.id, { order: other.order }),
        adminApi.updateRubrique(other.id, { order: r.order }),
      ])
      await load()
    } catch (e) {
      toast.error('Réorganisation impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (r: Rubrique) => {
    try {
      await adminApi.updateRubrique(r.id, { isActive: !r.isActive })
      setRubriques((arr) => arr.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)))
      toast.success(r.isActive ? 'Rubrique désactivée' : 'Rubrique réactivée', {
        description: r.isActive
          ? 'Elle est masquée du menu et de l\'accueil. Les articles existants sont conservés (archivage réversible).'
          : `« ${r.name} » est à nouveau visible sur le site.`,
      })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const openCreate = (parentId?: string) => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, parentId: parentId || 'none' })
    setDialogOpen(true)
  }

  const openEdit = (r: Rubrique) => {
    setEditing(r)
    setForm({
      name: r.name,
      menuLabel: r.menuLabel || '',
      slug: r.slug,
      color: r.color || CHART_COLORS[0],
      icon: r.icon || 'newspaper',
      imageUrl: r.imageUrl || null,
      parentId: r.parentId || 'none',
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Le nom de la rubrique est obligatoire.'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        menuLabel: form.menuLabel.trim() || form.name.trim(),
        slug: (form.slug.trim() || slugify(form.name)) || undefined,
        color: form.color,
        icon: form.icon,
        imageUrl: form.imageUrl,
        parentId: form.parentId === 'none' ? null : form.parentId,
      }
      if (editing) {
        await adminApi.updateRubrique(editing.id, payload)
        toast.success('Rubrique mise à jour', { description: form.name })
      } else {
        await adminApi.createRubrique(payload)
        toast.success('Rubrique créée', { description: form.name })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteRubrique(deleting.id)
      toast.success('Rubrique supprimée', { description: deleting.name })
      setDeleting(null)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Suppression impossible'
      toast.error(msg.includes('article') ? 'Suppression refusée' : 'Suppression impossible', { description: msg })
    }
  }

  const parentOptions = rubriques.filter((r) => !r.parentId && (!editing || r.id !== editing.id))

  const renderRow = (r: Rubrique, isChild: boolean, siblingCount: number, index: number) => (
    <div
      key={r.id}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        isChild ? 'ml-6 md:ml-10 border-zinc-200 bg-tg-gray/40' : 'border-zinc-200 bg-card',
        !r.isActive && 'opacity-60'
      )}
    >
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: r.color }}>
        <RubriqueIcon name={r.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-tg-navy flex items-center gap-2">
          {r.name}
          {r._count && <Badge variant="outline" className="text-[10px] border-zinc-300 text-zinc-500 font-normal">{r._count.articles} article{r._count.articles > 1 ? 's' : ''}</Badge>}
          {!r.isActive && <Badge className="bg-zinc-200 text-zinc-500 border border-zinc-300 text-[10px]">Inactive</Badge>}
        </p>
        <p className="text-[11px] text-muted-foreground">
          /{isChild ? '…' : ''}{r.slug} {r.menuLabel && r.menuLabel !== r.name && <>· menu : « {r.menuLabel} »</>}
        </p>
      </div>
      <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} aria-label={r.isActive ? `Désactiver ${r.name}` : `Activer ${r.name}`} />
      <div className="flex items-center gap-0.5 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0 || busyId === r.id} onClick={() => move(r, -1)} aria-label={`Monter ${r.name}`}>
          {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={14} />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={index === siblingCount - 1 || busyId === r.id} onClick={() => move(r, 1)} aria-label={`Descendre ${r.name}`}>
          <ArrowDown size={14} />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-tg-navy hover:text-tg-red" onClick={() => openEdit(r)} aria-label={`Modifier ${r.name}`}>
          <Pencil size={14} />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-tg-red hover:bg-tg-red/10" onClick={() => setDeleting(r)} aria-label={`Supprimer ${r.name}`}>
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-tg-navy font-display">Rubriques</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Arborescence illimitée : rubriques racines et sous-rubriques, couleur, icône, ordre.</p>
        </div>
        <Button onClick={() => openCreate()} className="bg-tg-red hover:bg-tg-red-dark text-white shrink-0">
          <Plus size={16} /> Nouvelle rubrique
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-zinc-100 animate-pulse" />)}
        </div>
      ) : tree.length === 0 ? (
        <div className="bg-card rounded-2xl border border-zinc-200 py-12 flex flex-col items-center gap-2 text-center px-6">
          <FolderTree size={30} className="text-zinc-300" />
          <p className="font-semibold text-tg-navy">Aucune rubrique</p>
          <p className="text-sm text-muted-foreground">Créez votre première rubrique pour organiser les articles.</p>
          <Button onClick={() => openCreate()} className="mt-2 bg-tg-red hover:bg-tg-red-dark text-white"><Plus size={15} /> Nouvelle rubrique</Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto tg-scroll pr-1">
          {tree.map((root, ri) => (
            <div key={root.id} className="space-y-2">
              {renderRow(root, false, tree.length, ri)}
              {root.children.length > 0 && (
                <div className="space-y-2">
                  {root.children.map((child, ci) => renderRow(child, true, root.children.length, ci))}
                </div>
              )}
              <button
                onClick={() => openCreate(root.id)}
                className="ml-6 md:ml-10 inline-flex items-center gap-1.5 text-xs font-semibold text-tg-green hover:text-tg-green-dark transition-colors"
              >
                <Plus size={13} /> Ajouter une sous-rubrique à « {root.name} »
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto tg-scroll">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la rubrique' : 'Nouvelle rubrique'}</DialogTitle>
            <DialogDescription>
              La couleur et l&apos;icône sont utilisées sur le site (badges, menu, blocs d&apos;accueil).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rub-name">Nom <span className="text-tg-red">*</span></Label>
                <Input
                  id="rub-name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
                  placeholder="Ex. : Politique"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rub-menu">Libellé du menu</Label>
                <Input id="rub-menu" value={form.menuLabel} onChange={(e) => setForm({ ...form, menuLabel: e.target.value })} placeholder="Identique au nom si vide" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rub-slug">Slug (URL)</Label>
                <Input id="rub-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="politique" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Rubrique parente</Label>
                <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Racine (aucune) —</SelectItem>
                    {parentOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Couleur</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {CHART_COLORS.slice(0, 8).map((c) => (
                      <button
                        key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                        aria-label={`Couleur ${c}`}
                        className={cn('w-6 h-6 rounded-md border-2 transition-transform', form.color === c ? 'border-tg-navy scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <Input
                    type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-9 p-0.5 cursor-pointer" aria-label="Couleur personnalisée"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Icône</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RUBRIQUE_ICON_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        <span className="inline-flex items-center gap-2"><RubriqueIcon name={name} size={14} /> {name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageDropzone
              value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })}
              label="Image d'illustration (facultatif)" aspect="aspect-[16/6]"
              hint="Affichée en tête de la page rubrique"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : editing ? 'Enregistrer' : 'Créer la rubrique'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la rubrique « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les sous-rubriques et les articles liés devront d&apos;abord être déplacés. Si des articles sont rattachés, la suppression sera refusée.
            </AlertDialogDescription>
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
