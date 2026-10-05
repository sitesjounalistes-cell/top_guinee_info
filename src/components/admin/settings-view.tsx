'use client'
// Paramètres du site (§7.10)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, uploadFile } from '@/lib/api'
import type { EditablePageData, SiteSettings, StorageTestResult } from '@/lib/types'
import { FadeImage, RichText } from '@/components/tg/shared'
import { LinesSkeleton, PageHeader } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertTriangle, CheckCircle2, CloudUpload, Eye, Info, Loader2, Radio, Save, SearchCode, Settings2, ShieldAlert, Upload, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_DEFS: { key: string; label: string; hint: string }[] = [
  { key: 'about', label: 'À propos', hint: 'Présentation de Topguinee.info, de la rédaction et de la mission.' },
  { key: 'legal', label: 'Mentions légales', hint: 'Éditeur, hébergement, propriété intellectuelle.' },
  { key: 'privacy', label: 'Politique de confidentialité', hint: 'Données collectées, cookies, droits des utilisateurs.' },
]

// ─── Stockage externe (Cloudinary / Google Drive) — hors SiteSettings ───
const STORAGE_FIELDS = [
  'storageCloudName', 'storageCloudApiKey', 'storageCloudApiSecret',
  'storageDriveFolderId', 'storageDriveClientEmail', 'storageDrivePrivateKey',
] as const
type StorageFieldKey = (typeof STORAGE_FIELDS)[number]
type StorageDraft = Record<StorageFieldKey, string>
const EMPTY_STORAGE: StorageDraft = {
  storageCloudName: '', storageCloudApiKey: '', storageCloudApiSecret: '',
  storageDriveFolderId: '', storageDriveClientEmail: '', storageDrivePrivateKey: '',
}
/** Sentinelle renvoyée par le GET pour un secret déjà configuré (jamais renvoyé en clair). */
const STORAGE_MASKED = '••••••••'

