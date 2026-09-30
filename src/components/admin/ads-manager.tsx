'use client'
// Gestion de la publicité — emplacements, campagnes, annonceurs (§7.9, §8)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import type { AdCampaign, AdSlot, Advertiser } from '@/lib/types'
import { FadeImage } from '@/components/tg/shared'
import { EmptyState, ImageDropzone, LinesSkeleton, PageHeader, toInputDate, fromInputDate } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  Building2, CalendarRange, Eye, ImagePlus, Loader2, MapPin, Megaphone,
  MousePointerClick, Pencil, Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const POSITION_LABELS: Record<string, string> = {
  header: 'En-tête (header)',
  footer: 'Pied de page (footer)',
  sidebar: 'Colonne latérale (sidebar)',
  intercalaire: 'Intercalaire (entre les blocs)',
  in_article: 'Dans l\'article',
  habillage: 'Habillage',
}

function campaignStatus(c: AdCampaign): { label: string; cls: string } {
  const now = Date.now()
  const start = new Date(c.startDate).getTime()
  const end = c.endDate ? new Date(c.endDate).getTime() : null
  if (now < start) return { label: 'Programmée', cls: 'bg-tg-yellow/25 text-yellow-800 border-tg-yellow/50' }
  if (end && now > end) return { label: 'Terminée', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' }
  if (c.isActive) return { label: 'Active', cls: 'bg-tg-green/15 text-tg-green-dark border-tg-green/40' }
  return { label: 'En pause', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
}

function ctr(c: { impressions: number; clicks: number }): string {
  if (!c.impressions) return '0 %'
  return ((c.clicks / c.impressions) * 100).toFixed(2) + ' %'
}

interface CamForm {
  title: string; advertiserId: string; slotId: string; linkUrl: string
  weight: string; start: string; end: string; isActive: boolean
}

const EMPTY_CAM: CamForm = { title: '', advertiserId: 'new', slotId: '', linkUrl: 'https://', weight: '1', start: toInputDate(new Date()), end: '', isActive: true }

export function AdsManager() {
  const [slots, setSlots] = useState<AdSlot[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog campagne
  const [camOpen, setCamOpen] = useState(false)
  const [camEditing, setCamEditing] = useState<AdCampaign | null>(null)
  const [camForm, setCamForm] = useState<CamForm>(EMPTY_CAM)
  const [camImage, setCamImage] = useState<string | null>(null)
  const [newAdvertiser, setNewAdvertiser] = useState({ name: '', contact: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AdCampaign | null>(null)

  // Dialog annonceur
  const [advOpen, setAdvOpen] = useState(false)
  const [advForm, setAdvForm] = useState({ name: '', contact: '', notes: '' })

  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c, a] = await Promise.all([adminApi.slots(), adminApi.campaigns(), adminApi.advertisers()])
      setSlots(s.slots)
      setCampaigns(c.campaigns)
      setAdvertisers(a.advertisers)
    } catch (e) {
      toast.error('Impossible de charger la régie publicitaire', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const groupedSlots = Object.keys(POSITION_LABELS)
    .map((pos) => ({ pos, items: slots.filter((s) => s.position === pos) }))
    .filter((g) => g.items.length > 0)

  const activeCampaignOf = (slotId: string): AdCampaign | null => {
    const now = Date.now()
    const list = campaigns.filter((c) =>
      c.slotId === slotId && c.isActive &&
      new Date(c.startDate).getTime() <= now &&
      (!c.endDate || new Date(c.endDate).getTime() >= now)
    )
    if (!list.length) return null
    return list.sort((a, b) => b.weight - a.weight)[0]
  }

  const toggleSlot = async (s: AdSlot) => {
    try {
      await adminApi.updateSlot(s.id, { isActive: !s.isActive })
      setSlots((arr) => arr.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)))
      toast.success(s.isActive ? 'Emplacement désactivé' : 'Emplacement activé', { description: s.name })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  // ── Campagnes ────────────────────────────────────────────────────
  const openCamCreate = () => {
    setCamEditing(null)
    setCamForm({ ...EMPTY_CAM, slotId: slots[0]?.id || '' })
    setCamImage(null)
    setNewAdvertiser({ name: '', contact: '' })
    setCamOpen(true)
  }

  const openCamEdit = (c: AdCampaign) => {
    setCamEditing(c)
    setCamForm({
      title: c.title,
      advertiserId: c.advertiserId || 'none',
      slotId: c.slotId,
      linkUrl: c.linkUrl || 'https://',
      weight: String(c.weight ?? 1),
      start: toInputDate(c.startDate),
      end: toInputDate(c.endDate),
      isActive: c.isActive,
    })
    setCamImage(c.imageUrl || null)
    setNewAdvertiser({ name: '', contact: '' })
    setCamOpen(true)
  }

  const submitCampaign = async () => {
    if (!camForm.title.trim()) { toast.error('Le titre de la campagne est obligatoire.'); return }
    if (!camForm.slotId) { toast.error('Choisissez un emplacement.'); return }
    if (!camForm.start) { toast.error('La date de début est obligatoire.'); return }
    setSaving(true)
    try {
      let advertiserId: string | undefined = camForm.advertiserId
      if (advertiserId === 'new') {
        if (!newAdvertiser.name.trim()) { toast.error('Indiquez le nom du nouvel annonceur ou choisissez-en un.'); setSaving(false); return }
        const res = await adminApi.createAdvertiser({ name: newAdvertiser.name.trim(), contact: newAdvertiser.contact.trim() })
        advertiserId = res.advertiser.id
      } else if (advertiserId === 'none') {
        advertiserId = undefined
      }
      const payload = {
        title: camForm.title.trim(),
        advertiserId,
        slotId: camForm.slotId,
        imageUrl: camImage,
        linkUrl: camForm.linkUrl.trim(),
        weight: Math.max(1, Number(camForm.weight) || 1),
        startDate: fromInputDate(camForm.start),
        endDate: fromInputDate(camForm.end) || null,
        isActive: camForm.isActive,
      }
      if (camEditing) {
        await adminApi.updateCampaign(camEditing.id, payload)
        toast.success('Campagne mise à jour', { description: camForm.title })
      } else {
        await adminApi.createCampaign(payload)
        toast.success('Campagne créée', { description: camForm.title })
      }
      setCamOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const doDeleteCampaign = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteCampaign(deleting.id)
      toast.success('Campagne supprimée', { description: deleting.title })
      setDeleting(null)
      await load()
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const submitAdvertiser = async () => {
    if (!advForm.name.trim()) { toast.error('Le nom de l\'annonceur est obligatoire.'); return }
    setSaving(true)
    try {
      await adminApi.createAdvertiser({ name: advForm.name.trim(), contact: advForm.contact.trim(), notes: advForm.notes.trim() })
      toast.success('Annonceur ajouté', { description: advForm.name })
      setAdvOpen(false)
      setAdvForm({ name: '', contact: '', notes: '' })
      await load()
    } catch (e) {
      toast.error('Création impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const advStats = (id: string) => {
    const list = campaigns.filter((c) => c.advertiserId === id)
    return {
      count: list.length,
      impressions: list.reduce((s, c) => s + c.impressions, 0),
      clicks: list.reduce((s, c) => s + c.clicks, 0),
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Publicité" description="Chargement de la régie…" />
        <LinesSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Publicité"
        description="Emplacements du site, campagnes bannières et annonceurs — rotation pondérée."
      />

      <Tabs defaultValue="slots" className="space-y-4">
        <TabsList className="bg-tg-gray h-auto p-1 flex-wrap">
          <TabsTrigger value="slots" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><MapPin size={14} /> Emplacements</TabsTrigger>
          <TabsTrigger value="campaigns" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><Megaphone size={14} /> Campagnes</TabsTrigger>
          <TabsTrigger value="advertisers" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><Building2 size={14} /> Annonceurs</TabsTrigger>
        </TabsList>

        {/* ── Emplacements ── */}
        <TabsContent value="slots" className="space-y-5">
          {groupedSlots.length === 0 ? (
            <EmptyState icon={MapPin} title="Aucun emplacement" description="Les emplacements sont créés par l'équipe technique." />
          ) : groupedSlots.map((g) => (
            <section key={g.pos}>
              <h2 className="text-sm font-bold text-tg-navy uppercase tracking-wide mb-2 flex items-center gap-2">
                <MapPin size={14} className="text-tg-red" /> {POSITION_LABELS[g.pos]}
              </h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {g.items.map((s) => {
                  const active = activeCampaignOf(s.id)
                  return (
                    <div key={s.id} className={cn('bg-card rounded-2xl border p-4 space-y-3', s.isActive ? 'border-zinc-200' : 'border-zinc-200 opacity-70')}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-tg-navy text-sm">{s.name}</p>
                          <Badge variant="outline" className="mt-1 border-zinc-300 text-zinc-500 text-[10px]">{s.format || 'format libre'}</Badge>
                        </div>
                        <Switch checked={s.isActive} onCheckedChange={() => toggleSlot(s)} aria-label={s.isActive ? `Désactiver ${s.name}` : `Activer ${s.name}`} />
                      </div>
                      <Separator />
                      {active ? (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase text-tg-green">Campagne active</p>
                          <p className="text-sm font-semibold text-tg-navy line-clamp-1">{active.title}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CalendarRange size={11} /> {fmt.short(active.startDate)} → {active.endDate ? fmt.short(active.endDate) : 'sans fin'}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                            <span className="inline-flex items-center gap-1"><Eye size={11} /> {fmt.num(active.impressions)} impressions</span>
                            <span className="inline-flex items-center gap-1"><MousePointerClick size={11} /> {fmt.num(active.clicks)} clics</span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-zinc-300 bg-tg-gray/60 py-3 text-center">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Libre</p>
                          <p className="text-[11px] text-zinc-400">Aucune campagne en cours</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </TabsContent>

        {/* ── Campagnes ── */}
        <TabsContent value="campaigns" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCamCreate} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <Plus size={15} /> Nouvelle campagne
            </Button>
          </div>
          {campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="Aucune campagne" description="Créez une campagne bannière pour un annonceur."
              action={<Button onClick={openCamCreate} className="bg-tg-red hover:bg-tg-red-dark text-white"><Plus size={15} /> Nouvelle campagne</Button>} />
          ) : (
            <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto tg-scroll">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[180px]">Campagne</TableHead>
                      <TableHead className="hidden md:table-cell">Annonceur</TableHead>
                      <TableHead className="hidden lg:table-cell">Emplacement</TableHead>
                      <TableHead className="hidden xl:table-cell">Période</TableHead>
                      <TableHead className="hidden md:table-cell text-center">Poids</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clics</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">CTR</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => {
                      const st = campaignStatus(c)
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              {c.imageUrl ? (
                                <div className="relative w-14 h-9 rounded-md overflow-hidden shrink-0 bg-tg-gray">
                                  <FadeImage src={c.imageUrl} alt={c.title} fill sizes="60px" />
                                </div>
                              ) : (
                                <div className="w-14 h-9 rounded-md bg-tg-gray flex items-center justify-center shrink-0"><ImagePlus size={14} className="text-zinc-300" /></div>
                              )}
                              <p className="text-sm font-medium text-tg-navy line-clamp-1">{c.title}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-zinc-600">{c.advertiser?.name || '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-zinc-600">{c.slot?.name || c.slotId}</TableCell>
                          <TableCell className="hidden xl:table-cell text-xs text-zinc-500">
                            {fmt.short(c.startDate)} → {c.endDate ? fmt.short(c.endDate) : '∞'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center text-sm tabular-nums">×{c.weight}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt.num(c.impressions)}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{fmt.num(c.clicks)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums font-semibold text-tg-green">{ctr(c)}</TableCell>
                          <TableCell><span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', st.cls)}>{st.label}</span></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" title="Modifier" onClick={() => openCamEdit(c)}>
                                <Pencil size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-red hover:bg-tg-red/10" title="Supprimer" onClick={() => setDeleting(c)}>
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
            </div>
          )}
        </TabsContent>

        {/* ── Annonceurs ── */}
        <TabsContent value="advertisers" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAdvOpen(true)} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <Plus size={15} /> Nouvel annonceur
            </Button>
          </div>
          {advertisers.length === 0 ? (
            <EmptyState icon={Building2} title="Aucun annonceur" description="Ajoutez les entreprises partenaires de Topguinee.info." />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {advertisers.map((a) => {
                const st = advStats(a.id)
                return (
                  <div key={a.id} className="bg-card rounded-2xl border border-zinc-200 p-4 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-tg-navy text-white flex items-center justify-center shrink-0"><Building2 size={16} /></span>
                      <div className="min-w-0">
                        <p className="font-semibold text-tg-navy text-sm truncate">{a.name}</p>
                        {a.contact && <p className="text-[11px] text-muted-foreground truncate">{a.contact}</p>}
                      </div>
                    </div>
                    {a.notes && <p className="text-xs text-zinc-600 line-clamp-2">{a.notes}</p>}
                    <Separator />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-bold text-tg-navy tabular-nums">{st.count}</p><p className="text-[10px] text-muted-foreground uppercase">Campagnes</p></div>
                      <div><p className="text-lg font-bold text-tg-navy tabular-nums">{fmt.num(st.impressions)}</p><p className="text-[10px] text-muted-foreground uppercase">Impressions</p></div>
                      <div><p className="text-lg font-bold text-tg-green tabular-nums">{fmt.num(st.clicks)}</p><p className="text-[10px] text-muted-foreground uppercase">Clics</p></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog campagne */}
      <Dialog open={camOpen} onOpenChange={setCamOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto tg-scroll">
          <DialogHeader>
            <DialogTitle>{camEditing ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
            <DialogDescription>La bannière tourne sur l&apos;emplacement choisi, avec rotation pondérée.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cam-title">Titre <span className="text-tg-red">*</span></Label>
              <Input id="cam-title" value={camForm.title} onChange={(e) => setCamForm({ ...camForm, title: e.target.value })} placeholder="Ex. : Orange Money — Mars" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Annonceur</Label>
                <Select value={camForm.advertiserId} onValueChange={(v) => setCamForm({ ...camForm, advertiserId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {advertisers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    <SelectItem value="new">+ Créer un nouvel annonceur…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Emplacement <span className="text-tg-red">*</span></Label>
                <Select value={camForm.slotId} onValueChange={(v) => setCamForm({ ...camForm, slotId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({POSITION_LABELS[s.position]?.split(' ')[0]})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {camForm.advertiserId === 'new' && (
              <div className="rounded-xl border border-tg-yellow/60 bg-tg-yellow/10 p-3 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="adv-new-name" className="text-xs">Nom de l&apos;annonceur <span className="text-tg-red">*</span></Label>
                  <Input id="adv-new-name" value={newAdvertiser.name} onChange={(e) => setNewAdvertiser((n) => ({ ...n, name: e.target.value }))} placeholder="Ex. : Orange Guinée" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adv-new-contact" className="text-xs">Contact</Label>
                  <Input id="adv-new-contact" value={newAdvertiser.contact} onChange={(e) => setNewAdvertiser((n) => ({ ...n, contact: e.target.value }))} placeholder="Téléphone ou e-mail" className="h-9 text-sm" />
                </div>
              </div>
            )}
            <ImageDropzone value={camImage} onChange={setCamImage} label="Bannière" aspect="aspect-[6/1]" hint="Format recommandé : 728×90 px" />
            <div className="space-y-1.5">
              <Label htmlFor="cam-link">Lien de redirection</Label>
              <Input id="cam-link" value={camForm.linkUrl} onChange={(e) => setCamForm({ ...camForm, linkUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cam-weight">Poids (rotation)</Label>
                <Input id="cam-weight" type="number" min={1} max={10} value={camForm.weight} onChange={(e) => setCamForm({ ...camForm, weight: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cam-start">Début <span className="text-tg-red">*</span></Label>
                <Input id="cam-start" type="datetime-local" value={camForm.start} onChange={(e) => setCamForm({ ...camForm, start: e.target.value })} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cam-end">Fin</Label>
                <Input id="cam-end" type="datetime-local" value={camForm.end} onChange={(e) => setCamForm({ ...camForm, end: e.target.value })} className="text-xs" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <div>
                <p className="text-sm font-medium text-tg-navy">Campagne active</p>
                <p className="text-[11px] text-muted-foreground">Diffusée si la période est en cours</p>
              </div>
              <Switch checked={camForm.isActive} onCheckedChange={(v) => setCamForm({ ...camForm, isActive: v })} aria-label="Campagne active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCamOpen(false)}>Annuler</Button>
            <Button onClick={submitCampaign} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog annonceur */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel annonceur</DialogTitle>
            <DialogDescription>Les statistiques seront agrégées par annonceur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="adv-name">Nom <span className="text-tg-red">*</span></Label>
              <Input id="adv-name" value={advForm.name} onChange={(e) => setAdvForm({ ...advForm, name: e.target.value })} placeholder="Ex. : Ecobank Guinée" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-contact">Contact</Label>
              <Input id="adv-contact" value={advForm.contact} onChange={(e) => setAdvForm({ ...advForm, contact: e.target.value })} placeholder="Téléphone ou e-mail du contact" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-notes">Notes internes</Label>
              <Input id="adv-notes" value={advForm.notes} onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })} placeholder="Ex. : contrat trimestriel, facturation mensuelle…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvOpen(false)}>Annuler</Button>
            <Button onClick={submitAdvertiser} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression campagne */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la campagne ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.title} » et ses statistiques ({fmt.num(deleting?.impressions || 0)} impressions) seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteCampaign} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <Trash2 size={15} /> Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
