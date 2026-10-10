// Page article réelle (SSR) — cœur du SEO du site média (§4.6, §9).
// Contrairement au reste de l'application (SPA à hash), chaque article
// dispose d'une vraie URL /article/<slug> : HTML prérendu côté serveur,
// métadonnées dynamiques (title/description/Open Graph/Twitter), JSON-LD
// NewsArticle, URL canonique — indexable par les moteurs et les agrégateurs
// (Google News), partageable avec un aperçu riche sur les réseaux sociaux.
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import {
  visibleWhere, articleFullInclude, articleCardInclude, toFull, toCard,
  getSettings, pickBanner, clientIp, isBot, oncePerWindow, dayStr,
} from '@/lib/server/helpers'
import { safeHttpUrl, stripHtml } from '@/lib/sanitize'
import { siteOrigin, absolutize, SITE_URL } from '@/lib/server/site-origin'
import { getDict, isLang } from '@/lib/i18n/dicts'
import { translateCard, translateCards, translateHtml, translateText, translateTexts } from '@/lib/server/translate'
import type { ArticleCardData } from '@/lib/types'
import { FadeImage, FlashTicker, RichInline, RichText, ShareButtons, YouTubeEmbed, ArticleCard } from '@/components/tg/shared'
import { ImpressionBanner } from '@/components/front/common'
import { ArrowRight, Clock, Eye, Languages } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SHELL = 'max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8'
const RANK_COLORS = ['#D21034', '#c99700', '#00734B', '#14213D', '#a80c28']

// Formatage léger (la page est un composant serveur : pas d'import client)
const DATE_LOCALES: Record<string, string> = {
  fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', ar: 'ar-EG', zh: 'zh-CN',
}

function fmtDateTime(d?: string | null, lang = 'fr'): string {
  if (!d) return '—'
  const loc = DATE_LOCALES[lang] || 'fr-FR'
  return new Date(d).toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + ' M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' k'
  return String(n)
}

/** Article visible + fiche complète, ou null. */
async function loadArticle(slug: string) {
  const now = new Date()
  const article = await db.article.findUnique({ where: { slug }, include: articleFullInclude })
  if (!article) return null
  const visible =
    article.status === 'PUBLISHED' &&
    !!article.publishedAt && article.publishedAt.getTime() <= now.getTime() &&
    (!article.scheduledAt || article.scheduledAt.getTime() <= now.getTime())
  return visible ? article : null
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const [article, settings] = await Promise.all([loadArticle(slug), getSettings()])
  if (!article) {
    return { title: { absolute: `Article introuvable — ${settings.siteName}` }, robots: { index: false } }
  }
  const title = `${stripHtml(article.title)} — ${settings.siteName}`
  const description = stripHtml(article.description || article.subtitle) || undefined
  const origin = await siteOrigin()
  // og:image absolue : cover de l'article, sinon image SEO, sinon bannière
  // de marque — JAMAIS vide (les réseaux affichent sinon un aperçu pauvre)
  const image = absolutize(
    article.coverImage || settings.seoImage || '/brand/og.jpg',
    origin,
  )
  const pageUrl = `${origin}/article/${article.slug}`
  return {
    // absolute : le template de titre du layout racine ne doit pas suffixer
    // une seconde fois le nom du site
    title: { absolute: title },
    description,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      siteName: settings.siteName,
      locale: 'fr_FR',
      url: pageUrl,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: article.author?.name ? [article.author.name] : undefined,
      section: article.rubrique?.name,
      tags: article.tags.map(t => t.tag.name),
      images: [{ url: image!, alt: article.coverAlt || article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image!],
    },
  }
}

/** Langue du visiteur (cookie posé par le sélecteur du site). */
async function visitorLang(): Promise<string> {
  const jar = await cookies()
  const v = jar.get('tg_lang')?.value || ''
  return isLang(v) ? v : 'fr'
}

