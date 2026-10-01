'use client'
// Composants partagés Topguinee.info (front-office + back-office)
// Design « premium éditorial » : serif de presse, filets fins, coins nets,
// interactions mesurées (zoom lent, soulignement animé).
import { useCallback, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import { fmt, STATUS_LABELS, STATUS_COLORS } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Link } from '@/lib/router'
import { sanitizeRichText, safeHttpUrl, sanitizeInline, stripHtml } from '@/lib/sanitize'
import type { ArticleCardData, AdBannerData, Rubrique } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Facebook, Twitter, Instagram, Youtube, Music2, AtSign, Send, Globe, Share2,
  Play, Pause, Volume2, VolumeX, Gauge, Clock, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ─── Image en fondu progressif (§10.4) ────────────────────────────

export function FadeImage({ src, alt, className, sizes, fill, width, height, priority }: {
  src?: string | null; alt: string; className?: string; sizes?: string
  fill?: boolean; width?: number; height?: number; priority?: boolean
}) {
  const [loaded, setLoaded] = useState(false)

  // Images déjà en cache : onLoad peut partir avant l'attache du handler →
  // on vérifie `complete` dans le callback du ref (appellé à l'attache DOM).
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true)
  }, [])

  if (!src) {
    return (
      <div className={cn('bg-gradient-to-br from-tg-navy via-tg-navy-light to-tg-navy-dark flex items-center justify-center', className)}>
        <div className="tg-flag-stripe" aria-hidden><i /></div>
      </div>
    )
  }
  return (
    <Image
      ref={imgRef}
      src={src} alt={alt || 'Image Topguinee.info'} className={cn('tg-img-fade object-cover', loaded && 'tg-loaded', className)}
      sizes={sizes} fill={fill} width={width} height={height} priority={priority}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      unoptimized
    />
  )
}

// ─── Kicker de rubrique (sur-titre de presse) ─────────────────────

function RubriqueKicker({ article, light }: { article: ArticleCardData; light?: boolean }) {
  const rub = article.rubrique
  const color = rub?.color || '#D21034'
  return (
    <span
      className={cn('tg-kicker inline-flex items-center gap-1.5', light && 'text-white/85')}
      style={light ? undefined : { color }}
    >
      <span className="w-1.5 h-1.5 rounded-[1px] shrink-0" style={{ backgroundColor: light ? '#FCD116' : color }} aria-hidden />
      {rub?.name || 'Actualité'}
    </span>
  )
}

function MetaLine({ article, light, full }: { article: ArticleCardData; light?: boolean; full?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 text-[11px] font-medium tracking-wide whitespace-nowrap', light ? 'text-zinc-300' : 'text-zinc-400')}>
      <span>{fmt.date(article.publishedAt)}</span>
      <span aria-hidden className={light ? 'text-white/30' : 'text-zinc-300'}>·</span>
      {full && (
        <>
          <span className="flex items-center gap-1"><Clock size={11} aria-hidden /> {article.readTime} min</span>
          <span aria-hidden className={light ? 'text-white/30' : 'text-zinc-300'}>·</span>
        </>
      )}
      <span className="flex items-center gap-1"><Eye size={11} aria-hidden /> {fmt.num(article.views)}</span>
    </div>
  )
}


// ─── Champ court enrichi (titre / sous-titre / description) ───────

