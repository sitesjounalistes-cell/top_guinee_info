'use client'
// Journal d'activité (§7.11)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import type { ActivityLogEntry } from '@/lib/types'
import { EmptyState, LinesSkeleton, PageHeader, useDebounced } from './admin-shared'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-tg-green/15 text-tg-green-dark border-tg-green/40',
  PUBLISH: 'bg-tg-green/15 text-tg-green-dark border-tg-green/40',
  UPDATE: 'bg-tg-yellow/25 text-yellow-800 border-tg-yellow/50',
  DELETE: 'bg-tg-red/10 text-tg-red border-tg-red/40',
  LOGIN: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  LOGOUT: 'bg-zinc-200 text-zinc-700 border-zinc-300',
}

const ACTION_FILTERS = [
  { value: 'ALL', label: 'Toutes les actions' },
  { value: 'CREATE', label: 'Créations' },
  { value: 'UPDATE', label: 'Modifications' },
  { value: 'PUBLISH', label: 'Publications' },
  { value: 'DELETE', label: 'Suppressions' },
  { value: 'LOGIN', label: 'Connexions' },
]

export function LogsView() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('ALL')
  const [q, setQ] = useState('')
  const mountedRef = useRef(false)
  const dq = useDebounced(q, 300)

  const load = useCallback(async (t: string) => {
    setLoading(true)
    try {
      const res = await adminApi.logs(t === 'ALL' ? {} : { type: t })
      setLogs(res.logs)
    } catch (e) {
      toast.error('Impossible de charger le journal', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load(type)
  }, [])

  const changeType = (t: string) => {
    setType(t)
    void load(t)
  }

  const filtered = logs.filter((l) => {
    if (!dq) return true
    const s = `${l.userLabel} ${l.action} ${l.entity} ${l.detail}`.toLowerCase()
    return s.includes(dq.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal d'activité"
        description="Traçabilité complète des actions effectuées dans le cockpit éditorial."
        actions={
          <Button variant="outline" onClick={() => changeType(type)} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
            <RefreshCw size={15} /> Actualiser
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (auteur, entité, détail…)" className="pl-9 h-10 bg-white" aria-label="Rechercher dans le journal" />
        </div>
        <Select value={type} onValueChange={changeType}>
          <SelectTrigger className="w-full sm:w-56 h-10 bg-white" aria-label="Filtrer par type d'action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 rounded-lg bg-zinc-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={History} title="Aucune entrée" description="Aucune activité ne correspond à ces filtres." />
        ) : (
          <div className="max-h-[70vh] overflow-y-auto tg-scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_0_#e4e4e7]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[160px]">Horodatage</TableHead>
                  <TableHead>Auteur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Entité</TableHead>
                  <TableHead className="min-w-[220px]">Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-zinc-500 whitespace-nowrap">{fmt.dateTime(l.createdAt)}</TableCell>
                    <TableCell className="text-sm font-medium text-tg-navy whitespace-nowrap">{l.userLabel}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border', ACTION_STYLES[l.action] || 'bg-zinc-100 text-zinc-600 border-zinc-200')}>
                        {l.action}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-zinc-600 uppercase tracking-wide">{l.entity}</TableCell>
                    <TableCell className="text-[13px] text-zinc-700">{l.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
