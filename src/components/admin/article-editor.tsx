'use client'
// Éditeur d'article WYSIWYG avec sauvegarde automatique (§7.5)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt, uploadFile } from '@/lib/api'
import { navigate } from '@/lib/router'
import { sanitizeRichText, safeHttpUrl } from '@/lib/sanitize'
import { youtubeId, YouTubeEmbed, FadeImage, RichText } from '@/components/tg/shared'
import type { ArticleFull, ArticleStatus, Rubrique, TgUser } from '@/lib/types'
import { ImageDropzone, toInputDate } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  AlignCenter, AlignLeft, ArrowLeft, AudioLines, Bold, CalendarClock, Check, Clock,
  Copy, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered,
  Loader2, Minus, Quote, Save, Send, Table2, Underline, Undo2, Youtube,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Forme normalisée d'un brouillon (comparaison autosave) ───────

interface DraftFields {
  title: string; subtitle: string; description: string; body: string
  rubriqueId: string; subRubriqueId: string | null
  coverImage: string | null; coverAlt: string
  youtubeUrl: string | null; tags: string[]
  status: ArticleStatus; scheduledAt: string | null
}

function makePayload(f: DraftFields): Record<string, unknown> {
  return {
    title: f.title.trim(),
    subtitle: f.subtitle,
    description: f.description,
    body: f.body,
    rubriqueId: f.rubriqueId || null,
    subRubriqueId: f.subRubriqueId,
    coverImage: f.coverImage,
    coverAlt: f.coverAlt || f.title.trim(),
    youtubeUrl: f.youtubeUrl,
    tags: f.tags,
    status: f.status,
    scheduledAt: f.scheduledAt,
  }
}

const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'REVIEW', label: 'En relecture' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'UNPUBLISHED', label: 'Dépublié' },
  { value: 'ARCHIVED', label: 'Archivé' },
]

// ─── Composant principal ──────────────────────────────────────────

