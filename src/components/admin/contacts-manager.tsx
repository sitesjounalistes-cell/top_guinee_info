'use client'
// Gestion des contacts et réseaux sociaux (§7.3)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi } from '@/lib/api'
import type { ContactChannel, SocialLink } from '@/lib/types'
import { SocialIcon } from '@/components/tg/shared'
import { EmptyState, LinesSkeleton, PageHeader } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  ArrowDown, ArrowUp, Loader2, Mail, MapPin, Pencil, Phone, Plus, Share2, Trash2, Globe, AtSign, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Canaux de contact ────────────────────────────────────────────

const CHANNEL_TYPES: { value: ContactChannel['type']; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { value: 'address', label: 'Adresse', icon: MapPin },
  { value: 'other', label: 'Autre', icon: Globe },
]

const CHANNEL_LABELS: Record<string, string> = { phone: 'Téléphone', email: 'E-mail', whatsapp: 'WhatsApp', address: 'Adresse', other: 'Autre' }

const PLATFORMS: { value: string; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'threads', label: 'Threads' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'other', label: 'Autre' },
]

function ReorderButtons({ onUp, onDown, first, last, busy }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean; busy: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <Button size="icon" variant="ghost" className="h-6 w-7" disabled={first || busy} onClick={onUp} aria-label="Monter"><ArrowUp size={12} /></Button>
      <Button size="icon" variant="ghost" className="h-6 w-7" disabled={last || busy} onClick={onDown} aria-label="Descendre"><ArrowDown size={12} /></Button>
    </div>
  )
}

