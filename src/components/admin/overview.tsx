'use client'
// Vue d'ensemble du cockpit éditorial (§7.1)
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { adminApi, fmt } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { AdminOverview } from '@/lib/types'
import { StatusBadge } from '@/components/tg/shared'
import { CardsSkeleton, EmptyState, LinesSkeleton, PageHeader, StatCard } from './admin-shared'
import {
  BarChart3, Eye, FileText, FilePlus2, FolderEdit, History, Inbox,
  Megaphone, Newspaper, Pencil, Radio, TrendingUp, Trophy, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'bg-tg-green/15 text-tg-green-dark',
  UPDATE: 'bg-tg-yellow/25 text-yellow-800',
  DELETE: 'bg-tg-red/10 text-tg-red',
  PUBLISH: 'bg-tg-green/15 text-tg-green-dark',
  LOGIN: 'bg-zinc-200 text-zinc-700',
}

export function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    adminApi.overview()
      .then(setData)
      .catch((e) => toast.error('Impossible de charger le tableau de bord', { description: e instanceof Error ? e.message : undefined }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vue d'ensemble" description="Chargement des indicateurs de la rédaction…" />
        <CardsSkeleton />
        <div className="grid md:grid-cols-2 gap-6"><LinesSkeleton rows={6} /><LinesSkeleton rows={6} /></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Vue d'ensemble" />
        <EmptyState icon={BarChart3} title="Aucun indicateur disponible" description="Une erreur est survenue lors du chargement. Rechargez la page." />
      </div>
    )
  }

  const c = data.cards

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue d'ensemble"
        description="L'activité de Topguinee.info en un coup d'œil"
        actions={
          <>
            <Button onClick={() => navigate('/admin/articles/new')} className="bg-tg-red hover:bg-tg-red-dark text-white">
              <FilePlus2 size={16} /> Nouvel article
            </Button>
            <Button onClick={() => navigate('/admin/flash')} variant="outline" className="border-tg-navy/20 text-tg-navy hover:bg-tg-gray">
              <Zap size={16} /> Ajouter un flash
            </Button>
          </>
        }
      />

      {/* 8 cartes statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Newspaper} label="Articles publiés" value={fmt.num(c.published)} tone="red" hint={`${c.articles} au total`} />
        <StatCard icon={FileText} label="Brouillons" value={fmt.num(c.drafts)} tone="yellow" hint="En attente de finalisation" />
        <StatCard icon={Eye} label="Vues totales" value={fmt.num(c.views)} tone="navy" />
        <StatCard icon={TrendingUp} label="Vues 7 derniers jours" value={fmt.num(c.viewsWeek)} tone="green" />
        <StatCard icon={Inbox} label="Messages non lus" value={fmt.num(c.messagesUnread)} tone="red" hint="Dans la messagerie" />
        <StatCard icon={Radio} label="Épisodes audio" value={fmt.num(c.episodes)} tone="navy" />
        <StatCard icon={Megaphone} label="Campagnes actives" value={fmt.num(c.activeCampaigns)} tone="green" />
        <StatCard icon={BarChart3} label="Publicité" value={fmt.num(c.impressions)} tone="yellow" hint={`${fmt.num(c.clicks)} clics`} />
      </div>

      {/* Deux colonnes : derniers articles / derniers messages */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-tg-navy flex items-center gap-2"><FolderEdit size={17} className="text-tg-red" /> Derniers articles</h2>
            <Button variant="ghost" size="sm" className="text-tg-green hover:text-tg-green-dark" onClick={() => navigate('/admin/articles')}>
              Tout voir
            </Button>
          </header>
          {data.recentArticles.length === 0 ? (
            <EmptyState icon={FileText} title="Aucun article" description="Commencez par créer votre premier article." />
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto tg-scroll">
              {data.recentArticles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/admin/articles/edit?id=${a.id}`)}
                  className="w-full text-left px-5 py-3 hover:bg-tg-gray/70 transition-colors flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-tg-navy truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.rubrique?.name || 'Sans rubrique'} · {fmt.short(a.publishedAt || a.scheduledAt)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                  <Pencil size={14} className="text-zinc-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-tg-navy flex items-center gap-2"><Inbox size={17} className="text-tg-red" /> Derniers messages</h2>
            <Button variant="ghost" size="sm" className="text-tg-green hover:text-tg-green-dark" onClick={() => navigate('/admin/messages')}>
              Ouvrir la messagerie
            </Button>
          </header>
          {data.recentMessages.length === 0 ? (
            <EmptyState icon={Inbox} title="Aucun message reçu" description="Les messages du formulaire de contact apparaîtront ici." />
          ) : (
            <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto tg-scroll">
              {data.recentMessages.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-tg-gray/70 transition-colors">
                  {!m.isRead && <span className="w-2 h-2 rounded-full bg-tg-red shrink-0" aria-label="Non lu" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${m.isRead ? 'text-zinc-600' : 'font-semibold text-tg-navy'}`}>
                      {m.subject || '(Sans objet)'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.name} · {fmt.dateTime(m.receivedAt)}</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 px-2.5 text-xs border-tg-green/40 text-tg-green hover:bg-tg-green hover:text-white"
                    onClick={() => navigate('/admin/messages')}
                  >
                    Voir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Journal + top articles */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-tg-navy flex items-center gap-2"><History size={17} className="text-tg-red" /> Activité récente</h2>
            <Button variant="ghost" size="sm" className="text-tg-green hover:text-tg-green-dark" onClick={() => navigate('/admin/journal')}>
              Journal complet
            </Button>
          </header>
          {data.recentLogs.length === 0 ? (
            <EmptyState icon={History} title="Aucune activité enregistrée" />
          ) : (
            <ul className="divide-y divide-zinc-100 max-h-[340px] overflow-y-auto tg-scroll">
              {data.recentLogs.slice(0, 8).map((l) => (
                <li key={l.id} className="px-5 py-2.5 flex items-start gap-3">
                  <span className={`mt-1 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${ACTION_BADGE[l.action] || 'bg-zinc-100 text-zinc-600'}`}>
                    {l.action}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-tg-navy leading-snug">{l.detail}</p>
                    <p className="text-[11px] text-muted-foreground">{l.userLabel} · {fmt.dateTime(l.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card rounded-2xl border border-zinc-200 overflow-hidden">
          <header className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-bold text-tg-navy flex items-center gap-2"><Trophy size={17} className="text-tg-yellow" /> Top 5 des articles</h2>
          </header>
          {data.topArticles.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Pas encore de statistiques de lecture" />
          ) : (
            <ol className="divide-y divide-zinc-100 max-h-[340px] overflow-y-auto tg-scroll">
              {data.topArticles.slice(0, 5).map((a, i) => (
                <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-tg-yellow text-tg-navy' : 'bg-tg-gray text-tg-navy'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => navigate(`/article/${a.slug}`)} className="text-[13px] font-medium text-tg-navy hover:text-tg-red transition-colors line-clamp-1 text-left w-full">
                      {a.title}
                    </button>
                    <p className="text-[11px] text-muted-foreground">{a.rubrique?.name || '—'}</p>
                  </div>
                  <span className="text-xs font-bold text-tg-green tabular-nums shrink-0">{fmt.num(a.views)} vues</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