/** Pastille de résultat du test de connexion (vert = OK, rouge = échec). */
function StorageTestBadge({ label, result }: { label: string; result: { ok: boolean; message: string } }) {
  return (
    <div className={cn(
      'flex items-start gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
      result.ok ? 'border-tg-green/30 bg-tg-green/10 text-tg-green' : 'border-tg-red/30 bg-tg-red/10 text-tg-red',
    )}>
      {result.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
      <span><span className="font-semibold">{label}</span> — {result.message}</span>
    </div>
  )
}

export function SettingsView() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [pages, setPages] = useState<EditablePageData[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTab, setSavingTab] = useState('')
  const [draft, setDraft] = useState<Partial<SiteSettings>>({})
  const [pageDrafts, setPageDrafts] = useState<Record<string, { title: string; content: string }>>({})
  const [storageDraft, setStorageDraft] = useState<StorageDraft>(EMPTY_STORAGE)
  const [storageInitial, setStorageInitial] = useState<StorageDraft>(EMPTY_STORAGE)
  const [storageTest, setStorageTest] = useState<StorageTestResult | null>(null)
  const [testingStorage, setTestingStorage] = useState(false)
  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.settings()
      setSettings(res.settings)
      setDraft(res.settings)
      setPages(res.pages || [])
      const init: Record<string, { title: string; content: string }> = {}
      for (const p of res.pages || []) init[p.key] = { title: p.title, content: p.content }
      setPageDrafts(init)
      // Préremplissage de la configuration de stockage (les secrets arrivent masqués « •••••••• »)
      const { storage } = res as typeof res & { storage?: Partial<Record<StorageFieldKey, string>> }
      const sd: StorageDraft = { ...EMPTY_STORAGE }
      if (storage) {
        for (const k of STORAGE_FIELDS) {
          if (typeof storage[k] === 'string') sd[k] = storage[k]
        }
      }
      setStorageDraft(sd)
      setStorageInitial(sd)
      setStorageTest(null)
    } catch (e) {
      toast.error('Impossible de charger les paramètres', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const saveGeneral = async () => {
    if (!draft.siteName?.trim()) { toast.error('Le nom du site est obligatoire.'); return }
    setSavingTab('general')
    try {
      const res = await adminApi.updateSettings({
        siteName: draft.siteName,
        slogan: draft.slogan,
        logoUrl: draft.logoUrl,
      })
      setSettings(res.settings)
      toast.success('Général enregistré', { description: 'Le nom, le slogan et le logo sont à jour.' })
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  const saveFmTv = async () => {
    setSavingTab('fmtv')
    try {
      const res = await adminApi.updateSettings({
        fmEnabled: draft.fmEnabled,
        tvEnabled: draft.tvEnabled,
        tvLabel: draft.tvLabel,
        tvYoutubeUrl: draft.tvYoutubeUrl,
        tvFacebookUrl: draft.tvFacebookUrl,
        fmLabel: draft.fmLabel,
      })
      setSettings(res.settings)
      toast.success('FM & TV enregistrés', { description: 'Les rubriques sont à jour sur le site public.' })
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  const saveSeo = async () => {
    setSavingTab('seo')
    try {
      const res = await adminApi.updateSettings({
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        seoImage: draft.seoImage,
        analyticsId: draft.analyticsId,
      })
      setSettings(res.settings)
      toast.success('SEO enregistré', { description: 'Les métadonnées du site sont à jour.' })
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  const saveMaintenance = async (on: boolean) => {
    setSavingTab('maintenance')
    try {
      const res = await adminApi.updateSettings({ maintenance: on ? 'on' : 'off' })
      setSettings(res.settings)
      setDraft((d) => ({ ...d, maintenance: res.settings.maintenance }))
      toast.success(on ? 'Mode maintenance activé' : 'Mode maintenance désactivé')
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  const saveStorage = async () => {
    setSavingTab('storage')
    try {
      // On n'envoie que les champs réellement modifiés : une valeur masquée (••••••••)
      // non touchée n'est jamais renvoyée, afin de ne pas écraser le secret existant.
      const payload: Record<string, unknown> = {}
      for (const k of STORAGE_FIELDS) {
        if (storageDraft[k] !== storageInitial[k]) payload[k] = storageDraft[k]
      }
      if (Object.keys(payload).length === 0) {
        toast.info('Aucune modification à enregistrer', { description: 'La configuration du stockage est inchangée.' })
        return
      }
      await adminApi.updateSettings(payload)
      setStorageInitial({ ...storageDraft })
      toast.success('Stockage enregistré', { description: 'Les identifiants Cloudinary et Google Drive sont à jour.' })
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  const runStorageTest = async () => {
    setTestingStorage(true)
    try {
      const res = await adminApi.testStorage()
      setStorageTest(res)
    } catch (e) {
      toast.error('Test des connexions impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setTestingStorage(false) }
  }

  const savePage = async (key: string) => {
    const d = pageDrafts[key]
    if (!d) return
    if (!d.title.trim()) { toast.error('Le titre de la page est obligatoire.'); return }
    setSavingTab(`page-${key}`)
    try {
      await adminApi.updatePage(key, { title: d.title.trim(), content: d.content })
      toast.success('Page enregistrée', { description: PAGE_DEFS.find((p) => p.key === key)?.label })
      await load()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : undefined })
    } finally { setSavingTab('') }
  }

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="Paramètres" description="Chargement de la configuration…" />
        <LinesSkeleton rows={8} />
      </div>
    )
  }

  const seoLen = (draft.seoDescription || '').length

  return (
    <div className="space-y-4">
      <PageHeader title="Paramètres" description="Identité du site, FM & TV, SEO, stockage, pages éditables et maintenance." />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-tg-gray h-auto p-1 flex-wrap">
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><Settings2 size={14} /> Général</TabsTrigger>
          <TabsTrigger value="fmtv" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><Radio size={14} /> FM & TV</TabsTrigger>
          <TabsTrigger value="storage" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><CloudUpload size={14} /> Stockage</TabsTrigger>
          <TabsTrigger value="seo" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><SearchCode size={14} /> SEO</TabsTrigger>
          <TabsTrigger value="pages" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><Eye size={14} /> Pages éditables</TabsTrigger>
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-white data-[state=active]:text-tg-navy gap-1.5"><ShieldAlert size={14} /> Maintenance</TabsTrigger>
        </TabsList>

        {/* ── Général ── */}
        <TabsContent value="general">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Nom du site <span className="text-tg-red">*</span></Label>
              <Input id="set-name" value={draft.siteName || ''} onChange={(e) => setDraft({ ...draft, siteName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-slogan">Slogan</Label>
              <Input id="set-slogan" value={draft.slogan || ''} onChange={(e) => setDraft({ ...draft, slogan: e.target.value })} placeholder="L'information au sommet de l'actualité" />
            </div>
            <div className="space-y-2">
              <Label>Logo du site</Label>
              {draft.logoUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-40 h-24 rounded-xl border border-zinc-200 bg-white overflow-hidden relative shrink-0 flex items-center justify-center">
                    <FadeImage src={draft.logoUrl} alt="Logo du site" fill sizes="160px" className="object-contain p-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-sm border border-zinc-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-tg-gray transition-colors text-tg-navy">
                      <Upload size={14} /> Remplacer
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        try {
                          const res = await uploadFile(file, 'image')
                          setDraft((d) => ({ ...d, logoUrl: res.url }))
                          if (res.warning) toast.warning('Logo importé avec réserve', { description: res.warning })
                          if (res.provider === 'cloudinary') toast.success('Logo transféré sur Cloudinary')
                        } catch (err) {
                          toast.error('Échec de l\'envoi', { description: err instanceof Error ? err.message : undefined })
                        }
                      }} />
                    </label>
                    <Button variant="ghost" size="sm" className="text-tg-red hover:bg-tg-red/10" onClick={() => setDraft({ ...draft, logoUrl: '' })}>
                      Retirer le logo
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 p-6 text-sm text-muted-foreground cursor-pointer hover:border-tg-red hover:bg-tg-gray/60 transition-colors">
                  <Upload size={16} /> Choisir un logo (PNG transparent recommandé)
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                      const res = await uploadFile(file, 'image')
                      setDraft((d) => ({ ...d, logoUrl: res.url }))
                      if (res.warning) toast.warning('Logo importé avec réserve', { description: res.warning })
                      if (res.provider === 'cloudinary') toast.success('Logo transféré sur Cloudinary')
                    } catch (err) {
                      toast.error('Échec de l\'envoi', { description: err instanceof Error ? err.message : undefined })
                    }
                  }} />
                </label>
              )}
            </div>
            <Button onClick={saveGeneral} disabled={savingTab === 'general'} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {savingTab === 'general' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer l'onglet Général
            </Button>
          </div>
        </TabsContent>

        {/* ── FM & TV ── */}
        <TabsContent value="fmtv">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 max-w-2xl space-y-4">
            {/* Section FM / Podcasts */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-tg-navy">Afficher la section FM / Podcasts sur le site</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lorsqu&apos;il est désactivé, la rubrique disparaît du menu, du pied de page et de la page d&apos;accueil.
                  Le lien direct /fm affiche une section indisponible.
                </p>
              </div>
              <Switch
                checked={draft.fmEnabled === 'on'}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, fmEnabled: v ? 'on' : 'off' }))}
                aria-label="Afficher la section FM / Podcasts"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-fmlabel">Libellé public de la section FM / Podcasts</Label>
              <Input id="set-fmlabel" value={draft.fmLabel || ''} onChange={(e) => setDraft({ ...draft, fmLabel: e.target.value })} placeholder="Ex. : Radio Topguinee FM" />
              <p className="text-[11px] text-muted-foreground">Ce libellé est affiché dans le menu et le titre de la section audio du site.</p>
            </div>

            <hr className="border-zinc-200" />

            {/* Rubrique TV */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-tg-navy">Afficher la rubrique TV sur le site</p>
                <p className="text-xs text-muted-foreground mt-0.5">La TV diffuse un direct YouTube ou Facebook, configurable ci-dessous.</p>
              </div>
              <Switch
                checked={draft.tvEnabled === 'on'}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, tvEnabled: v ? 'on' : 'off' }))}
                aria-label="Afficher la rubrique TV"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-tvlabel">Libellé public de la rubrique TV</Label>
              <Input id="set-tvlabel" value={draft.tvLabel || ''} onChange={(e) => setDraft({ ...draft, tvLabel: e.target.value })} placeholder="Ex. : Topguinee TV" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-tvyoutube">Lien direct / vidéo YouTube</Label>
              <Input
                id="set-tvyoutube"
                value={draft.tvYoutubeUrl || ''}
                onChange={(e) => setDraft({ ...draft, tvYoutubeUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=… ou https://www.youtube.com/live/…"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Laisser vide si vous n&apos;utilisez que Facebook.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-tvfacebook">Lien direct / vidéo Facebook</Label>
              <Input
                id="set-tvfacebook"
                value={draft.tvFacebookUrl || ''}
                onChange={(e) => setDraft({ ...draft, tvFacebookUrl: e.target.value })}
                placeholder="https://www.facebook.com/watch/live/?v=…"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">La vidéo Facebook doit être publique pour pouvoir être intégrée.</p>
            </div>

            <Button onClick={saveFmTv} disabled={savingTab === 'fmtv'} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {savingTab === 'fmtv' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer l&apos;onglet FM & TV
            </Button>
          </div>
        </TabsContent>

        {/* ── Stockage ── */}
        <TabsContent value="storage">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 max-w-2xl space-y-5">
            {/* Cloudinary (images) */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-tg-navy">Cloudinary — images et audios</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tout est transféré sur Cloudinary : images (couvertures, logos, publicités) ET fichiers audio
                  (podcasts, émissions) — servis directement par le CDN, y compris sur les hébergements à
                  système de fichiers éphémère (Vercel). Recommandé : c&apos;est la configuration active.
                  Créez un compte gratuit sur cloudinary.com → Dashboard → copiez Cloud name / API key / API secret.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-cloudname">Cloud name</Label>
                <Input
                  id="st-cloudname"
                  value={storageDraft.storageCloudName}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageCloudName: e.target.value }))}
                  placeholder="ex. topguinee"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-apikey">API key</Label>
                <Input
                  id="st-apikey"
                  value={storageDraft.storageCloudApiKey}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageCloudApiKey: e.target.value }))}
                  placeholder="ex. 774826315298964"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-apisecret">API secret</Label>
                <Input
                  id="st-apisecret"
                  type="password"
                  value={storageDraft.storageCloudApiSecret}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageCloudApiSecret: e.target.value }))}
                  placeholder="Votre clé secrète Cloudinary"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Affichée masquée ({STORAGE_MASKED}) une fois configurée — ne la ressaisissez que pour la remplacer.</p>
              </div>
            </div>

            <hr className="border-zinc-200" />

            {/* Google Drive (audio / podcasts) */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-tg-navy">Google Drive — repli audio (facultatif)</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Utilisé pour les audio UNIQUEMENT si Cloudinary n&apos;est pas configuré : les fichiers sont
                  transférés dans ce dossier Drive et diffusés en streaming (le son n&apos;est jamais stocké sur
                  le site). Dans Google Cloud : activez l&apos;API Drive, créez un compte de service, générez une
                  clé JSON, puis partagez le dossier Drive avec l&apos;e-mail du compte de service (lecteur).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-drivefolder">Identifiant du dossier Drive</Label>
                <Input
                  id="st-drivefolder"
                  value={storageDraft.storageDriveFolderId}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageDriveFolderId: e.target.value }))}
                  placeholder="1AbC… (l'ID dans l'URL du dossier)"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-driveemail">E-mail du compte de service</Label>
                <Input
                  id="st-driveemail"
                  value={storageDraft.storageDriveClientEmail}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageDriveClientEmail: e.target.value }))}
                  placeholder="topguinee@mon-projet.iam.gserviceaccount.com"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-drivekey">Clé privée du compte de service</Label>
                <Textarea
                  id="st-drivekey"
                  rows={4}
                  value={storageDraft.storageDrivePrivateKey}
                  onChange={(e) => setStorageDraft((s) => ({ ...s, storageDrivePrivateKey: e.target.value }))}
                  placeholder="Coller ici la clé privée (PEM complet ou champ private_key de la clé JSON)"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Affichée masquée ({STORAGE_MASKED}) une fois configurée — ne la ressaisissez que pour la remplacer.</p>
              </div>
            </div>

            {/* Actions + résultat du test */}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={saveStorage} disabled={savingTab === 'storage'} className="bg-tg-red hover:bg-tg-red-dark text-white">
                {savingTab === 'storage' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer la configuration
              </Button>
              <Button variant="outline" onClick={runStorageTest} disabled={testingStorage}>
                {testingStorage ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />} Tester les connexions
              </Button>
            </div>
            {storageTest && (
              <div className="space-y-2">
                <StorageTestBadge label="Cloudinary (images + audios)" result={storageTest.cloudinary} />
                <StorageTestBadge label="Google Drive (repli audio)" result={storageTest.drive} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── SEO ── */}
        <TabsContent value="seo">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 space-y-4 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="set-seotitle">Titre SEO (balise title)</Label>
              <Input id="set-seotitle" value={draft.seoTitle || ''} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} placeholder="Topguinee.info — L'information au sommet de l'actualité" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="set-seodesc">Meta description</Label>
                <span className={cn('text-[11px] font-semibold tabular-nums', seoLen <= 160 ? 'text-tg-green' : 'text-tg-red')}>{seoLen}/160</span>
              </div>
              <Textarea id="set-seodesc" rows={3} value={draft.seoDescription || ''} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} placeholder="Découvrez toute l'actualité guinéenne : politique, économie, société, sport et culture…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-seoimg">Image de partage (Open Graph)</Label>
              <Input id="set-seoimg" value={draft.seoImage || ''} onChange={(e) => setDraft({ ...draft, seoImage: e.target.value })} placeholder="/uploads/cover-une.png ou https://…" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-ga">Identifiant Analytics</Label>
              <Input id="set-ga" value={draft.analyticsId || ''} onChange={(e) => setDraft({ ...draft, analyticsId: e.target.value })} placeholder="G-XXXXXXXXXX" className="font-mono text-sm" />
            </div>
            <Button onClick={saveSeo} disabled={savingTab === 'seo'} className="bg-tg-red hover:bg-tg-red-dark text-white">
              {savingTab === 'seo' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer l'onglet SEO
            </Button>
          </div>
        </TabsContent>

        {/* ── Pages éditables ── */}
        <TabsContent value="pages">
          <Tabs defaultValue="about" className="space-y-3">
            <TabsList className="bg-tg-gray p-1">
              {PAGE_DEFS.map((p) => (
                <TabsTrigger key={p.key} value={p.key} className="data-[state=active]:bg-white data-[state=active]:text-tg-navy text-sm">{p.label}</TabsTrigger>
              ))}
            </TabsList>
            {PAGE_DEFS.map((p) => {
              const d = pageDrafts[p.key] || { title: '', content: '' }
              return (
                <TabsContent key={p.key} value={p.key}>
                  <div className="bg-card rounded-2xl border border-zinc-200 p-5 space-y-4">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info size={13} /> {p.hint}</p>
                    <div className="space-y-1.5">
                      <Label htmlFor={`pg-title-${p.key}`}>Titre de la page</Label>
                      <Input
                        id={`pg-title-${p.key}`} value={d.title}
                        onChange={(e) => setPageDrafts((m) => ({ ...m, [p.key]: { ...m[p.key], title: e.target.value } }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`pg-content-${p.key}`}>Contenu (HTML enrichi)</Label>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-tg-green/40 text-tg-green hover:bg-tg-green/10">
                              <Eye size={13} /> Aperçu
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto tg-scroll">
                            <DialogHeader>
                              <DialogTitle className="text-left">{d.title || p.label}</DialogTitle>
                            </DialogHeader>
                            <RichText html={d.content || '<p>Page vide.</p>'} />
                          </DialogContent>
                        </Dialog>
                      </div>
                      <Textarea
                        id={`pg-content-${p.key}`}
                        rows={14}
                        value={d.content}
                        onChange={(e) => setPageDrafts((m) => ({ ...m, [p.key]: { ...m[p.key], content: e.target.value } }))}
                        className="font-mono text-[13px] leading-relaxed"
                        placeholder="<h2>Notre mission</h2><p>Topguinee.info informe…</p>"
                      />
                      <p className="text-[11px] text-muted-foreground">Balises autorisées : h2, h3, p, strong, em, ul, ol, li, a, blockquote… Le HTML est nettoyé à l&apos;affichage (sécurité).</p>
                    </div>
                    <Button onClick={() => savePage(p.key)} disabled={savingTab === `page-${p.key}`} className="bg-tg-red hover:bg-tg-red-dark text-white">
                      {savingTab === `page-${p.key}` ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer la page
                    </Button>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </TabsContent>

        {/* ── Maintenance ── */}
        <TabsContent value="maintenance">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 max-w-2xl space-y-4">
            <div className="rounded-xl border border-tg-red/40 bg-tg-red/5 p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-tg-red shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-tg-navy text-sm">Mode maintenance</p>
                <p className="text-sm text-zinc-600 mt-1">
                  Lorsqu&apos;il est activé, le site public affiche une page « Maintenance en cours » pour les visiteurs.
                  Le cockpit éditorial reste accessible à l&apos;équipe connectée.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-tg-navy">Activer le mode maintenance</p>
                <p className="text-xs text-muted-foreground">État actuel : <span className={settings.maintenance === 'on' ? 'font-bold text-tg-red' : 'font-bold text-tg-green'}>{settings.maintenance === 'on' ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</span></p>
              </div>
              <Switch
                checked={settings.maintenance === 'on'}
                onCheckedChange={(v) => saveMaintenance(v)}
                disabled={savingTab === 'maintenance'}
                aria-label="Mode maintenance"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