export function ContactsManager() {
  const [contacts, setContacts] = useState<ContactChannel[]>([])
  const [socials, setSocials] = useState<SocialLink[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Dialog canal
  const [chOpen, setChOpen] = useState(false)
  const [chEditing, setChEditing] = useState<ContactChannel | null>(null)
  const [chForm, setChForm] = useState<{ type: ContactChannel['type']; label: string; value: string }>({ type: 'phone', label: '', value: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<{ kind: 'contact' | 'social'; id: string; label: string } | null>(null)

  // Dialog réseau
  const [soOpen, setSoOpen] = useState(false)
  const [soEditing, setSoEditing] = useState<SocialLink | null>(null)
  const [soForm, setSoForm] = useState<{ platform: string; url: string }>({ platform: 'facebook', url: '' })

  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, s] = await Promise.all([adminApi.contacts(), adminApi.socials()])
      setContacts(c.contacts.sort((a, b) => a.order - b.order))
      setSocials(s.socials.sort((a, b) => a.order - b.order))
    } catch (e) {
      toast.error('Impossible de charger les contacts', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const moveContact = async (c: ContactChannel, dir: -1 | 1) => {
    const idx = contacts.findIndex((x) => x.id === c.id)
    const target = idx + dir
    if (target < 0 || target >= contacts.length) return
    const other = contacts[target]
    setBusyId(c.id)
    try {
      await Promise.all([
        adminApi.updateContact(c.id, { order: other.order }),
        adminApi.updateContact(other.id, { order: c.order }),
      ])
      await load()
    } catch (e) {
      toast.error('Réorganisation impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  const moveSocial = async (s: SocialLink, dir: -1 | 1) => {
    const idx = socials.findIndex((x) => x.id === s.id)
    const target = idx + dir
    if (target < 0 || target >= socials.length) return
    const other = socials[target]
    setBusyId(s.id)
    try {
      await Promise.all([
        adminApi.updateSocial(s.id, { order: other.order }),
        adminApi.updateSocial(other.id, { order: s.order }),
      ])
      await load()
    } catch (e) {
      toast.error('Réorganisation impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setBusyId(null) }
  }

  const toggleContact = async (c: ContactChannel) => {
    try {
      await adminApi.updateContact(c.id, { isActive: !c.isActive })
      setContacts((arr) => arr.map((x) => (x.id === c.id ? { ...x, isActive: !c.isActive } : x)))
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const toggleSocial = async (s: SocialLink) => {
    try {
      await adminApi.updateSocial(s.id, { isActive: !s.isActive })
      setSocials((arr) => arr.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)))
      toast.success(s.isActive ? 'Réseau social masqué du site' : 'Réseau social affiché sur le site', { description: s.platform })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const submitChannel = async () => {
    if (!chForm.label.trim() || !chForm.value.trim()) {
      toast.error('Libellé et valeur sont obligatoires.')
      return
    }
    setSaving(true)
    try {
      if (chEditing) {
        await adminApi.updateContact(chEditing.id, { ...chForm, label: chForm.label.trim(), value: chForm.value.trim() })
        toast.success('Canal mis à jour', { description: chForm.label })
      } else {
        await adminApi.createContact({ ...chForm, label: chForm.label.trim(), value: chForm.value.trim(), order: contacts.length, isActive: true })
        toast.success('Canal ajouté', { description: chForm.label })
      }
      setChOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const submitSocial = async () => {
    if (!soForm.url.trim()) { toast.error('L\'URL du réseau social est obligatoire.'); return }
    if (!/^https?:\/\/.+\..+/.test(soForm.url.trim())) { toast.error('URL invalide : elle doit commencer par https://'); return }
    setSaving(true)
    try {
      if (soEditing) {
        await adminApi.updateSocial(soEditing.id, { platform: soForm.platform, url: soForm.url.trim() })
        toast.success('Réseau social mis à jour')
      } else {
        await adminApi.createSocial({ platform: soForm.platform, url: soForm.url.trim(), order: socials.length, isActive: true })
        toast.success('Réseau social ajouté')
      }
      setSoOpen(false)
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      if (deleting.kind === 'contact') await adminApi.deleteContact(deleting.id)
      else await adminApi.deleteSocial(deleting.id)
      toast.success('Supprimé', { description: deleting.label })
      setDeleting(null)
      await load()
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contacts & réseaux sociaux"
        description="Informations affichées dans le pied de page et la page Contact du site."
      />

      <Tabs defaultValue="canaux" className="space-y-4">
        <TabsList className="bg-tg-gray h-auto p-1 flex-wrap">
          <TabsTrigger value="canaux" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5">
            <Phone size={14} /> Canaux de contact
          </TabsTrigger>
          <TabsTrigger value="socials" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5">
            <Share2 size={14} /> Réseaux sociaux
          </TabsTrigger>
        </TabsList>

        {/* ── Canaux ── */}
        <TabsContent value="canaux" className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => { setChEditing(null); setChForm({ type: 'phone', label: '', value: '' }); setChOpen(true) }}
              className="bg-tg-red hover:bg-tg-red-dark text-white"
            >
              <Plus size={15} /> Ajouter un canal
            </Button>
          </div>
          {loading ? <LinesSkeleton rows={4} /> : contacts.length === 0 ? (
            <EmptyState icon={Phone} title="Aucun canal de contact" description="Ajoutez au moins un e-mail et un téléphone." />
          ) : (
            <ul className="space-y-2">
              {contacts.map((c, i) => {
                const Icon = CHANNEL_TYPES.find((t) => t.value === c.type)?.icon || Globe
                return (
                  <li key={c.id} className={cn('flex items-center gap-3 rounded-xl border border-zinc-200 bg-card p-3', !c.isActive && 'opacity-60')}>
                    <span className="w-9 h-9 rounded-lg bg-tg-navy/5 text-tg-navy flex items-center justify-center shrink-0"><Icon size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-tg-navy">{c.label || CHANNEL_LABELS[c.type]}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.value}</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 hidden sm:block">{CHANNEL_LABELS[c.type]}</span>
                    <Switch checked={c.isActive} onCheckedChange={() => toggleContact(c)} aria-label={c.isActive ? `Masquer ${c.label}` : `Afficher ${c.label}`} />
                    <ReorderButtons first={i === 0} last={i === contacts.length - 1} busy={busyId === c.id}
                      onUp={() => moveContact(c, -1)} onDown={() => moveContact(c, 1)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" onClick={() => { setChEditing(c); setChForm({ type: c.type, label: c.label, value: c.value }); setChOpen(true) }} aria-label="Modifier">
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-red hover:bg-tg-red/10" onClick={() => setDeleting({ kind: 'contact', id: c.id, label: c.label })} aria-label="Supprimer">
                      <Trash2 size={14} />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Réseaux sociaux ── */}
        <TabsContent value="socials" className="space-y-3">
          <div className="rounded-xl border border-tg-yellow/50 bg-tg-yellow/10 px-4 py-2.5 text-xs text-tg-navy flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            Les réseaux sociaux désactivés (interrupteur gris) ne sont pas affichés sur le site public.
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => { setSoEditing(null); setSoForm({ platform: 'facebook', url: '' }); setSoOpen(true) }}
              className="bg-tg-red hover:bg-tg-red-dark text-white"
            >
              <Plus size={15} /> Ajouter un réseau
            </Button>
          </div>
          {loading ? <LinesSkeleton rows={4} /> : socials.length === 0 ? (
            <EmptyState icon={AtSign} title="Aucun réseau social" description="Ajoutez Facebook, TikTok, YouTube…" />
          ) : (
            <ul className="space-y-2">
              {socials.map((s, i) => (
                <li key={s.id} className={cn('flex items-center gap-3 rounded-xl border border-zinc-200 bg-card p-3', !s.isActive && 'opacity-60')}>
                  <span className="w-9 h-9 rounded-lg bg-tg-navy text-white flex items-center justify-center shrink-0"><SocialIcon platform={s.platform} size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-tg-navy capitalize">{s.platform}</p>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-tg-green hover:underline truncate block">{s.url}</a>
                  </div>
                  <Switch checked={s.isActive} onCheckedChange={() => toggleSocial(s)} aria-label={s.isActive ? `Masquer ${s.platform}` : `Afficher ${s.platform}`} />
                  <ReorderButtons first={i === 0} last={i === socials.length - 1} busy={busyId === s.id}
                    onUp={() => moveSocial(s, -1)} onDown={() => moveSocial(s, 1)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" onClick={() => { setSoEditing(s); setSoForm({ platform: s.platform, url: s.url }); setSoOpen(true) }} aria-label="Modifier">
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-red hover:bg-tg-red/10" onClick={() => setDeleting({ kind: 'social', id: s.id, label: s.platform })} aria-label="Supprimer">
                    <Trash2 size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog canal */}
      <Dialog open={chOpen} onOpenChange={setChOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{chEditing ? 'Modifier le canal' : 'Nouveau canal de contact'}</DialogTitle>
            <DialogDescription>Ces informations apparaissent dans le pied de page et la page Contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={chForm.type} onValueChange={(v) => setChForm({ ...chForm, type: v as ContactChannel['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-label">Libellé <span className="text-tg-red">*</span></Label>
              <Input id="ch-label" value={chForm.label} onChange={(e) => setChForm({ ...chForm, label: e.target.value })} placeholder="Ex. : Rédaction" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-value">Valeur <span className="text-tg-red">*</span></Label>
              <Input
                id="ch-value" value={chForm.value}
                onChange={(e) => setChForm({ ...chForm, value: e.target.value })}
                placeholder={chForm.type === 'email' ? 'contact@exemple.com' : chForm.type === 'whatsapp' ? '+224 6.. .. .. ..' : chForm.type === 'address' ? 'Quartier, ville' : 'Texte ou lien'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChOpen(false)}>Annuler</Button>
            <Button onClick={submitChannel} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog réseau social */}
      <Dialog open={soOpen} onOpenChange={setSoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{soEditing ? 'Modifier le réseau social' : 'Nouveau réseau social'}</DialogTitle>
            <DialogDescription>L&apos;icône correspondante est affichée sur le site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Plateforme</Label>
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-lg bg-tg-navy text-white flex items-center justify-center shrink-0"><SocialIcon platform={soForm.platform} size={16} /></span>
                <Select value={soForm.platform} onValueChange={(v) => setSoForm({ ...soForm, platform: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="so-url">URL de la page <span className="text-tg-red">*</span></Label>
              <Input id="so-url" value={soForm.url} onChange={(e) => setSoForm({ ...soForm, url: e.target.value })} placeholder="https://www.facebook.com/…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoOpen(false)}>Annuler</Button>
            <Button onClick={submitSocial} disabled={saving} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {saving ? <Loader2 size={15} className="animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>Cet élément ne sera plus affiché sur le site. Cette action est irréversible.</AlertDialogDescription>
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