export function ArticleEditor({ id, user }: { id?: string | null; user: TgUser | null }) {
  // Chargement
  const [loading, setLoading] = useState(!!id)
  const [slug, setSlug] = useState('')
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [articleId, setArticleId] = useState<string | null>(id || null)

  // Champs
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [rubriqueId, setRubriqueId] = useState('')
  const [subRubriqueId, setSubRubriqueId] = useState('')
  const [rubriques, setRubriques] = useState<Rubrique[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverAlt, setCoverAlt] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<ArticleStatus>('DRAFT')
  const [scheduledAtInput, setScheduledAtInput] = useState('')
  const [dupNotif, setDupNotif] = useState('')

  // Sauvegarde
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [autosaveTick, setAutosaveTick] = useState(0)
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [noRubriqueOpen, setNoRubriqueOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Refs
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const articleIdRef = useRef<string | null>(id || null)
  const lastSavedRef = useRef<string | null>(null)
  const savingRef = useRef(false)
  const hydratedRef = useRef(false)
  const audioFileRef = useRef<HTMLInputElement>(null)
  const imgFileRef = useRef<HTMLInputElement>(null)

  const subRubriques = rubriques.filter((r) => r.parentId === rubriqueId)
  const currentRubrique = rubriques.find((r) => r.id === rubriqueId)
  const scheduledIso = scheduledAtInput ? (() => { const d = new Date(scheduledAtInput); return isNaN(d.getTime()) ? null : d.toISOString() })() : null

  const currentFields = useCallback((): DraftFields => ({
    title, subtitle, description, body,
    rubriqueId, subRubriqueId: subRubriqueId || null,
    coverImage, coverAlt, youtubeUrl: youtubeUrl || null, tags,
    status, scheduledAt: scheduledIso,
  }), [title, subtitle, description, body, rubriqueId, subRubriqueId, coverImage, coverAlt, youtubeUrl, tags, status, scheduledIso])

  // ── Chargement rubriques + article ───────────────────────────────
  useEffect(() => {
    adminApi.rubriques().then((r) => setRubriques(r.rubriques)).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const targetId = id || null
    if (!targetId) {
      // Nouvel article : ne réinitialiser qu'une fois par montage
      if (hydratedRef.current) return
      hydratedRef.current = true
      articleIdRef.current = null
      setArticleId(null)
      lastSavedRef.current = null
      return
    }
    if (articleIdRef.current === targetId && hydratedRef.current) return
    hydratedRef.current = true
    setLoading(true)
    adminApi.article(targetId)
      .then(({ article }) => {
        if (cancelled) return
        hydrate(article)
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error("Impossible de charger l'article", { description: e instanceof Error ? e.message : undefined })
          navigate('/admin/articles')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  function hydrate(a: ArticleFull) {
    articleIdRef.current = a.id
    setArticleId(a.id)
    setTitle(a.title || '')
    setSubtitle(a.subtitle || '')
    setDescription(a.description || '')
    setRubriqueId(a.rubriqueId || '')
    setSubRubriqueId(a.subRubriqueId || '')
    setCoverImage(a.coverImage || null)
    setCoverAlt(a.coverAlt || '')
    setYoutubeUrl(a.youtubeUrl || '')
    setTags((a.tags || []).map((t) => t.name))
    setBody(a.body || '')
    setStatus(a.status)
    setScheduledAtInput(a.scheduledAt ? toInputDate(a.scheduledAt) : '')
    setSlug(a.slug || '')
    setCreatedAt(a.createdAt)
    setUpdatedAt(a.updatedAt)
    // innerHTML n'est JAMAIS alimenté avec du HTML brut : le corps est passé
    // par la liste blanche (les handlers onerror=… d'un contenu piégé ne
    // s'exécutent pas pendant l'édition, même si la base a été altérée).
    if (editorRef.current) editorRef.current.innerHTML = sanitizeRichText(a.body || '')
    lastSavedRef.current = JSON.stringify(makePayload({
      title: a.title || '', subtitle: a.subtitle || '', description: a.description || '',
      body: a.body || '', rubriqueId: a.rubriqueId || '', subRubriqueId: a.subRubriqueId || null,
      coverImage: a.coverImage || null, coverAlt: a.coverAlt || '', youtubeUrl: a.youtubeUrl || null,
      tags: (a.tags || []).map((t) => t.name), status: a.status,
      scheduledAt: a.scheduledAt || null,
    }))
  }

  // ── Sauvegarde ───────────────────────────────────────────────────
  const persist = useCallback(async (override?: Partial<DraftFields>, opts?: { silent?: boolean; onSuccessStatus?: string }): Promise<boolean> => {
    if (savingRef.current) return false
    const f = { ...currentFields(), ...override }
    if (!f.title.trim()) {
      if (!opts?.silent) toast.error('Le titre est obligatoire pour enregistrer.')
      return false
    }
    savingRef.current = true
    setSaving(true)
    try {
      const payload = makePayload(f)
      const json = JSON.stringify(payload)
      let saved: ArticleFull
      if (articleIdRef.current) {
        const res = await adminApi.updateArticle(articleIdRef.current, payload)
        saved = res.article
      } else {
        const res = await adminApi.createArticle(payload)
        saved = res.article
        articleIdRef.current = saved.id
        setArticleId(saved.id)
        setSlug(saved.slug)
        setCreatedAt(saved.createdAt)
        // Mettre à jour l'URL sans recharger le composant
        window.history.replaceState(null, '', `#/admin/articles/edit?id=${saved.id}`)
      }
      lastSavedRef.current = json
      setUpdatedAt(new Date().toISOString())
      setSavedAt(new Date())
      setAutosaveError(null)
      if (opts?.onSuccessStatus) setStatus(opts.onSuccessStatus as ArticleStatus)
      // Sauvegarde réussie : le secours local n'est plus nécessaire
      try { window.localStorage.removeItem(`tg-draft-fallback`) } catch { /* ignore */ }
      return true
    } catch (e) {
      const message = e instanceof Error ? e.message : undefined
      if (opts?.silent) {
        // Autosave en échec (session expirée, réseau…) : copie de secours
        // locale + signalement discret — jamais de perte de travail silencieuse.
        setAutosaveError(message || 'Sauvegarde impossible')
        try {
          window.localStorage.setItem('tg-draft-fallback', JSON.stringify({
            articleId: articleIdRef.current, at: new Date().toISOString(), payload: makePayload(f),
          }))
        } catch { /* quota localStorage : ignoré */ }
      } else {
        toast.error('Enregistrement impossible', { description: message })
      }
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [currentFields])

  // Sauvegarde automatique : 2,5 s d'inactivité
  useEffect(() => {
    if (loading) return
    const json = JSON.stringify(makePayload(currentFields()))
    if (json === lastSavedRef.current) return
    if (!title.trim() || !rubriqueId) return
    const t = setTimeout(() => {
      void persist(undefined, { silent: true }).then((ok) => {
        if (ok && JSON.stringify(makePayload(currentFields())) !== lastSavedRef.current) {
          setAutosaveTick((v) => v + 1) // des modifications pendant l'envoi : nouvelle passe
        }
      })
    }, 2500)
    return () => clearTimeout(t)
  }, [title, subtitle, description, body, rubriqueId, subRubriqueId, coverImage, coverAlt, youtubeUrl, tags, status, scheduledIso, loading, autosaveTick])

  // ── Éditeur WYSIWYG ──────────────────────────────────────────────
  const syncBody = useCallback(() => {
    if (editorRef.current) setBody(editorRef.current.innerHTML)
  }, [])

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel) return
    if (savedRangeRef.current) {
      try { sel.removeAllRanges(); sel.addRange(savedRangeRef.current) } catch { /* ignore */ }
    }
    editorRef.current?.focus()
  }, [])

  const exec = useCallback((cmd: string, val?: string) => {
    restoreSelection()
    document.execCommand(cmd, false, val)
    saveSelection()
    syncBody()
  }, [restoreSelection, saveSelection, syncBody])

  const insertHtml = useCallback((html: string) => {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    saveSelection()
    syncBody()
  }, [restoreSelection, saveSelection, syncBody])

  const addLink = () => {
    const raw = window.prompt('Adresse du lien (https://…)')
    if (!raw) return
    // Seuls http(s) et mailto sont acceptés — un « javascript: » collé ici
    // ne pourra jamais finir dans le corps de l'article.
    const url = safeHttpUrl(raw) || (/^mailto:[^\s@]+@[^\s@]+$/.test(raw.trim()) ? raw.trim() : '')
    if (!url) {
      toast.error('Adresse invalide', { description: 'Le lien doit commencer par https:// (ou http://).' })
      return
    }
    restoreSelection()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) insertHtml(`<a href="${url}">${url}</a>`)
    else exec('createLink', url)
  }

  const addYoutube = () => {
    const url = window.prompt('Lien de la vidéo YouTube (https://www.youtube.com/watch?v=…)')
    if (!url) return
    const vid = youtubeId(url)
    if (!vid) { toast.error('Lien YouTube invalide', { description: 'Exemple : https://www.youtube.com/watch?v=XXXXXXXXXXX' }); return }
    insertHtml(`<iframe src="https://www.youtube.com/embed/${vid}" title="Vidéo YouTube" allowfullscreen></iframe><p><br/></p>`)
  }

  const insertTable = () => {
    insertHtml(
      '<table><thead><tr><th>Colonne 1</th><th>Colonne 2</th><th>Colonne 3</th></tr></thead>' +
      '<tbody><tr><td>—</td><td>—</td><td>—</td></tr><tr><td>—</td><td>—</td><td>—</td></tr></tbody></table><p><br/></p>'
    )
  }

  const onEditorImage = async (file?: File | null) => {
    if (!file) return
    try {
      const res = await uploadFile(file, 'image')
      insertHtml(`<img src="${res.url}" alt="${file.name.replace(/\.[^.]+$/, '')}" /><p><br/></p>`)
      if (res.warning) toast.warning('Image insérée avec réserve', { description: res.warning })
      else toast.success('Image insérée dans le corps de l\'article')
    } catch (e) {
      toast.error("Échec de l'envoi de l'image", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const onEditorAudio = async (file?: File | null) => {
    if (!file) return
    try {
      const res = await uploadFile(file, 'audio')
      insertHtml(`<audio controls src="${res.url}"></audio><p><br/></p>`)
      if (res.warning) toast.warning('Audio inséré avec réserve', { description: res.warning })
      else toast.success('Lecteur audio inséré dans l\'article')
    } catch (e) {
      toast.error("Échec de l'envoi de l'audio", { description: e instanceof Error ? e.message : undefined })
    }
  }

  // ── Tags ─────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().replace(/,+$/, '')
    if (!t) return
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setTagInput(''); return }
    if (tags.length >= 10) { toast.warning('Maximum 10 tags par article.'); return }
    setTags([...tags, t])
    setTagInput('')
  }

  // ── Actions statut ───────────────────────────────────────────────
  const requestPublish = async () => {
    if (!title.trim()) { toast.error('Renseignez le titre avant de publier.'); return }
    if (!rubriqueId) { setNoRubriqueOpen(true); return }
    const ok = await persist({ status: 'PUBLISHED' }, { onSuccessStatus: 'PUBLISHED' })
    if (ok) {
      const prog = scheduledIso && new Date(scheduledIso).getTime() > Date.now()
      toast.success(prog ? 'Article programmé' : 'Article publié !', {
        description: prog
          ? `Il sera mis en ligne le ${fmt.dateTime(scheduledIso)}.`
          : '« ' + title.trim() + ' » est désormais en ligne sur le site.',
      })
    }
  }

  const quickSave = async (next: ArticleStatus, label: string) => {
    const ok = await persist({ status: next }, { onSuccessStatus: next })
    if (ok) toast.success(label)
  }

  const duplicate = async () => {
    if (!articleIdRef.current) { toast.error("Enregistrez l'article avant de le dupliquer."); return }
    try {
      const { article } = await adminApi.duplicateArticle(articleIdRef.current)
      setDupNotif(`Copie créée : « ${article.title} »`)
      toast.success('Article dupliqué', { description: 'La copie a été ouverte dans un brouillon.' })
      navigate(`/admin/articles/edit?id=${article.id}`)
    } catch (e) {
      toast.error('Duplication impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const isPublishedNow = status === 'PUBLISHED'
  const isScheduled = isPublishedNow && scheduledIso && new Date(scheduledIso).getTime() > Date.now()

  // ── Toolbar ──────────────────────────────────────────────────────
  const TOOL_BTN = 'h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-tg-navy hover:bg-tg-gray hover:text-tg-red transition-colors'

  const toolbar = (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-200 px-2 py-1.5 flex items-center gap-0.5 flex-wrap" role="toolbar" aria-label="Mise en forme du texte">
      <button type="button" className={TOOL_BTN} title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}><Bold size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Italique" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}><Italic size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Souligné" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}><Underline size={15} /></button>
      <span className="w-px h-5 bg-zinc-200 mx-1" aria-hidden />
      <button type="button" className={TOOL_BTN} title="Titre de section (H2)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', '<h2>')}><Heading2 size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Sous-titre (H3)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', '<h3>')}><Heading3 size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Citation" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('formatBlock', '<blockquote>')}><Quote size={15} /></button>
      <span className="w-px h-5 bg-zinc-200 mx-1" aria-hidden />
      <button type="button" className={TOOL_BTN} title="Liste à puces" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}><List size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Liste numérotée" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Insérer un lien" onMouseDown={(e) => e.preventDefault()} onClick={addLink}><Link2 size={15} /></button>
      <span className="w-px h-5 bg-zinc-200 mx-1" aria-hidden />
      <button type="button" className={TOOL_BTN} title="Aligner à gauche" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')}><AlignLeft size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Centrer" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')}><AlignCenter size={15} /></button>
      <span className="w-px h-5 bg-zinc-200 mx-1" aria-hidden />
      <button type="button" className={TOOL_BTN} title="Insérer un tableau" onMouseDown={(e) => e.preventDefault()} onClick={insertTable}><Table2 size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Séparateur horizontal" onMouseDown={(e) => e.preventDefault()} onClick={() => insertHtml('<hr /><p><br/></p>')}><Minus size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Insérer une image" onMouseDown={(e) => e.preventDefault()} onClick={() => imgFileRef.current?.click()}><ImagePlus size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Insérer une vidéo YouTube" onMouseDown={(e) => e.preventDefault()} onClick={addYoutube}><Youtube size={15} /></button>
      <button type="button" className={TOOL_BTN} title="Insérer un fichier audio" onMouseDown={(e) => e.preventDefault()} onClick={() => audioFileRef.current?.click()}><AudioLines size={15} /></button>
    </div>
  )

  // ── Rendu ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-9 w-40 rounded bg-zinc-100" />
        <div className="h-14 rounded-xl bg-zinc-100" />
        <div className="h-32 rounded-xl bg-zinc-100" />
        <div className="h-64 rounded-xl bg-zinc-100" />
      </div>
    )
  }

  const descOk = description.length <= 160

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Barre supérieure */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/admin/articles')} aria-label="Retour à la liste des articles">
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-tg-navy font-display truncate">
              {articleId ? 'Modifier l\'article' : 'Nouvel article'}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {slug ? <>Slug : <code className="text-tg-green">{slug}</code></> : 'Le slug sera généré automatiquement'}
              {articleId && createdAt && <> · Créé le {fmt.short(createdAt)}</>}
              {updatedAt && <> · Modifié le {fmt.short(updatedAt)}</>}
            </p>
          </div>
        </div>

        {/* État de sauvegarde */}
        <div className="flex items-center gap-2 shrink-0">
          {autosaveError && !saving && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-tg-red bg-tg-red/10 px-2.5 py-1.5 rounded-full"
              title="Une copie de secours de votre brouillon est conservée dans ce navigateur"
            >
              <Clock size={13} /> Sauvegarde impossible — brouillon sécurisé localement
            </span>
          )}
          {saving ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1.5 rounded-full">
              <Loader2 size={13} className="animate-spin" /> Enregistrement…
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tg-green bg-tg-green/10 px-2.5 py-1.5 rounded-full">
              <Check size={13} /> Enregistré à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1.5 rounded-full">
              <Clock size={13} /> {title.trim() && rubriqueId ? 'Brouillon en cours' : 'Titre + rubrique requis pour l\'autosave'}
            </span>
          )}
        </div>
      </div>

      {dupNotif && (
        <div className="rounded-xl border border-tg-yellow/60 bg-tg-yellow/15 text-tg-navy text-sm px-4 py-2.5">{dupNotif}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* ── Colonne principale ── */}
        <div className="space-y-5 min-w-0">
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 space-y-4">
            <div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de l'article…"
                className="text-xl md:text-2xl font-bold h-auto py-2.5 border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-zinc-300"
                aria-label="Titre de l'article"
              />
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Sous-titre (accroche affichée sous le titre)…"
                className="text-sm border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-zinc-300"
                aria-label="Sous-titre"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="ed-desc" className="text-xs text-muted-foreground">Description / chapeau (moteurs de recherche, cartes de partage)</Label>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums', descOk ? 'text-tg-green' : 'text-tg-red')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', descOk ? 'bg-tg-green' : 'bg-tg-red')} />
                  {description.length}/160
                </span>
              </div>
              <Textarea
                id="ed-desc" rows={3} value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Résumé court de l'article (160 caractères recommandés)…"
                className={cn('resize-none', !descOk && 'border-tg-red/50 focus-visible:ring-tg-red/30')}
              />
            </div>
          </div>

          {/* Éditeur WYSIWYG */}
          <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
            {toolbar}
            <div
              ref={editorRef}
              className="tg-editor tg-prose min-h-[320px] max-h-none px-5 py-4 focus:outline-none"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Corps de l'article"
              data-placeholder="Rédigez votre article ici… Utilisez la barre d'outils pour mettre en forme le texte, insérer des images, vidéos ou audio."
              onInput={syncBody}
              onBlur={saveSelection}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
            />
          </div>

          {/* Médias */}
          <div className="bg-card rounded-2xl border border-zinc-200 p-5 space-y-5">
            <ImageDropzone value={coverImage} onChange={setCoverImage} alt={coverAlt} onAltChange={setCoverAlt} label="Image de couverture" />

            <div className="space-y-2">
              <Label htmlFor="ed-yt" className="text-sm font-medium text-tg-navy">Vidéo YouTube (facultatif)</Label>
              <Input
                id="ed-yt" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className={cn(youtubeUrl && !youtubeId(youtubeUrl) && 'border-tg-red/50 focus-visible:ring-tg-red/30')}
              />
              {youtubeUrl && !youtubeId(youtubeUrl) && (
                <p className="text-xs text-tg-red font-medium">Lien YouTube non reconnu. Formats acceptés : youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…</p>
              )}
              {youtubeId(youtubeUrl) && <YouTubeEmbed url={youtubeUrl} title={title || 'Aperçu vidéo'} />}
            </div>
          </div>
        </div>

        {/* ── Colonne latérale ── */}
        <div className="space-y-5 lg:sticky lg:top-20">
          {/* Publication */}
          <div className="bg-card rounded-2xl border border-zinc-200 p-4 space-y-4">
            <h3 className="font-bold text-tg-navy text-sm flex items-center gap-2"><Save size={15} className="text-tg-red" /> Publication</h3>

            <div className="space-y-1.5">
              <Label htmlFor="ed-status" className="text-xs">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ArticleStatus)}>
                <SelectTrigger id="ed-status" className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isPublishedNow && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-sched" className="text-xs flex items-center gap-1"><CalendarClock size={12} /> Programmation (facultatif)</Label>
                <Input
                  id="ed-sched" type="datetime-local" value={scheduledAtInput}
                  onChange={(e) => setScheduledAtInput(e.target.value)}
                  className="h-9 text-xs"
                />
                {isScheduled && (
                  <p className="text-[11px] font-medium text-tg-green flex items-center gap-1">
                    <Clock size={11} /> Mise en ligne programmée le {fmt.dateTime(scheduledIso)}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 pt-1">
              {isPublishedNow ? (
                <Button
                  variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => quickSave('UNPUBLISHED', 'Article dépublié')}
                >
                  <Undo2 size={15} /> Dépublier
                </Button>
              ) : (
                <Button className="bg-tg-green hover:bg-tg-green-dark text-white font-semibold" onClick={requestPublish}>
                  <Send size={15} /> {scheduledAtInput ? 'Programmer la publication' : 'Publier'}
                </Button>
              )}
              <Button variant="outline" onClick={() => quickSave('REVIEW', 'Article soumis à relecture')} className="border-tg-yellow/70 text-yellow-800 hover:bg-tg-yellow/20">
                Soumettre à relecture
              </Button>
              <Button variant="outline" onClick={() => quickSave('DRAFT', 'Brouillon enregistré')} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
                Enregistrer comme brouillon
              </Button>
              <Button variant="outline" onClick={() => void persist()} className="border-tg-green/40 text-tg-green hover:bg-tg-green/10">
                <Save size={15} /> Enregistrer maintenant
              </Button>
            </div>
          </div>

          {/* Classement */}
          <div className="bg-card rounded-2xl border border-zinc-200 p-4 space-y-4">
            <h3 className="font-bold text-tg-navy text-sm">Classement</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Rubrique <span className="text-tg-red">*</span></Label>
              <Select value={rubriqueId || undefined} onValueChange={(v) => { setRubriqueId(v); setSubRubriqueId('') }}>
                <SelectTrigger className={cn('h-9', !rubriqueId && 'border-tg-red/40')} aria-label="Rubrique de l'article">
                  <SelectValue placeholder="Choisir une rubrique…" />
                </SelectTrigger>
                <SelectContent>
                  {rubriques.filter((r) => !r.parentId).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />{r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sous-rubrique (facultatif)</Label>
              <Select value={subRubriqueId || undefined} onValueChange={(v) => setSubRubriqueId(v)} disabled={!rubriqueId}>
                <SelectTrigger className="h-9" aria-label="Sous-rubrique de l'article">
                  <SelectValue placeholder={rubriqueId ? 'Aucune' : 'Choisissez d\'abord une rubrique'} />
                </SelectTrigger>
                <SelectContent>
                  {subRubriques.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {currentRubrique && subRubriques.length === 0 && (
                <p className="text-[11px] text-muted-foreground">« {currentRubrique.name} » n&apos;a pas de sous-rubrique.</p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="ed-tag" className="text-xs">Tags</Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 bg-tg-navy/5 text-tg-navy text-xs font-medium px-2 py-1 rounded-md border border-zinc-200">
                      #{t}
                      <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Retirer le tag ${t}`} className="text-zinc-400 hover:text-tg-red transition-colors">
                        <span className="text-sm leading-none">×</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  id="ed-tag" value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Ajouter un tag… (Entrée)"
                  className="h-9 text-sm"
                />
                <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={addTag}>Ajouter</Button>
              </div>
            </div>

            {/* Auteur */}
            <div className="pt-2 border-t border-zinc-100">
              <p className="text-[11px] text-muted-foreground">Auteur</p>
              <p className="text-sm font-semibold text-tg-navy">{user?.name || '—'}</p>
              <p className="text-[11px] text-muted-foreground">Attribué automatiquement (compte connecté)</p>
            </div>
          </div>

          {/* Actions diverses */}
          <div className="bg-card rounded-2xl border border-zinc-200 p-4 space-y-2">
            <h3 className="font-bold text-tg-navy text-sm mb-1">Autres actions</h3>
            <Button variant="outline" className="w-full justify-start border-zinc-300 text-tg-navy hover:bg-tg-gray" onClick={() => setPreviewOpen(true)}>
              <Eye size={15} /> Aperçu public
            </Button>
            <Button variant="outline" className="w-full justify-start border-zinc-300 text-tg-navy hover:bg-tg-gray" onClick={duplicate}>
              <Copy size={15} /> Dupliquer l&apos;article
            </Button>
            {slug && (
              <Button variant="outline" className="w-full justify-start border-tg-green/40 text-tg-green hover:bg-tg-green/10" onClick={() => navigate(`/article/${slug}`)}>
                Voir sur le site
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Inputs fichiers cachés pour l'éditeur */}
      <input ref={imgFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onEditorImage(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { void onEditorAudio(e.target.files?.[0]); e.target.value = '' }} />

      {/* Confirmation publication sans rubrique */}
      <AlertDialog open={noRubriqueOpen} onOpenChange={setNoRubriqueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier sans rubrique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Aucune rubrique n&apos;est sélectionnée. L&apos;article apparaîtra en « Actualités » génériques et sera plus difficile à trouver sur le site. Nous recommandons de choisir une rubrique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Choisir une rubrique</AlertDialogCancel>
            <AlertDialogAction
              className="bg-tg-green hover:bg-tg-green-dark text-white"
              onClick={() => { setNoRubriqueOpen(false); void persist({ status: 'PUBLISHED' }, { onSuccessStatus: 'PUBLISHED' }).then((ok) => { if (ok) toast.success('Article publié !') }) }}
            >
              Publier quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aperçu public plein écran */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto tg-scroll p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Aperçu de l&apos;article</DialogTitle>
          </DialogHeader>
          <article className="p-6 md:p-8">
            {currentRubrique && (
              <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide text-white px-2.5 py-1 rounded-md mb-4" style={{ backgroundColor: currentRubrique.color }}>
                {currentRubrique.name}
              </span>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-tg-navy font-display leading-tight">{title || 'Titre de l\'article'}</h1>
            {subtitle && <p className="text-zinc-500 text-base mt-2">{subtitle}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 pb-4 border-b border-zinc-100">
              <span className="font-semibold text-tg-navy">{user?.name}</span>
              <span aria-hidden>•</span>
              <span>{fmt.dateTime(new Date().toISOString())}</span>
            </div>
            {coverImage && (
              <div className="relative aspect-video rounded-2xl overflow-hidden mt-5">
                <FadeImage src={coverImage} alt={coverAlt || title} fill sizes="(max-width:768px) 100vw, 700px" priority />
              </div>
            )}
            <RichText html={body || '<p>Le corps de l\'article est vide…</p>'} className="mt-6" />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-4 border-t border-zinc-100">
                {tags.map((t) => <span key={t} className="text-xs font-medium text-tg-navy bg-tg-gray px-2.5 py-1 rounded-full">#{t}</span>)}
              </div>
            )}
          </article>
        </DialogContent>
      </Dialog>
    </div>
  )
}
