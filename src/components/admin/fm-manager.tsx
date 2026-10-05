'use client'
// Gestion FM & Podcasts — émissions et épisodes (§7.6)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt, uploadFile } from '@/lib/api'
import type { ArticleCardData, Emission, Episode } from '@/lib/types'
import { FadeImage } from '@/components/tg/shared'
import { AudioDropzone, EmptyState, LinesSkeleton, PageHeader, toInputDate, fromInputDate } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import {
  CalendarClock, FolderOpen, Headphones, ImagePlus, Loader2, Mic, Pencil, Plus, Radio,
  Trash2, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const EMISSION_TYPES: { value: Emission['type']; label: string }[] = [
  { value: 'PODCAST', label: 'Podcast' },
  { value: 'CHRONIQUE', label: 'Chronique' },
  { value: 'FM', label: 'Émission FM' },
]

const TYPE_BADGE: Record<string, string> = {
  PODCAST: 'bg-tg-navy/8 text-tg-navy',
  CHRONIQUE: 'bg-tg-yellow/25 text-yellow-800',
  FM: 'bg-tg-green/15 text-tg-green-dark',
}

interface EmForm { title: string; description: string; type: Emission['type']; order: string; isActive: boolean }
interface EpForm {
  title: string; description: string; audioUrl: string; duration: string
  guests: string; articleId: string; publishAt: string; isPublished: boolean
}

const EMPTY_EP: EpForm = { title: '', description: '', audioUrl: '', duration: '', guests: '', articleId: 'none', publishAt: toInputDate(new Date()), isPublished: true }

export function FMManager() {
  const [emissions, setEmissions] = useState<Emission[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [articles, setArticles] = useState<ArticleCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('')

  // Dialog émission
  const [emOpen, setEmOpen] = useState(false)
  const [emEditing, setEmEditing] = useState<Emission | null>(null)
  const [emForm, setEmForm] = useState<EmForm>({ title: '', description: '', type: 'PODCAST', order: '0', isActive: true })
  const [emImage, setEmImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Dialog épisode
  const [epOpen, setEpOpen] = useState(false)
  const [epEditing, setEpEditing] = useState<Episode | null>(null)
  const [epForm, setEpForm] = useState<EpForm>(EMPTY_EP)
  const [epEmissionId, setEpEmissionId] = useState('')

  // Dialog import dossier Drive
  const [diOpen, setDiOpen] = useState(false)
  const [diEmissionId, setDiEmissionId] = useState('')
  const [diFolderUrl, setDiFolderUrl] = useState('')
  const [diPublish, setDiPublish] = useState(true)
  const [importing, setImporting] = useState(false)

  const [deleting, setDeleting] = useState<{ kind: 'emission' | 'episode'; id: string; label: string } | null>(null)
  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [em, ep, art] = await Promise.all([
        adminApi.emissions(),
        adminApi.episodes(),
        adminApi.articles({ status: 'PUBLISHED', limit: 100 }),
      ])
      const ems = em.emissions.slice().sort((a, b) => a.order - b.order)
      setEmissions(ems)
      setEpisodes(ep.episodes)
      setArticles(art.items)
      setActiveTab((prev) => (prev && ems.some((e) => e.id === prev) ? prev : ems[0]?.id || ''))
    } catch (e) {
      toast.error('Impossible de charger les émissions', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  // ── Émissions ────────────────────────────────────────────────────
  const openEmCreate = () => {
    setEmEditing(null)
    setEmForm({ title: '', description: '', type: 'PODCAST', order: String(emissions.length), isActive: true })
    setEmImage(null)
    setEmOpen(true)
  }

  const openEmEdit = (e: Emission) => {
    setEmEditing(e)
    setEmForm({ title: e.title, description: e.description || '', type: e.type, order: String(e.order ?? 0), isActive: e.isActive })
    setEmImage(e.coverImage || null)
    setEmOpen(true)
  }

  const submitEmission = async () => {
    if (!emForm.title.trim()) { toast.error('Le titre de l\'émission est obligatoire.'); return }
    setSaving(true)
    try {
      const payload = {
        title: emForm.title.trim(),
        description: emForm.description.trim(),
        type: emForm.type,
        order: Number(emForm.order) || 0,
        isActive: emForm.isActive,
        coverImage: emImage,
      }
      if (emEditing) {
        await adminApi.updateEmission(emEditing.id, payload)
        toast.success('Émission mise à jour', { description: emForm.title })
      } else {
        await adminApi.createEmission(payload)
        toast.success('Émission créée', { description: emForm.title })
      }
      setEmOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const toggleEpisode = async (ep: Episode) => {
    try {
      await adminApi.updateEpisode(ep.id, { isPublished: !ep.isPublished })
      setEpisodes((arr) => arr.map((x) => (x.id === ep.id ? { ...x, isPublished: !ep.isPublished } : x)))
      toast.success(ep.isPublished ? 'Épisode dépublié' : 'Épisode publié', { description: ep.title })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  // ── Épisodes ─────────────────────────────────────────────────────
  const openEpCreate = (emissionId: string) => {
    setEpEditing(null)
    setEpEmissionId(emissionId)
    setEpForm(EMPTY_EP)
    setEpOpen(true)
  }

  const openEpEdit = (ep: Episode) => {
    setEpEditing(ep)
    setEpEmissionId(ep.emissionId)
    setEpForm({
      title: ep.title,
      description: ep.description || '',
      audioUrl: ep.audioUrl || '',
      duration: ep.duration ? String(ep.duration) : '',
      guests: ep.guests || '',
      articleId: ep.articleId || 'none',
      publishAt: toInputDate(ep.publishAt),
      isPublished: ep.isPublished,
    })
    setEpOpen(true)
  }

  const onEpisodeAudioUploaded = (url: string | null) => {
    setEpForm((f) => ({ ...f, audioUrl: url || '' }))
  }

  // Durée auto-remplie dès que la prévisualisation lit les métadonnées
  // (fonctionne aussi bien pour le proxy Drive que pour le CDN Cloudinary)
  const onPreviewMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const d = e.currentTarget.duration
    if (isFinite(d) && d > 0) {
      setEpForm((f) => (Number(f.duration) > 0 ? f : { ...f, duration: String(Math.round(d)) }))
    }
  }

  // ── Import Drive ─────────────────────────────────────────────────
  const openDriveImport = (emissionId: string) => {
    setDiEmissionId(emissionId)
    setDiFolderUrl('')
    setDiPublish(true)
    setDiOpen(true)
  }

  const submitDriveImport = async () => {
    if (!diFolderUrl.trim()) { toast.error('Collez le lien de partage du dossier Drive.'); return }
    setImporting(true)
    try {
      const res = await adminApi.importDriveFolder({ emissionId: diEmissionId, folderUrl: diFolderUrl.trim(), isPublished: diPublish })
      if (res.created > 0) {
        toast.success(`${res.created} épisode${res.created > 1 ? 's' : ''} importé${res.created > 1 ? 's' : ''}`, {
          description: res.skipped > 0 ? `${res.skipped} déjà présent${res.skipped > 1 ? 's' : ''} (ignoré${res.skipped > 1 ? 's' : ''}).` : undefined,
        })
      } else {
        toast.info('Aucun nouvel épisode importé', { description: 'Tous les audios de ce dossier sont déjà dans cette émission.' })
      }
      setDiOpen(false)
      await load()
    } catch (e) {
      toast.error('Import impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setImporting(false) }
  }

  const submitEpisode = async () => {
    if (!epForm.title.trim()) { toast.error('Le titre de l\'épisode est obligatoire.'); return }
    if (!epForm.audioUrl.trim()) { toast.error('Ajoutez un fichier audio ou une URL.'); return }
    setSaving(true)
    try {
      const payload = {
        emissionId: epEmissionId,
        title: epForm.title.trim(),
        description: epForm.description.trim(),
        audioUrl: epForm.audioUrl.trim(),
        duration: Number(epForm.duration) || 0,
        guests: epForm.guests.trim(),
        articleId: epForm.articleId === 'none' ? null : epForm.articleId,
        publishAt: fromInputDate(epForm.publishAt) || new Date().toISOString(),
        isPublished: epForm.isPublished,
      }
      if (epEditing) {
        await adminApi.updateEpisode(epEditing.id, payload)
        toast.success('Épisode mis à jour', { description: epForm.title })
      } else {
        await adminApi.createEpisode(payload)
        toast.success('Épisode ajouté', { description: epForm.title })
      }
      setEpOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      if (deleting.kind === 'emission') {
        await adminApi.deleteEmission(deleting.id)
        toast.success('Émission supprimée', { description: deleting.label })
      } else {
        await adminApi.deleteEpisode(deleting.id)
        toast.success('Épisode supprimé', { description: deleting.label })
      }
      setDeleting(null)
      await load()
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const episodesOf = (emissionId: string) =>
    episodes.filter((e) => e.emissionId === emissionId).sort((a, b) => new Date(b.publishAt || b.createdAt).getTime() - new Date(a.publishAt || a.createdAt).getTime())

  return (
    <div className="space-y-4">
      <PageHeader
        title="FM & Podcasts"
        description="Émissions, chroniques et épisodes audio publiés sur le site."
        actions={
          <Button onClick={openEmCreate} className="bg-tg-red hover:bg-tg-red-dark text-white">
            <Plus size={16} /> Nouvelle émission
          </Button>
        }
      />

      <div className="rounded-xl border border-tg-yellow/50 bg-tg-yellow/10 px-4 py-2.5 text-xs text-tg-navy">
        Le libellé public de cette section (ex. « Radio Topguinee FM ») se règle dans <strong>Paramètres → Général</strong> (champ « Libellé FM »).
      </div>

      {loading ? (
        <LinesSkeleton rows={7} />
      ) : emissions.length === 0 ? (
        <EmptyState icon={Radio} title="Aucune émission" description="Créez votre première émission, puis ajoutez-y des épisodes audio."
          action={<Button onClick={openEmCreate} className="bg-tg-red hover:bg-tg-red-dark text-white"><Plus size={15} /> Nouvelle émission</Button>} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-tg-gray h-auto p-1 flex-wrap max-w-full">
            {emissions.map((e) => (
              <TabsTrigger key={e.id} value={e.id} className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5">
                <Mic size={13} /> {e.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {emissions.map((em) => {
            const eps = episodesOf(em.id)
            return (
              <TabsContent key={em.id} value={em.id} className="space-y-4">
                {/* Fiche émission */}
                <div className="bg-card rounded-2xl border border-zinc-200 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-tg-gray">
                    <FadeImage src={em.coverImage} alt={em.title} fill sizes="100px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-tg-navy text-lg">{em.title}</h2>
                      <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded', TYPE_BADGE[em.type])}>{EMISSION_TYPES.find((t) => t.value === em.type)?.label}</span>
                      {!em.isActive && <Badge className="bg-zinc-200 text-zinc-500 border border-zinc-300">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{em.description || 'Aucune description.'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{eps.length} épisode{eps.length > 1 ? 's' : ''} · {fmt.num(eps.reduce((s, e) => s + (e.listens || 0), 0))} écoutes cumulées</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEmEdit(em)} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
                      <Pencil size={13} /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting({ kind: 'emission', id: em.id, label: em.title })} className="border-tg-red/30 text-tg-red hover:bg-tg-red/10">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>

                {/* Épisodes */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-tg-navy flex items-center gap-2"><Headphones size={16} className="text-tg-red" /> Épisodes</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDriveImport(em.id)} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
                      <FolderOpen size={14} /> Importer un dossier Drive
                    </Button>
                    <Button size="sm" onClick={() => openEpCreate(em.id)} className="bg-tg-green hover:bg-tg-green-dark text-white">
                      <Plus size={14} /> Ajouter un épisode
                    </Button>
                  </div>
                </div>

                {eps.length === 0 ? (
                  <EmptyState icon={Headphones} title="Aucun épisode" description="Ajoutez le premier épisode audio de cette émission." />
                ) : (
                  <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-[55vh] overflow-y-auto tg-scroll">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="min-w-[200px]">Épisode</TableHead>
                            <TableHead className="hidden md:table-cell">Durée</TableHead>
                            <TableHead className="hidden lg:table-cell">Publication</TableHead>
                            <TableHead>Publié</TableHead>
                            <TableHead className="hidden sm:table-cell text-right">Écoutes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eps.map((ep) => (
                            <TableRow key={ep.id}>
                              <TableCell>
                                <p className="text-sm font-medium text-tg-navy line-clamp-1">{ep.title}</p>
                                {ep.guests && <p className="text-[11px] text-muted-foreground">Invités : {ep.guests}</p>}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm tabular-nums text-zinc-600">{ep.duration ? fmt.duration(ep.duration) : '—'}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-zinc-500">
                                {ep.publishAt ? (
                                  <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> {fmt.dateTime(ep.publishAt)}</span>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                <Switch checked={ep.isPublished} onCheckedChange={() => toggleEpisode(ep)} aria-label={ep.isPublished ? 'Dépublier l\'épisode' : 'Publier l\'épisode'} />
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums text-zinc-600">{fmt.num(ep.listens)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" title="Modifier" onClick={() => openEpEdit(ep)}>
                                    <Pencil size={14} />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-red hover:bg-tg-red/10" title="Supprimer" onClick={() => setDeleting({ kind: 'episode', id: ep.id, label: ep.title })}>
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      {/* Dialog émission */}
      <Dialog open={emOpen} onOpenChange={setEmOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto tg-scroll">
          <DialogHeader>
            <DialogTitle>{emEditing ? 'Modifier l\'émission' : 'Nouvelle émission'}</DialogTitle>
            <DialogDescription>Podcast, chronique ou émission FM — regroupe les épisodes audio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="em-title">Titre <span className="text-tg-red">*</span></Label>
              <Input id="em-title" value={emForm.title} onChange={(e) => setEmForm({ ...emForm, title: e.target.value })} placeholder="Ex. : Le Journal de 13h" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-desc">Description</Label>
              <Textarea id="em-desc" rows={3} value={emForm.description} onChange={(e) => setEmForm({ ...emForm, description: e.target.value })} placeholder="Présentation de l'émission…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={emForm.type} onValueChange={(v) => setEmForm({ ...emForm, type: v as Emission['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMISSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-order">Ordre d'affichage</Label>
                <Input id="em-order" type="number" value={emForm.order} onChange={(e) => setEmForm({ ...emForm, order: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <div>
                <p className="text-sm font-medium text-tg-navy">Émission active</p>
                <p className="text-[11px] text-muted-foreground">Visible dans la section publique</p>
              </div>
              <Switch checked={emForm.isActive} onCheckedChange={(v) => setEmForm({ ...emForm, isActive: v })} aria-label="Émission active" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-tg-navy flex items-center gap-1.5"><ImagePlus size={14} /> Image de couverture</Label>
              {emImage ? (
                <div className="relative w-full aspect-[16/6] rounded-xl overflow-hidden border border-zinc-200">
                  <FadeImage src={emImage} alt="Couverture émission" fill sizes="500px" />
                  <button type="button" onClick={() => setEmImage(null)} className="absolute top-2 right-2 bg-tg-red text-white rounded-full p-1.5" aria-label="Retirer l'image">
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <label className={cn('flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-4 text-sm text-muted-foreground cursor-pointer hover:border-tg-red hover:bg-tg-gray/60 transition-colors')}>
                  <Upload size={16} /> Choisir une image
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                      const res = await uploadFile(file, 'image')
                      setEmImage(res.url)
                      if (res.warning) toast.warning('Image importée avec réserve', { description: res.warning })
                      else if (res.provider === 'cloudinary') toast.success('Image transférée sur Cloudinary')
                    } catch (err) {
                      toast.error('Échec de l\'envoi', { description: err instanceof Error ? err.message : undefined })
                    }
                  }} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmOpen(false)}>Annuler</Button>
            <Button onClick={submitEmission} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog épisode */}
      <Dialog open={epOpen} onOpenChange={setEpOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto tg-scroll">
          <DialogHeader>
            <DialogTitle>{epEditing ? 'Modifier l\'épisode' : 'Nouvel épisode'}</DialogTitle>
            <DialogDescription>{emissions.find((e) => e.id === epEmissionId)?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="ep-title">Titre <span className="text-tg-red">*</span></Label>
              <Input id="ep-title" value={epForm.title} onChange={(e) => setEpForm({ ...epForm, title: e.target.value })} placeholder="Ex. : Édition du 12 mars" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-desc">Description</Label>
              <Textarea id="ep-desc" rows={2} value={epForm.description} onChange={(e) => setEpForm({ ...epForm, description: e.target.value })} placeholder="Résumé de l'épisode…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-audio-url">Lien Google Drive de l'audio <span className="text-tg-red">*</span></Label>
              <Input id="ep-audio-url" value={epForm.audioUrl} onChange={(e) => setEpForm({ ...epForm, audioUrl: e.target.value })} placeholder="https://drive.google.com/file/d/…" className="font-mono text-xs" />
              <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                Dans Drive : partagez le fichier en « <strong>Tout le monde avec le lien</strong> ». L'audio est lu en streaming <strong>directement depuis Drive</strong> — il n'est copié ni sur le site ni sur Cloudinary. Un dossier entier ? Utilisez « Importer un dossier Drive ».
              </p>

              {epForm.audioUrl.trim() ? (
                <div className="rounded-xl border border-tg-green/40 bg-tg-green/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-tg-green flex items-center gap-1.5"><Headphones size={13} /> Vérifiez la lecture avant de publier</p>
                    <button type="button" onClick={() => setEpForm((f) => ({ ...f, audioUrl: '' }))} className="text-[11px] text-tg-red hover:underline">Changer de source</button>
                  </div>
                  {/* Prévisualisation : la durée est remplie automatiquement dès lecture des métadonnées */}
                  <audio controls src={epForm.audioUrl} preload="metadata" className="w-full" onLoadedMetadata={onPreviewMetadata} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pt-1" aria-hidden>
                    <span className="flex-1 border-t border-zinc-200" />
                    <span className="text-[10.5px] text-muted-foreground">ou charger un fichier (stocké sur Cloudinary)</span>
                    <span className="flex-1 border-t border-zinc-200" />
                  </div>
                  <AudioDropzone value={null} onChange={onEpisodeAudioUploaded} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-duration">Durée (secondes)</Label>
                <Input id="ep-duration" type="number" min={0} value={epForm.duration} onChange={(e) => setEpForm({ ...epForm, duration: e.target.value })} placeholder="Auto si métadonnées lisibles" />
                {epForm.duration && <p className="text-[11px] text-tg-green font-medium">≈ {fmt.duration(Number(epForm.duration) || 0)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-guests">Invités</Label>
                <Input id="ep-guests" value={epForm.guests} onChange={(e) => setEpForm({ ...epForm, guests: e.target.value })} placeholder="Ex. : M. Diallo, économiste" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-pub">Date de publication</Label>
                <Input id="ep-pub" type="datetime-local" value={epForm.publishAt} onChange={(e) => setEpForm({ ...epForm, publishAt: e.target.value })} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Article lié</Label>
                <Select value={epForm.articleId} onValueChange={(v) => setEpForm({ ...epForm, articleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun article lié</SelectItem>
                    {articles.map((a) => <SelectItem key={a.id} value={a.id}><span className="truncate block max-w-[280px]">{a.title}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <div>
                <p className="text-sm font-medium text-tg-navy">Épisode publié</p>
                <p className="text-[11px] text-muted-foreground">Visible et jouable sur le site</p>
              </div>
              <Switch checked={epForm.isPublished} onCheckedChange={(v) => setEpForm({ ...epForm, isPublished: v })} aria-label="Épisode publié" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEpOpen(false)}>Annuler</Button>
            <Button onClick={submitEpisode} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog import dossier Drive */}
      <Dialog open={diOpen} onOpenChange={setDiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderOpen size={17} className="text-tg-green" /> Importer un dossier Drive</DialogTitle>
            <DialogDescription>
              Chaque fichier audio du dossier devient un épisode de « {emissions.find((e) => e.id === diEmissionId)?.title} », diffusé en streaming sans clé API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-tg-green/40 bg-tg-green/5 px-3.5 py-2.5 text-[11.5px] text-tg-navy leading-relaxed">
              Dans Google Drive : clic droit sur le dossier → <strong>Partager</strong> → <strong>Général</strong> → « <strong>Tout le monde avec le lien</strong> » (Lecteur), puis copiez le lien du dossier.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="di-url">Lien de partage du dossier <span className="text-tg-red">*</span></Label>
              <Input id="di-url" value={diFolderUrl} onChange={(e) => setDiFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="text-xs font-mono" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
              <div>
                <p className="text-sm font-medium text-tg-navy">Publier les épisodes importés</p>
                <p className="text-[11px] text-muted-foreground">Audios MP3, M4A, WAV, OGG, OPUS, FLAC, AAC — titres = noms de fichiers</p>
              </div>
              <Switch checked={diPublish} onCheckedChange={setDiPublish} aria-label="Publier les épisodes importés" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiOpen(false)} disabled={importing}>Annuler</Button>
            <Button onClick={submitDriveImport} disabled={importing} className="bg-tg-green hover:bg-tg-green-dark text-white">
              {importing ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />} Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === 'emission'
                ? 'Les épisodes associés resteront en base mais ne seront plus rattachés à une émission visible.'
                : 'L\'épisode audio ne sera plus disponible sur le site. Cette action est irréversible.'}
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
