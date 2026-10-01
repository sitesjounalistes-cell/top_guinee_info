'use client'
// Gestion des articles — liste, filtres, actions (§7.3)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt, STATUS_LABELS } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { ArticleCardData, ArticleStatus, Rubrique } from '@/lib/types'
import { FadeImage, StatusBadge, RichInline } from '@/components/tg/shared'
import { stripHtml } from '@/lib/sanitize'
import { useDebounced } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  ChevronLeft, ChevronRight, Copy, ExternalLink, FilePlus2, FileText,
  Loader2, MoreHorizontal, Pencil, Search, Send, Trash2, Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'REVIEW', label: 'En relecture' },
  { key: 'PUBLISHED', label: 'Publiés' },
  { key: 'UNPUBLISHED', label: 'Dépubliés' },
  { key: 'ARCHIVED', label: 'Archivés' },
]

export function ArticlesList({ initialQ }: { initialQ?: string }) {
  const [items, setItems] = useState<ArticleCardData[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>('ALL')
  const [rubriqueId, setRubriqueId] = useState<string>('ALL')
  const [rubriques, setRubriques] = useState<Rubrique[]>([])
  const [q, setQ] = useState(initialQ || '')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<ArticleCardData | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const dq = useDebounced(q, 300)
  const reqRef = useRef(0)

  useEffect(() => {
    adminApi.rubriques().then((r) => setRubriques(r.rubriques)).catch(() => {})
  }, [])

  const load = useCallback(async (p = 1) => {
    const reqId = ++reqRef.current
    setLoading(true)
    try {
      const res = await adminApi.articles({
        q: dq || undefined,
        status: status !== 'ALL' ? status : undefined,
        rubriqueId: rubriqueId !== 'ALL' ? rubriqueId : undefined,
        page: p,
        limit: 15,
      })
      if (reqId !== reqRef.current) return
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
      setPage(res.page)
    } catch (e) {
      if (reqId === reqRef.current) toast.error('Impossible de charger les articles', { description: e instanceof Error ? e.message : undefined })
    } finally {
      if (reqId === reqRef.current) setLoading(false)
    }
  }, [dq, status, rubriqueId])

  useEffect(() => { load(1) }, [load])

  // Échap pour fermer la confirmation
  const doDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteArticle(deleting.id)
      toast.success('Article supprimé', { description: deleting.title })
      setDeleting(null)
      load(page)
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const togglePublish = async (a: ArticleCardData) => {
    const next: ArticleStatus = a.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED'
    setBusyId(a.id)
    try {
      await adminApi.updateArticle(a.id, { status: next })
      toast.success(next === 'PUBLISHED' ? 'Article publié' : 'Article dépublié', { description: stripHtml(a.title) })
      load(page)
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  const duplicate = async (a: ArticleCardData) => {
    setBusyId(a.id)
    try {
      await adminApi.duplicateArticle(a.id)
      toast.success('Article dupliqué', { description: `Une copie de « ${a.title} » a été créée en brouillon.` })
      load(1)
    } catch (e) {
      toast.error('Duplication impossible', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusyId(null)
    }
  }

  const countFor = (key: string) => {
    if (key === 'ALL') return total
    return undefined
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-tg-navy font-display">Articles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} article{total > 1 ? 's' : ''} dans la base éditoriale</p>
        </div>
        <Button onClick={() => navigate('/admin/articles/new')} className="bg-tg-red hover:bg-tg-red-dark text-white shrink-0">
          <FilePlus2 size={16} /> Nouvel article
        </Button>
      </div>

      {/* Onglets statut */}
      <div className="flex gap-1 overflow-x-auto tg-scroll pb-1 -mt-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              'px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              status === t.key ? 'bg-tg-navy text-white shadow-sm' : 'text-zinc-600 hover:bg-tg-gray hover:text-tg-navy'
            )}
          >
            {t.label}
            {countFor(t.key) !== undefined && status === t.key && (
              <span className="ml-1.5 text-[11px] opacity-80">({total})</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un article par titre…"
            className="pl-9 h-10 bg-white"
            aria-label="Rechercher un article"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-tg-navy" aria-label="Effacer la recherche">
              <span className="text-lg leading-none">×</span>
            </button>
          )}
        </div>
        <Select value={rubriqueId} onValueChange={setRubriqueId}>
          <SelectTrigger className="w-full sm:w-56 h-10 bg-white" aria-label="Filtrer par rubrique">
            <SelectValue placeholder="Toutes les rubriques" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes les rubriques</SelectItem>
            {rubriques.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.parent ? `↳ ${r.name}` : r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-zinc-100 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center px-6">
            <FileText size={30} className="text-zinc-300" />
            <p className="font-semibold text-tg-navy">Aucun élément</p>
            <p className="text-sm text-muted-foreground">Aucun article ne correspond à ces critères. Modifiez les filtres ou créez un nouvel article.</p>
            <Button onClick={() => navigate('/admin/articles/new')} className="mt-1 bg-tg-red hover:bg-tg-red-dark text-white">
              <FilePlus2 size={15} /> Nouvel article
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto tg-scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_#e4e4e7]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[46%] min-w-[220px]">Article</TableHead>
                  <TableHead className="hidden md:table-cell">Rubrique</TableHead>
                  <TableHead className="hidden lg:table-cell">Auteur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Vues</TableHead>
                  <TableHead className="hidden xl:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id} className="group">
                    <TableCell>
                      <button onClick={() => navigate(`/admin/articles/edit?id=${a.id}`)} className="flex items-center gap-3 text-left w-full">
                        <div className="relative w-12 h-9 rounded-lg overflow-hidden shrink-0 bg-tg-gray">
                          <FadeImage src={a.coverImage} alt={a.coverAlt || a.title} fill sizes="60px" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-tg-navy group-hover:text-tg-red transition-colors line-clamp-1"><RichInline html={a.title} /></p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{a.subtitle || a.description || '—'}</p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.rubrique ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: a.rubrique.color }}>
                          {a.rubrique.name}
                        </span>
                      ) : <span className="text-xs text-zinc-400">—</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-zinc-600">{a.author?.name || '—'}</TableCell>
                    <TableCell>
                      {busyId === a.id ? <Loader2 size={14} className="animate-spin text-tg-red" /> : <StatusBadge status={a.status} />}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-sm tabular-nums text-zinc-600">{fmt.num(a.views)}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-zinc-500">{fmt.short(a.publishedAt || a.scheduledAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-tg-navy hover:text-tg-red" title="Éditer" onClick={() => navigate(`/admin/articles/edit?id=${a.id}`)}>
                          <Pencil size={15} />
                        </Button>
                        {(a.status === 'PUBLISHED' || a.status === 'UNPUBLISHED') && (
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8 hover:bg-tg-green/10"
                            title={a.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                            onClick={() => togglePublish(a)}
                          >
                            {a.status === 'PUBLISHED' ? <Undo2 size={15} className="text-orange-600" /> : <Send size={15} className="text-tg-green" />}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Plus d'actions">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => navigate(`/article/${a.slug}`)}>
                              <ExternalLink size={14} /> Voir sur le site
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicate(a)}>
                              <Copy size={14} /> Dupliquer
                            </DropdownMenuItem>
                            {a.status !== 'PUBLISHED' && a.status !== 'UNPUBLISHED' && (
                              <DropdownMenuItem onClick={() => togglePublish(a)}>
                                <Send size={14} /> Publier rapidement
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleting(a)} className="text-tg-red focus:text-tg-red focus:bg-tg-red/5">
                              <Trash2 size={14} /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
            <p className="text-xs text-muted-foreground">Page {page} sur {pages}</p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
                <ChevronLeft size={14} /> Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>
                Suivant <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.title} » sera définitivement supprimé, ainsi que ses statistiques de lecture. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <Trash2 size={15} /> Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