export default async function ArticlePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const lang = await visitorLang()
  const t = getDict(lang)
  const raw = await loadArticle(slug)
  if (!raw) notFound()

  const now = new Date()
  const article = toFull(raw)
  const [settings, rubriques, flash, bannerInArticle, bannerSidebar, mostRead] = await Promise.all([
    getSettings(),
    db.rubrique.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { order: 'asc' },
      include: { children: { where: { isActive: true }, orderBy: { order: 'asc' } } },
    }),
    db.flashInfo.findMany({
      where: { isActive: true, publishAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
      take: 10,
      include: { article: { where: visibleWhere(now), select: { slug: true, title: true } } },
    }),
    pickBanner('intercalaire'),
    pickBanner('sidebar'),
    db.article.findMany({
      where: visibleWhere(now),
      include: articleCardInclude,
      orderBy: { views: 'desc' },
      take: 5,
    }),
  ])

  // Compteur de vues (1 vue / IP / article / heure, robots exclus) —
  // même règle que l'ancienne route API, appliquée au rendu serveur.
  try {
    const h = await headers()
    const fakeReq = new Request(SITE_URL, {
      headers: { 'user-agent': h.get('user-agent') || '', 'x-forwarded-for': h.get('x-forwarded-for') || '', 'x-real-ip': h.get('x-real-ip') || '' },
    })
    if (!isBot(fakeReq) && oncePerWindow(`view:${clientIp(fakeReq)}:${article.slug}`, 60 * 60 * 1000)) {
      const day = dayStr(now)
      await Promise.all([
        db.article.update({ where: { id: article.id }, data: { views: { increment: 1 } } }),
        db.articleViewLog.upsert({
          where: { articleId_day: { articleId: article.id, day } },
          create: { articleId: article.id, day, count: 1 },
          update: { count: { increment: 1 } },
        }),
      ])
    }
  } catch (e) {
    console.error('[article/ssr] compteur de vues', e)
  }

  // Similaires : même rubrique, puis récents
  const excludeIds = new Set([article.id])
  const similar: ArticleCardData[] = []
  const sameRubrique = await db.article.findMany({
    where: { ...visibleWhere(now), rubriqueId: raw.rubriqueId, id: { not: article.id } },
    include: articleCardInclude,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 4,
  })
  for (const a of sameRubrique) { if (similar.length < 4) { similar.push(toCard(a)); excludeIds.add(a.id) } }
  if (similar.length < 4) {
    const recent = await db.article.findMany({
      where: { ...visibleWhere(now), id: { notIn: [...excludeIds] } },
      include: articleCardInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 4 - similar.length,
    })
    for (const a of recent) similar.push(toCard(a))
  }

  const mostReadCards = mostRead.map(toCard)

  // i18n : contenus traduits avec cache en base (dégradation gracieuse
  // en français si le service est indisponible)
  if (lang !== 'fr') {
    await Promise.all([
      translateCard(article, lang),
      (async () => { article.body = await translateHtml(article.body, lang) })(),
      translateCards(similar, lang),
      translateCards(mostReadCards, lang),
      (async () => { settings.slogan = await translateText(settings.slogan, lang) })(),
      translateTexts(rubriques.map(r => r.name), lang).then(tr => {
        rubriques.forEach((r, i) => { r.name = tr[i] ?? r.name })
      }),
      translateTexts(flash.map(f => f.text), lang).then(tr => {
        flash.forEach((f, i) => { f.text = tr[i] ?? f.text })
      }),
    ])
  }

  const rub = article.rubrique
  const rubColor = rub?.color || '#D21034'
  const authorName = article.author?.name || 'Rédaction Topguinee'
  const initial = (authorName.charAt(0) || 'T').toUpperCase()
  const origin = await siteOrigin()
  const pageUrl = `${origin}/article/${article.slug}`

  // JSON-LD NewsArticle (rich results Google Actualités)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: stripHtml(article.title),
    description: article.description || article.subtitle || undefined,
    image: article.coverImage ? [absolutize(article.coverImage, origin)] : [absolutize(settings.seoImage || '/brand/og.jpg', origin)],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'fr',
    author: { '@type': 'Person', name: authorName },
    publisher: { '@type': 'NewsMediaOrganization', name: settings.siteName, slogan: settings.slogan },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    articleSection: rub?.name,
  }

  return (
    <div className="min-h-screen bg-white text-tg-navy">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Langue & direction du document (le layout racine est partagé avec la SPA) */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dir=${JSON.stringify(lang === 'ar' ? 'rtl' : 'ltr')}` }} />

      {/* ── Masthead sobre (retour SPA en un clic) ───────────────── */}
      <header className="border-b border-zinc-200">
        <div className="bg-tg-navy text-[11px] text-zinc-300">
          <div className={`${SHELL} flex h-8 items-center justify-between`}>
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="hidden sm:inline italic">{settings.slogan}</span>
          </div>
        </div>
        <div className={`${SHELL} py-5`}>
          {/* Logo officiel complet (lockup, fond clair) */}
          <a href="/" className="mx-auto flex w-max items-center" aria-label={`${settings.siteName} — accueil`}>
            <img src="/brand/logo-lockup.png" alt={settings.siteName} width={132} height={76} className="h-[68px] w-auto object-contain" />
          </a>
        </div>
        <nav className={`${SHELL} flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-zinc-100 py-3`} aria-label={t.rubrics}>
          <a href="/" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-tg-navy hover:text-tg-red transition-colors">{t.home}</a>
          {rubriques.map(r => (
            <a
              key={r.id}
              href={`/#/rubrique/${r.slug}`}
              className="text-[12px] font-semibold uppercase tracking-[0.12em] text-tg-navy hover:text-tg-red transition-colors"
            >
              {r.menuLabel || r.name}
            </a>
          ))}
        </nav>
      </header>

      {flash.length > 0 && <FlashTicker items={flash} />}

      {/* ── Article ──────────────────────────────────────────────── */}
      <article>
        <header className={`${SHELL} pt-5 md:pt-8`}>
          <nav aria-label="Fil d'Ariane" className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400">
            <a href="/" className="hover:text-tg-red transition-colors">{t.home}</a>
            {rub && (<><span aria-hidden>/</span><a href={`/#/rubrique/${rub.slug}`} className="hover:text-tg-red transition-colors">{rub.name}</a></>)}
            <span aria-hidden>/</span>
            {(() => { const t = stripHtml(article.title); return <span className="text-tg-navy">{t.length > 46 ? `${t.slice(0, 46)}…` : t}</span> })()}
          </nav>

          <div className="mt-6 md:mt-8 max-w-[860px]">
            {rub && (
              <a href={`/#/rubrique/${rub.slug}`} className="inline-flex items-center py-1.5 transition-opacity hover:opacity-70">
                <span className="tg-kicker inline-flex items-center gap-2" style={{ color: rubColor }}>
                  <span className="h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: rubColor }} aria-hidden />
                  {rub.name}
                </span>
              </a>
            )}
            <h1 className="mt-3 font-display font-bold text-[30px] md:text-[40px] leading-[1.12] tracking-tight text-tg-navy text-balance">
              <RichInline html={article.title} />
            </h1>
            {article.subtitle && (
              <p className="mt-4 font-display italic text-lg md:text-xl text-zinc-500 leading-relaxed text-pretty">
                <RichInline html={article.subtitle} />
              </p>
            )}
          </div>

          <div className="mt-7 md:mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-zinc-200 pb-5 md:pb-6">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-tg-navy font-display text-[15px] font-bold text-white">
                {initial}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-zinc-500">
                <span className="font-semibold text-tg-navy">{authorName}</span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span>{fmtDateTime(article.publishedAt, lang)}</span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} aria-hidden className="text-zinc-400" /> {article.readTime} {t.minutesRead}
                </span>
                <span aria-hidden className="select-none text-zinc-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={13} aria-hidden className="text-zinc-400" /> {fmtNum(article.views)} {t.views}
                </span>
              </div>
            </div>
            <div className="ml-auto shrink-0">
              <ShareButtons url={pageUrl} title={article.title} />
            </div>
          </div>
          {lang !== 'fr' && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-500">
              <Languages size={12} aria-hidden /> {t.translationNotice}
            </p>
          )}
        </header>

        <figure className={`${SHELL} mt-7 md:mt-10`}>
          <div className="relative aspect-[16/9] overflow-hidden rounded-sm border border-zinc-200 bg-tg-gray">
            <FadeImage
              src={article.coverImage}
              alt={article.coverAlt || article.title}
              fill
              sizes="(max-width:1024px) 100vw, 1100px"
              priority
              className="absolute inset-0"
            />
          </div>
          {article.coverAlt && article.coverAlt !== article.title && (
            <figcaption className="mt-2.5 text-center text-xs italic text-zinc-400">{article.coverAlt}</figcaption>
          )}
        </figure>

        {article.youtubeUrl && safeHttpUrl(article.youtubeUrl) && (
          <div className={`${SHELL} mt-6`}>
            <YouTubeEmbed url={article.youtubeUrl} title={article.title} />
          </div>
        )}

        <div className={`${SHELL} mt-9 md:mt-12`}>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
            <div className="min-w-0">
              <div className="max-w-[720px] mx-auto lg:mx-0">
                <RichText html={article.body} className="tg-dropcap" />

                {bannerInArticle && (
                  <div className="my-10 flex justify-center">
                    <ImpressionBanner banner={bannerInArticle} position="intercalaire" className="w-full" />
                  </div>
                )}

                {article.tags && article.tags.length > 0 && (
                  <div className="border-t border-zinc-200 pt-7" aria-label={t.relatedTopics}>
                    <p className="tg-kicker flex items-center gap-2 text-zinc-400">
                      <span className="h-1.5 w-1.5 rotate-45 bg-tg-navy/60" aria-hidden />
                      {t.relatedTopics}
                    </p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {article.tags.map(t => (
                        <a
                          key={t.id}
                          href={`/#/recherche?q=${encodeURIComponent(t.name)}`}
                          className="inline-flex items-center rounded-sm border border-zinc-300 px-3 py-1.5 text-[12px] font-medium uppercase tracking-wide text-tg-navy transition-colors hover:border-tg-red hover:text-tg-red"
                        >
                          #{t.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="mt-12 lg:mt-0 space-y-9 lg:sticky lg:top-24 lg:self-start" aria-label={t.alsoRead}>
              {bannerSidebar && <ImpressionBanner banner={bannerSidebar} position="sidebar" />}

              {similar.length > 0 && (
                <section aria-label="À lire aussi">
                  <h2 className="flex items-center gap-2.5 border-b border-zinc-200 pb-3 font-display text-[18px] font-bold tracking-tight text-tg-navy">
                    <span className="h-2 w-2 shrink-0 rotate-45" style={{ backgroundColor: rubColor }} aria-hidden />
                    {t.alsoRead}
                  </h2>
                  <div className="divide-y divide-zinc-200">
                    {similar.slice(0, 3).map(a => (
                      <div key={a.id} className="py-4 first:pt-4 last:pb-0">
                        <ArticleCard article={a} variant="horizontal" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {mostRead.length > 0 && (
                <section aria-label={t.mostRead}>
                  <h2 className="flex items-center gap-2.5 border-b border-zinc-200 pb-3 font-display text-[18px] font-bold tracking-tight text-tg-navy">
                    <span className="h-2 w-2 shrink-0 rotate-45 bg-tg-red" aria-hidden />
                    {t.mostRead}
                  </h2>
                  <ol className="divide-y divide-zinc-200">
                    {mostReadCards.map((a, i) => (
                      <li key={a.id} className="flex items-start gap-2.5 py-3.5 first:pt-4 last:pb-0">
                        <span
                          aria-hidden
                          className="w-5 shrink-0 pt-0.5 select-none text-center font-display text-[20px] font-bold leading-none"
                          style={{ color: RANK_COLORS[i % RANK_COLORS.length] }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ArticleCard article={a} variant="small" />
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </aside>
          </div>
        </div>
      </article>

      {similar.length > 0 && (
        <section className="mt-14 md:mt-20 bg-tg-paper" aria-label={t.alsoRead}>
          <div className="tg-tricolor-band" aria-hidden><i /></div>
          <div className={`${SHELL} py-12 md:py-16`}>
            <div className="flex items-end justify-between gap-4 border-b-2 border-tg-navy pb-3 mb-6">
              <h2 className="font-display text-[22px] md:text-[26px] font-bold tracking-tight text-tg-navy leading-none">{t.alsoRead}</h2>
              {rub && (
                <a
                  href={`/#/rubrique/${rub.slug}`}
                  className="group/link inline-flex items-center gap-1.5 tg-kicker text-tg-red hover:text-tg-red-dark transition-colors py-1"
                >
                  {t.allRubric}
                  <ArrowRight size={13} aria-hidden className="transition-transform duration-300 group-hover/link:translate-x-1" />
                </a>
              )}
            </div>
            <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map(a => (
                <ArticleCard key={a.id} article={a} variant="medium" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Pied de page sobre ───────────────────────────────────── */}
      <footer className="border-t border-zinc-200 bg-tg-paper/60">
        <div className={`${SHELL} flex flex-col items-center gap-3 py-8 text-center`}>
          <a href="/" className="font-display font-bold text-tg-navy">
            Topguinee<span className="text-tg-red">.</span><span className="text-tg-yellow">info</span>
          </a>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-zinc-500" aria-label={t.theMedia}>
            <a href="/#/about" className="hover:text-tg-red transition-colors">{t.about}</a>
            <a href="/#/contact" className="hover:text-tg-red transition-colors">{t.contact}</a>
            <a href="/#/legal" className="hover:text-tg-red transition-colors">{t.legal}</a>
            <a href="/#/privacy" className="hover:text-tg-red transition-colors">{t.privacy}</a>
          </nav>
          <p className="text-[11px] text-zinc-400">© {new Date().getFullYear()} Topguinee.info — Toute reproduction sans autorisation est interdite.</p>
        </div>
      </footer>
    </div>
  )
}
