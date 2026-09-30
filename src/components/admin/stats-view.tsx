'use client'
// Statistiques de la rédaction — graphiques et exports (§7.7)
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { AdminStats } from '@/lib/types'
import { EmptyState, LinesSkeleton, PageHeader, StatCard, downloadCsv } from './admin-shared'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from 'recharts'
import {
  ArrowDownUp, Clock, Download, Eye, FileDown, FileText, Headphones,
  Newspaper, Printer, TrendingUp,
} from 'lucide-react'

const PERIODS: { value: string; label: string }[] = [
  { value: 'day', label: 'Aujourd\'hui' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'all', label: 'Depuis le début' },
]

const MEDIA_COLORS = ['#D21034', '#FCD116', '#009460']

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #tg-stats-print, #tg-stats-print * { visibility: visible !important; }
  #tg-stats-print { position: absolute !important; left: 0; top: 0; width: 100%; padding: 12px; }
  #tg-stats-print .no-print { display: none !important; }
}
`

export function StatsView() {
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(false)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await adminApi.stats(p)
      setData(res)
    } catch (e) {
      toast.error('Impossible de charger les statistiques', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load(period)
  }, [])

  const changePeriod = (p: string) => {
    setPeriod(p)
    void load(p)
  }

  const exportCsv = () => {
    if (!data) return
    const rows: (string | number)[][] = []
    rows.push(['Période', PERIODS.find((p) => p.value === period)?.label || period])
    rows.push([])
    rows.push(['Date', 'Vues'])
    for (const t of data.timeline) rows.push([t.day, t.views])
    rows.push([])
    rows.push(['Rubrique', 'Articles', 'Vues'])
    for (const r of data.byRubrique) rows.push([r.name, r.count, r.views])
    rows.push([])
    rows.push(['Rang', 'Titre', 'Rubrique', 'Vues'])
    data.topArticles.forEach((a, i) => rows.push([i + 1, a.title, a.rubrique?.name || '', a.views]))
    const d = new Date()
    const name = `topguinee-stats-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`
    downloadCsv(name, rows)
    toast.success('Export CSV téléchargé', { description: name })
  }

  const exportPdf = () => {
    toast.info('Impression…', { description: 'Choisissez « Enregistrer au format PDF » dans la boîte d\'impression.' })
    setTimeout(() => window.print(), 350)
  }

  const timelineData = (data?.timeline || []).slice(-30).map((t) => ({
    day: new Date(t.day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    vues: t.views,
  }))

  const rubriqueData = (data?.byRubrique || []).map((r) => ({ name: r.name, vues: r.views, color: r.color || '#14213D' }))
  const authorData = (data?.byAuthor || []).map((a) => ({ name: a.name, vues: a.views }))

  return (
    <div className="space-y-5">
      <style>{PRINT_CSS}</style>
      <PageHeader
        title="Statistiques"
        description="Audience, contenus et écoutes — aperçu analytique de la rédaction."
        actions={
          <>
            <Select value={period} onValueChange={changePeriod}>
              <SelectTrigger className="w-44 bg-white" aria-label="Période des statistiques">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} className="border-tg-green/50 text-tg-green hover:bg-tg-green/10">
              <FileDown size={15} /> Export CSV
            </Button>
            <Button variant="outline" onClick={exportPdf} className="border-zinc-300 text-tg-navy hover:bg-tg-gray">
              <Printer size={15} /> Export PDF
            </Button>
          </>
        }
      />

      {loading && !data ? (
        <LinesSkeleton rows={10} />
      ) : !data ? (
        <EmptyState icon={TrendingUp} title="Aucune statistique disponible" description="Revenez plus tard : les données s'accumulent avec les visites." />
      ) : (
        <div id="tg-stats-print" className="space-y-5">
          <div className="no-print hidden print:block">
            <h1 className="text-xl font-bold text-tg-navy">Topguinee.info — Rapport statistique</h1>
            <p className="text-sm text-zinc-500">Généré le {fmt.dateTime(new Date())}</p>
          </div>

          {/* 5 cartes */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard icon={Eye} label="Vues" value={fmt.num(data.cards.views)} tone="red" />
            <StatCard icon={Newspaper} label="Articles" value={fmt.num(data.cards.articles)} tone="navy" />
            <StatCard icon={Clock} label="Temps de lecture moyen" value={`${Math.round(data.cards.avgReadTime || 0)} min`} tone="yellow" />
            <StatCard icon={Headphones} label="Épisodes" value={fmt.num(data.cards.episodes)} tone="green" />
            <StatCard icon={TrendingUp} label="Écoutes" value={fmt.num(data.cards.listens)} tone="green" />
          </div>

          {/* Timeline vues */}
          <section className="bg-card rounded-2xl border border-zinc-200 p-4">
            <h2 className="font-bold text-tg-navy mb-4 flex items-center gap-2"><Eye size={16} className="text-tg-red" /> Évolution des vues (30 derniers jours)</h2>
            {timelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée de visite sur la période.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tgViewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D21034" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#D21034" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={{ stroke: '#e4e4e7' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={false} />
                    <ReTooltip
                      formatter={(value) => [`${value} vues`, 'Vues']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="vues" stroke="#D21034" strokeWidth={2.5} fill="url(#tgViewsGradient)" activeDot={{ r: 4, fill: '#D21034' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Par rubrique */}
            <section className="bg-card rounded-2xl border border-zinc-200 p-4">
              <h2 className="font-bold text-tg-navy mb-4 flex items-center gap-2"><Newspaper size={16} className="text-tg-red" /> Vues par rubrique</h2>
              {rubriqueData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée par rubrique.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rubriqueData} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={{ stroke: '#e4e4e7' }} interval={0} angle={-18} textAnchor="end" height={58} />
                      <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={false} />
                      <ReTooltip formatter={(v) => [`${v} vues`, 'Vues']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                      <Bar dataKey="vues" radius={[6, 6, 0, 0]}>
                        {rubriqueData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Mix média + auteurs */}
            <section className="bg-card rounded-2xl border border-zinc-200 p-4">
              <h2 className="font-bold text-tg-navy mb-4 flex items-center gap-2"><ArrowDownUp size={16} className="text-tg-red" /> Mix des contenus & auteurs</h2>
              <div className="grid sm:grid-cols-[170px_1fr] gap-4 items-center">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(data.mediaMix || []).map((m) => ({ name: m.name, value: m.value }))}
                        dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={32} outerRadius={62} paddingAngle={3}
                        stroke="#fff"
                      >
                        {(data.mediaMix || []).map((_, i) => <Cell key={i} fill={MEDIA_COLORS[i % MEDIA_COLORS.length]} />)}
                      </Pie>
                      <ReTooltip formatter={(value, name) => [`${value}`, String(name)]} contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={authorData} layout="vertical" margin={{ top: 0, right: 12, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#3f3f46' }} width={110} tickLine={false} axisLine={false} />
                      <ReTooltip formatter={(v) => [`${v} vues`, 'Vues']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e4e7', fontSize: 12 }} />
                      <Bar dataKey="vues" fill="#14213D" radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 justify-center">
                {(data.mediaMix || []).map((m, i) => (
                  <span key={m.name} className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MEDIA_COLORS[i % MEDIA_COLORS.length] }} />
                    {m.name} ({fmt.num(m.value)})
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Top / Flop articles */}
          <div className="grid lg:grid-cols-2 gap-5">
            {([
              { title: 'Top 5 des articles', icon: TrendingUp, list: data.topArticles, tone: 'text-tg-green' },
              { title: '5 articles les moins lus', icon: ArrowDownUp, list: data.bottomArticles, tone: 'text-zinc-500' },
            ] as const).map((block) => (
              <section key={block.title} className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
                <header className="px-5 py-3.5 border-b border-zinc-100">
                  <h2 className="font-bold text-tg-navy flex items-center gap-2"><block.icon size={16} className={block.tone} /> {block.title}</h2>
                </header>
                {block.list.length === 0 ? (
                  <EmptyState icon={FileText} title="Aucune donnée" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Article</TableHead>
                        <TableHead className="hidden sm:table-cell">Rubrique</TableHead>
                        <TableHead className="text-right">Vues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {block.list.slice(0, 5).map((a, i) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs font-bold text-zinc-400">{i + 1}</TableCell>
                          <TableCell>
                            <button onClick={() => navigate(`/admin/articles/edit?id=${a.id}`)} className="text-[13px] font-medium text-tg-navy hover:text-tg-red transition-colors line-clamp-1 text-left">
                              {a.title}
                            </button>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-zinc-500">{a.rubrique?.name || '—'}</TableCell>
                          <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt.num(a.views)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 no-print">
            <Download size={12} /> Astuce : l&apos;export PDF utilise la fonction d&apos;impression du navigateur — choisissez « Enregistrer au format PDF ».
          </p>
        </div>
      )}
    </div>
  )
}