/** Rend un texte pouvant contenir gras/italique/police (liste blanche). */
export function RichInline({ html, className }: { html?: string | null; className?: string }) {
  const clean = sanitizeInline(html || '')
  if (!clean) return null
  return <span className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

// ─── Cartes d'article (§10.3 — variantes éditoriales) ─────────────

// ─── Carrousel À la Une (§4.7 — défilement des articles de Une) ───

/** Défilement automatique gauche → droite des articles à la Une. */
export function FeaturedCarousel({ articles, intervalMs = 6000 }: {
  articles: ArticleCardData[]
  intervalMs?: number
}) {
  const { t } = useI18n()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 28 })
  const [selected, setSelected] = useState(0)
  const [paused, setPaused] = useState(false)

  // Synchronise l'indicateur actif avec le slide visible
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  // Défilement automatique — en pause au survol/focus et s'il n'y a qu'un slide
  useEffect(() => {
    if (!emblaApi || paused || articles.length < 2) return
    const t = setInterval(() => emblaApi.scrollNext(), intervalMs)
    return () => clearInterval(t)
  }, [emblaApi, paused, articles.length, intervalMs])

  if (!articles.length) return null

  return (
    <div
      className="relative group/car"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carrousel"
      aria-label={t.carouselLabel}
    >
      <div ref={emblaRef} className="overflow-hidden rounded-sm">
        <div className="flex">
          {articles.map((a) => (
            <div key={a.id} className="min-w-0 flex-[0_0_100%]" role="group" aria-roledescription="slide" aria-label={stripHtml(a.title) || 'Article à la une'}>
              <ArticleCard article={a} variant="hero" />
            </div>
          ))}
        </div>
      </div>

      {/* Flèches — visibles au survol, toujours sur mobile */}
      {articles.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-tg-navy shadow-lg flex items-center justify-center transition-all opacity-80 md:opacity-0 md:group-hover/car:opacity-100 focus-visible:opacity-100"
            aria-label={t.carouselPrev}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-tg-navy shadow-lg flex items-center justify-center transition-all opacity-80 md:opacity-0 md:group-hover/car:opacity-100 focus-visible:opacity-100"
            aria-label={t.carouselNext}
          >
            <ChevronRight size={20} />
          </button>

          {/* Points de navigation */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5" role="tablist" aria-label="Choisir un article à la une">
            {articles.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={selected === i}
                aria-label={stripHtml(a.title) || `Article ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  selected === i ? 'w-7 bg-tg-yellow' : 'w-3 bg-white/60 hover:bg-white',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ArticleCard({ article, variant = 'medium' }: { article: ArticleCardData; variant?: 'hero' | 'large' | 'medium' | 'small' | 'horizontal' }) {
  const rubColor = article.rubrique?.color || '#D21034'

  if (variant === 'hero') {
    return (
      <Link to={`/article/${article.slug}`} className="group relative block overflow-hidden rounded-sm bg-tg-navy min-h-[380px] md:min-h-[500px]" aria-label={article.title}>
        <FadeImage src={article.coverImage} alt={article.coverAlt || article.title} fill sizes="(max-width:1024px) 100vw, 62vw" priority className="tg-zoom absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-tg-navy-dark via-tg-navy-dark/45 to-tg-navy-dark/5" aria-hidden />
        <div className="absolute top-5 left-5 flex flex-wrap gap-2">
          <span className="tg-kicker text-[10.5px] text-white bg-black/35 backdrop-blur-sm border border-white/20 px-2.5 py-1.5 rounded-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-[1px]" style={{ backgroundColor: rubColor }} aria-hidden />
            {article.rubrique?.name || 'Actualité'}
          </span>
          {article.featuredOrder === 1 && (
            <span className="bg-tg-yellow text-tg-navy text-[10.5px] font-bold uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-sm flex items-center">
              À la une
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8 space-y-3.5">
          <h2 className="font-display font-bold text-white text-[24px] md:text-[34px] lg:text-[40px] leading-[1.1] tracking-tight drop-shadow-sm">
            <span className="tg-title-link"><RichInline html={article.title} /></span>
          </h2>
          <p className="text-zinc-200/95 text-sm md:text-[15px] leading-relaxed line-clamp-2 max-w-2xl font-medium">
            <RichInline html={article.subtitle || article.description} />
          </p>
          <MetaLine article={article} light full />
        </div>
      </Link>
    )
  }

  if (variant === 'horizontal') {
    return (
      <Link to={`/article/${article.slug}`} className="group flex gap-4 items-start" aria-label={article.title}>
        <div className="relative w-[104px] md:w-[140px] aspect-[3/2] rounded-sm overflow-hidden shrink-0 bg-tg-gray">
          <FadeImage src={article.coverImage} alt={article.coverAlt || article.title} fill sizes="150px" className="tg-zoom" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <RubriqueKicker article={article} />
          <h3 className="font-display font-semibold text-[15px] md:text-[17px] leading-snug text-tg-navy">
            <span className="tg-title-link"><RichInline html={article.title} /></span>
          </h3>
          <MetaLine article={article} />
        </div>
      </Link>
    )
  }

  if (variant === 'small') {
    return (
      <Link to={`/article/${article.slug}`} className="group flex items-center gap-3 py-1.5" aria-label={article.title}>
        <div className="relative w-16 h-16 rounded-sm overflow-hidden shrink-0 bg-tg-gray">
          <FadeImage src={article.coverImage} alt={article.coverAlt || article.title} fill sizes="70px" className="tg-zoom" />
        </div>
        <h3 className="font-medium text-[13.5px] leading-snug text-tg-navy group-hover:text-tg-red transition-colors line-clamp-3">
          <RichInline html={article.title} />
        </h3>
      </Link>
    )
  }

  // large | medium — cartes « pleine page » sans boîte : image + filet + serif
  const isLarge = variant === 'large'
  return (
    <Link to={`/article/${article.slug}`} className="group flex flex-col h-full" aria-label={article.title}>
      <div className={cn('relative w-full overflow-hidden rounded-sm bg-tg-gray', isLarge ? 'aspect-[16/9]' : 'aspect-[3/2]')}>
        <FadeImage
          src={article.coverImage} alt={article.coverAlt || article.title} fill
          sizes={isLarge ? '(max-width:768px) 100vw, 50vw' : '(max-width:768px) 100vw, 25vw'}
          className="tg-zoom"
        />
        {article.youtubeUrl && (
          <div className="absolute bottom-3 right-3 w-9 h-9 bg-tg-red text-white rounded-full flex items-center justify-center shadow-lg">
            <Play size={14} fill="currentColor" aria-hidden />
          </div>
        )}
      </div>
      <div className={cn('flex flex-col gap-2 flex-1', isLarge ? 'pt-5' : 'pt-4')}>
        <RubriqueKicker article={article} />
        <h3 className={cn(
          'font-display font-bold text-tg-navy tracking-tight',
          isLarge ? 'text-xl md:text-[22px]' : 'text-[17px]',
          'leading-snug line-clamp-2',
        )}>
          <span className="tg-title-link"><RichInline html={article.title} /></span>
        </h3>
        <p className={cn('text-zinc-500 leading-relaxed line-clamp-2', isLarge ? 'text-[14px]' : 'text-[13px]')}>
          <RichInline html={article.description} />
        </p>
        <div className="mt-auto pt-2">
          <span className="text-[11px] font-medium tracking-wide text-zinc-400">{fmt.date(article.publishedAt)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Titre de section (§10.3 — filet de presse) ───────────────────

export function SectionHeader({ title, rubrique, action }: { title: string; rubrique?: Rubrique | null; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-tg-navy pb-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-2.5 h-2.5 shrink-0 rotate-45" style={{ backgroundColor: rubrique?.color || '#D21034' }} aria-hidden />
        <h2 className="font-display text-[22px] md:text-[26px] font-bold tracking-tight text-tg-navy leading-none">{title}</h2>
      </div>
      {action}
    </div>
  )
}

// ─── Bandeau Flash Info (§4.8) ────────────────────────────────────

export function FlashTicker({ items }: { items: { id: string; text: string; articleId?: string | null; priority: number; article?: { slug: string; title: string } | null }[] }) {
  if (!items.length) return null
  const doubled = [...items, ...items]
  // Vitesse adaptative : le contenu défile en ~28 s par tranche de 100
  // caractères (borné 20–75 s) — un texte court reste lisible, un texte
  // long garde le temps d'être lu. Pause au survol gérée en CSS.
  const chars = items.reduce((n, f) => n + (f.text?.length || 0), 0)
  const duration = Math.min(75, Math.max(20, Math.round((chars / 100) * 28)))
  return (
    <div className="bg-tg-red text-white overflow-hidden relative z-40" role="region" aria-label="Flash info">
      <div className="flex items-stretch">
        <div className="flex items-center gap-2.5 px-3.5 md:px-5 bg-tg-navy shrink-0 relative z-10">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-yellow opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tg-yellow"></span>
          </span>
          <span className="font-bold text-[11px] md:text-[12px] tracking-[0.18em] uppercase whitespace-nowrap">Flash Info</span>
        </div>
        <div className="overflow-hidden flex-1 py-2.5">
          <div className="tg-marquee-track" style={{ animationDuration: `${duration}s` }}>
            {doubled.map((f, i) => (
              <span key={`${f.id}-${i}`} className="inline-flex items-center gap-2.5 text-[13px] font-medium">
                {f.priority >= 3 && <span className="bg-tg-yellow text-tg-navy font-bold px-1.5 py-0.5 rounded-sm text-[9.5px] uppercase tracking-wider">Urgent</span>}
                {f.article ? (
                  <Link to={`/article/${f.article.slug}`} className="hover:text-tg-yellow transition-colors hover:underline underline-offset-2">{f.text}</Link>
                ) : (
                  <span>{f.text}</span>
                )}
                <span className="text-tg-yellow/60 text-[8px] ml-7" aria-hidden>◆</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bannière publicitaire (§8) ───────────────────────────────────

export function AdBanner({ banner, position, className }: { banner?: AdBannerData | null; position: string; className?: string }) {
  if (!banner || !banner.imageUrl) return null
  // Cible revalidée au rendu : seules les URLs http(s) sont cliquables
  // (un « javascript: » injecté en base ne s'exécuterait jamais ici)
  const href = safeHttpUrl(banner.linkUrl)
  const click = () => {
    fetch(`/api/public/ads/${banner.id}/click`, { method: 'POST' }).catch(() => {})
  }
  const formatClass = position === 'sidebar'
    ? 'aspect-[4/3]'
    : position === 'header' || position === 'footer' || position === 'intercalaire'
      ? 'h-[70px] md:h-[90px]'
      : 'aspect-[6/1]'
  return (
    <a
      href={href || '#'} target="_blank" rel="noopener noreferrer sponsored"
      onClick={(e) => { if (!href) e.preventDefault(); else click() }}
      className={cn('block group relative overflow-hidden rounded-sm border border-zinc-200 bg-tg-gray', className)}
      aria-label={`Publicité : ${banner.title}`}
    >
      <div className={cn('relative w-full overflow-hidden', formatClass)}>
        <FadeImage src={banner.imageUrl} alt={banner.title} fill sizes="(max-width:768px) 100vw, 728px" className="tg-zoom" />
      </div>
      <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-zinc-500 text-[8.5px] font-semibold uppercase tracking-[0.2em] px-2 py-1 rounded-sm">
        Publicité
      </span>
    </a>
  )
}

// ─── Partage social (§4.6) ────────────────────────────────────────

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const enc = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const items = [
    { name: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`, color: 'hover:bg-[#1877F2]' },
    { name: 'WhatsApp', icon: Globe, href: `https://wa.me/?text=${t}%20${enc}`, color: 'hover:bg-[#25D366]' },
    { name: 'X', icon: Twitter, href: `https://twitter.com/intent/tweet?text=${t}&url=${enc}`, color: 'hover:bg-black' },
    { name: 'TikTok', icon: Music2, href: `https://www.tiktok.com/`, color: 'hover:bg-black' },
    { name: 'Threads', icon: AtSign, href: `https://www.threads.net/intent/post?text=${t}%20${enc}`, color: 'hover:bg-black' },
  ]
  return (
    <div className="flex items-center gap-1.5">
      <span className="tg-kicker text-zinc-400 mr-1.5 flex items-center gap-1.5"><Share2 size={12} aria-hidden /> Partager</span>
      {items.map(s => (
        <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Partager sur ${s.name}`} title={s.name}
          className={cn('w-9 h-9 rounded-full border border-zinc-200 text-zinc-600 bg-white flex items-center justify-center transition-all duration-300 hover:text-white hover:border-transparent hover:-translate-y-0.5', s.color)}>
          <s.icon size={14} />
        </a>
      ))}
    </div>
  )
}

// ─── Icône réseau social par plateforme (§7.3) ────────────────────

export function SocialIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase()
  const cls = 'shrink-0'
  if (p.includes('facebook')) return <Facebook size={size} className={cls} />
  if (p.includes('twitter') || p === 'x') return <Twitter size={size} className={cls} />
  if (p.includes('instagram')) return <Instagram size={size} className={cls} />
  if (p.includes('youtube')) return <Youtube size={size} className={cls} />
  if (p.includes('tiktok')) return <Music2 size={size} className={cls} />
  if (p.includes('threads')) return <AtSign size={size} className={cls} />
  if (p.includes('telegram')) return <Send size={size} className={cls} />
  return <Globe size={size} className={cls} />
}

// ─── Badge de statut (back-office §7.5) ───────────────────────────

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[status] || 'bg-zinc-100 text-zinc-600 border-zinc-200')}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ─── Lecteur audio harmonisé (§4.9, §6.3) ─────────────────────────

export function AudioPlayer({ src, title, emission, compact }: { src: string; title: string; emission?: string; compact?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [error, setError] = useState(false)

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    const onTime = () => setProgress(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onEnd = () => setPlaying(false)
    const onError = () => setError(true)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onError)
    }
  }, [src])

  const toggle = () => {
    const audio = ref.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().catch(() => setError(true)); setPlaying(true) }
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = ref.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setProgress(ratio * duration)
  }
  const cycleRate = () => {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 0.75 : 1
    setRate(next)
    if (ref.current) ref.current.playbackRate = next
  }

  if (error) {
    return (
      <div className="rounded-sm border border-dashed border-zinc-300 bg-tg-gray p-3.5 text-[13px] text-muted-foreground flex items-center gap-2">
        <Pause size={15} aria-hidden /> Audio momentanément indisponible ({title})
      </div>
    )
  }

  return (
    <div className={cn('rounded-md border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(20,33,61,0.05)]', compact ? 'p-3' : 'p-4')}>
      <audio ref={ref} src={src} preload="metadata" />
      <div className="flex items-center gap-3.5">
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}
          className="shrink-0 w-10 h-10 rounded-full bg-tg-navy hover:bg-tg-red text-white flex items-center justify-center transition-colors duration-300">
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          {!compact && <p className="font-semibold text-[13.5px] text-tg-navy truncate">{title}</p>}
          {emission && !compact && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{emission}</p>}
          <div className="flex items-center gap-2.5 mt-2">
            <span className="text-[10px] text-zinc-400 tabular-nums w-9 font-medium">{fmt.duration(progress)}</span>
            <div className="flex-1 h-[3px] bg-zinc-200 rounded-full cursor-pointer relative group/bar" onClick={seek} role="progressbar" aria-valuenow={progress} aria-valuemax={duration || 100} aria-label="Progression">
              <div className="h-full bg-tg-red rounded-full relative" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-tg-red rounded-full shadow-sm" />
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 tabular-nums w-9 text-right font-medium">{duration ? fmt.duration(duration) : '—:—'}</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button onClick={cycleRate} title="Vitesse de lecture" className="text-[11px] font-semibold text-tg-navy border border-zinc-200 rounded-sm px-1.5 py-1 hover:border-tg-navy transition-colors tabular-nums">
            {rate}×
          </button>
          <button onClick={() => { setMuted(!muted); if (ref.current) ref.current.muted = !muted }} aria-label={muted ? 'Activer le son' : 'Couper le son'} className="p-1.5 text-zinc-500 hover:text-tg-red transition-colors">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); if (ref.current) { ref.current.volume = v; ref.current.muted = v === 0 } }}
            className="w-14 accent-tg-navy" />
        </div>
      </div>
    </div>
  )
}

// ─── Embed YouTube (§6.2) ─────────────────────────────────────────

export function youtubeId(url?: string | null): string | null {
  if (!url) return null
  // watch?v= · youtu.be · /embed/ · /shorts/ · /live/ (directs) · m.youtube.com · /v/
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export function YouTubeEmbed({ url, title }: { url?: string | null; title?: string }) {
  const id = youtubeId(url)
  if (!id) return null
  return (
    <div className="relative w-full aspect-video rounded-sm overflow-hidden my-0 bg-black shadow-sm">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title={title || 'Vidéo YouTube'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}

// ─── Rendu HTML enrichi sécurisé (§5) ─────────────────────────────

export function RichText({ html, className }: { html: string; className?: string }) {
  // Le HTML provient déjà du serveur nettoyé par liste blanche ; cette seconde
  // passe côté client est une défense en profondeur (données altérées en base,
  // ancien contenu…) : seules les balises/attributs/schémas autorisés passent.
  const clean = sanitizeRichText(html)
  return <div className={`tg-prose ${className || ''}`} dangerouslySetInnerHTML={{ __html: clean }} />
}

// ─── Fil d'Ariane (§4.5) ──────────────────────────────────────────

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <ChevronRight size={11} className="text-zinc-300 shrink-0" aria-hidden />}
          {item.to ? (
            <Link to={item.to} className="hover:text-tg-red transition-colors">{item.label}</Link>
          ) : (
            <span className="text-tg-navy truncate max-w-[220px]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ─── Pagination (§4.5) ────────────────────────────────────────────

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null
  const nums: number[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== -1) nums.push(-1)
  }
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-10 flex-wrap">
      <Link to={makeHref(Math.max(1, page - 1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}
        className={cn('h-10 px-3.5 inline-flex items-center gap-1.5 rounded-sm border text-[13px] font-medium transition-colors',
          page <= 1 ? 'pointer-events-none opacity-40 border-zinc-200 text-zinc-400' : 'border-zinc-300 text-tg-navy hover:border-tg-red hover:text-tg-red')}>
        <ChevronLeft size={14} aria-hidden /> Précédent
      </Link>
      {nums.map((n, i) => n === -1
        ? <span key={`e${i}`} className="px-1.5 text-zinc-400">…</span>
        : (
          <Link key={n} to={makeHref(n)} aria-current={n === page ? 'page' : undefined}
            className={cn('min-w-10 h-10 inline-flex items-center justify-center px-3 rounded-sm text-[13px] font-semibold border transition-colors',
              n === page ? 'bg-tg-navy text-white border-tg-navy' : 'border-zinc-300 text-tg-navy hover:border-tg-red hover:text-tg-red')}>
            {n}
          </Link>
        )
      )}
      <Link to={makeHref(Math.min(pages, page + 1))} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}
        className={cn('h-10 px-3.5 inline-flex items-center gap-1.5 rounded-sm border text-[13px] font-medium transition-colors',
          page >= pages ? 'pointer-events-none opacity-40 border-zinc-200 text-zinc-400' : 'border-zinc-300 text-tg-navy hover:border-tg-red hover:text-tg-red')}>
        Suivant <ChevronRight size={14} aria-hidden />
      </Link>
    </nav>
  )
}
