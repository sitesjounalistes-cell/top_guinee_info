'use client'
// Messagerie de contact (§7.8)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import type { ContactMessage } from '@/lib/types'
import { EmptyState, LinesSkeleton, PageHeader, useDebounced } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Archive, ArchiveRestore, Check, ChevronLeft, Inbox, Mail, MailOpen,
  Reply, Search, Trash2, X,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

type TabKey = 'inbox' | 'unread' | 'read' | 'archived'

const TAB_LABELS: Record<TabKey, string> = {
  inbox: 'Reçus', unread: 'Non lus', read: 'Lus', archived: 'Archivés',
}

export function MessagesInbox({ refreshBadges }: { refreshBadges?: () => void }) {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('inbox')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [deleting, setDeleting] = useState<ContactMessage | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mountedRef = useRef(false)
  const dq = useDebounced(q, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.messages()
      setMessages(res.messages.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()))
    } catch (e) {
      toast.error('Impossible de charger la messagerie', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  const filtered = messages.filter((m) => {
    if (tab === 'archived' && !m.isArchived) return false
    if (tab !== 'archived' && m.isArchived) return false
    if (tab === 'unread' && m.isRead) return false
    if (tab === 'read' && !m.isRead) return false
    if (dq) {
      const s = `${m.name} ${m.email} ${m.subject} ${m.message}`.toLowerCase()
      if (!s.includes(dq.toLowerCase())) return false
    }
    return true
  })

  const unreadCount = messages.filter((m) => !m.isRead && !m.isArchived).length

  const select = async (m: ContactMessage) => {
    setSelected(m)
    setMobileOpen(true)
    if (!m.isRead) {
      try {
        await adminApi.updateMessage(m.id, { isRead: true })
        setMessages((arr) => arr.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)))
        setSelected((s) => (s && s.id === m.id ? { ...s, isRead: true } : s))
        refreshBadges?.()
      } catch { /* silencieux */ }
    }
  }

  const toggleRead = async (m: ContactMessage) => {
    try {
      await adminApi.updateMessage(m.id, { isRead: !m.isRead })
      setMessages((arr) => arr.map((x) => (x.id === m.id ? { ...x, isRead: !m.isRead } : x)))
      setSelected((s) => (s && s.id === m.id ? { ...s, isRead: !m.isRead } : s))
      refreshBadges?.()
      toast.success(m.isRead ? 'Marqué comme non lu' : 'Marqué comme lu')
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const toggleArchive = async (m: ContactMessage) => {
    try {
      await adminApi.updateMessage(m.id, { isArchived: !m.isArchived })
      setMessages((arr) => arr.map((x) => (x.id === m.id ? { ...x, isArchived: !m.isArchived } : x)))
      setSelected(null)
      refreshBadges?.()
      toast.success(m.isArchived ? 'Message désarchivé' : 'Message archivé', { description: m.subject || undefined })
    } catch (e) {
      toast.error('Action impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteMessage(deleting.id)
      toast.success('Message supprimé')
      setDeleting(null)
      setSelected(null)
      refreshBadges?.()
      await load()
    } catch (e) {
      toast.error('Suppression impossible', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const reply = (m: ContactMessage) => {
    const subject = encodeURIComponent(`Re: ${m.subject || 'Votre message'}`)
    const body = encodeURIComponent(`\n\n---\nMessage original de ${m.name} (${fmt.dateTime(m.receivedAt)}) :\n${m.message}`)
    window.location.href = `mailto:${m.email}?subject=${subject}&body=${body}`
  }

  const listNode = (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabKey); setSelected(null) }}>
        <TabsList className="bg-tg-gray h-auto p-1 w-full flex-wrap">
          {(['inbox', 'unread', 'read', 'archived'] as TabKey[]).map((k) => (
            <TabsTrigger key={k} value={k} className="data-[state=active]:bg-white data-[state=active]:text-tg-navy text-xs gap-1">
              {TAB_LABELS[k]}
              {k === 'unread' && unreadCount > 0 && (
                <span className="bg-tg-red text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center">{unreadCount}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher expéditeur, objet…" className="pl-9 h-10 bg-white" aria-label="Rechercher dans les messages" />
      </div>
      <div className="space-y-1.5 max-h-[62vh] overflow-y-auto tg-scroll pr-1">
        {loading ? <LinesSkeleton rows={6} /> : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="Aucun message" description={tab === 'archived' ? 'Aucun message archivé.' : 'Les messages du formulaire de contact arrivent ici.'} />
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m)}
              className={cn(
                'w-full text-left rounded-xl border p-3 transition-colors',
                selected?.id === m.id ? 'border-tg-red/50 bg-tg-red/5' : 'border-zinc-200 hover:bg-tg-gray/60',
                !m.isRead && 'bg-tg-yellow/5'
              )}
            >
              <div className="flex items-center gap-2">
                {!m.isRead && <span className="w-2 h-2 rounded-full bg-tg-red shrink-0" aria-label="Non lu" />}
                <p className={cn('text-sm truncate flex-1', m.isRead ? 'text-zinc-600' : 'font-bold text-tg-navy')}>{m.name}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">{fmt.short(m.receivedAt)}</span>
              </div>
              <p className={cn('text-[13px] truncate mt-0.5', m.isRead ? 'text-zinc-500' : 'font-semibold text-tg-navy')}>{m.subject || '(Sans objet)'}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{m.message}</p>
              {m.isArchived && <Badge className="mt-1.5 bg-zinc-200 text-zinc-600 border border-zinc-300 text-[10px]">Archivé</Badge>}
            </button>
          ))
        )}
      </div>
    </div>
  )

  const readPanel = selected ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="md:hidden text-tg-navy" onClick={() => setMobileOpen(false)}>
          <ChevronLeft size={16} /> Retour à la liste
        </Button>
        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" variant="outline" className="h-8 border-zinc-300 text-tg-navy hover:bg-tg-gray" onClick={() => toggleRead(selected)}>
            {selected.isRead ? <><Mail size={13} /> Non lu</> : <><MailOpen size={13} /> Lu</>}
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-zinc-300 text-tg-navy hover:bg-tg-gray" onClick={() => toggleArchive(selected)}>
            {selected.isArchived ? <><ArchiveRestore size={13} /> Désarchiver</> : <><Archive size={13} /> Archiver</>}
          </Button>
          <Button size="sm" variant="outline" className="h-8 border-tg-red/30 text-tg-red hover:bg-tg-red/10" onClick={() => setDeleting(selected)}>
            <Trash2 size={13} />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hidden md:inline-flex text-zinc-400" onClick={() => setSelected(null)} aria-label="Fermer la lecture">
            <X size={15} />
          </Button>
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-zinc-200 p-5">
        <h2 className="text-lg font-bold text-tg-navy font-display leading-snug">{selected.subject || '(Sans objet)'}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-semibold text-tg-navy"><Mail size={12} /> {selected.name}</span>
          <a href={`mailto:${selected.email}`} className="text-tg-green hover:underline">{selected.email}</a>
          <Separator orientation="vertical" className="h-3 hidden sm:block" />
          <span>{fmt.dateTime(selected.receivedAt)}</span>
        </div>
        <Separator className="my-4" />
        <div className="text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">{selected.message}</div>
        <Separator className="my-4" />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => reply(selected)} className="bg-tg-green hover:bg-tg-green-dark text-white">
            <Reply size={15} /> Répondre à {selected.name.split(' ')[0]}
          </Button>
          {!selected.isRead && (
            <Button variant="outline" onClick={() => toggleRead(selected)} className="border-tg-green/40 text-tg-green hover:bg-tg-green/10">
              <Check size={15} /> Marquer comme traité
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Le bouton « Répondre » ouvre votre logiciel de messagerie avec l&apos;adresse de l&apos;expéditeur.</p>
      </div>
    </div>
  ) : (
    <div className="hidden md:flex h-full min-h-[300px] items-center justify-center">
      <EmptyState icon={MailOpen} title="Sélectionnez un message" description="Cliquez sur un message dans la liste pour le lire ici." />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Messagerie"
        description="Messages reçus via le formulaire de contact du site."
      />

      {/* Vue mobile : liste puis panneau */}
      <div className="md:hidden">
        {mobileOpen && selected ? readPanel : listNode}
      </div>

      {/* Vue desktop : split */}
      <div className="hidden md:grid md:grid-cols-[minmax(300px,380px)_1fr] gap-5 items-start">
        <div className="bg-card rounded-2xl border border-zinc-200 p-4">{listNode}</div>
        <div className="min-h-[400px]">{readPanel}</div>
      </div>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Message de {deleting?.name} — « {deleting?.subject || 'sans objet'} ». Cette action est irréversible.
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
