/* Migration des données SQLite (db/custom.db) → PostgreSQL (DATABASE_URL).
 * Usage : bun scripts/migrate-to-postgres.ts [--from <chemin sqlite>]
 * Idempotent : vide les tables cibles avant copie. Les dates Prisma/SQLite
 * sont stockées en millisecondes — converties en Date pour PostgreSQL.
 */
import { Database } from 'bun:sqlite'
import { PrismaClient } from '@prisma/client'
import path from 'path'

const sqlitePath = process.argv.includes('--from')
  ? path.resolve(process.argv[process.argv.indexOf('--from') + 1])
  : path.resolve(import.meta.dir, '..', 'db', 'custom.db')

const db = new PrismaClient()
const lite = new Database(sqlitePath, { readonly: true })

/** Conversion date Prisma/SQLite (ms ou NULL) → Date | null */
const d = (v: unknown): Date | null => (v == null ? null : new Date(Number(v)))

function rows(table: string): Record<string, unknown>[] {
  // "order" est un mot-clé SQL : la table Rubrique nécessite un alias explicite
  const select = table === 'Rubrique' ? 'id, name, menuLabel, slug, parentId, color, icon, imageUrl, "order" AS "order", isActive, createdAt, updatedAt' : '*'
  return lite.query(`SELECT ${select} FROM "${table}"`).all() as Record<string, unknown>[]
}

async function main() {
  console.log(`▶ Source SQLite : ${sqlitePath}`)
  console.log('▶ Cible : PostgreSQL (DATABASE_URL) — vérification de la connexion…')
  await db.$queryRaw`SELECT 1`
  console.log('✓ Connexion PostgreSQL établie\n')

  console.log('🧹 Nettoyage des tables cibles…')
  // Ordre inverse des dépendances
  await db.activityLog.deleteMany()
  await db.editablePage.deleteMany()
  await db.siteSetting.deleteMany()
  await db.adCampaign.deleteMany()
  await db.advertiser.deleteMany()
  await db.adSlot.deleteMany()
  await db.contactMessage.deleteMany()
  await db.socialLink.deleteMany()
  await db.contactChannel.deleteMany()
  await db.flashInfo.deleteMany()
  await db.episode.deleteMany()
  await db.emission.deleteMany()
  await db.media.deleteMany()
  await db.articleViewLog.deleteMany()
  await db.articleTag.deleteMany()
  await db.article.deleteMany()
  await db.tag.deleteMany()
  await db.rubrique.deleteMany()
  await db.user.deleteMany()

  let total = 0
  const count = async (label: string, n: number | bigint) => {
    total += Number(n)
    console.log(`  ✓ ${label.padEnd(16)} ${String(n).padStart(4)} ligne(s)`)
  }

  console.log('\n📦 Copie des données…')

  // 1. Utilisateurs
  const users = rows('User')
  await db.user.createMany({
    data: users.map(u => ({
      id: String(u.id), name: String(u.name), email: String(u.email),
      passwordHash: String(u.passwordHash), role: String(u.role),
      bio: (u.bio as string) ?? null, avatarUrl: (u.avatarUrl as string) ?? null,
      isActive: Boolean(u.isActive), lastLoginAt: d(u.lastLoginAt),
      createdAt: d(u.createdAt)!, updatedAt: d(u.updatedAt)!,
    })),
  })
  await count('User', users.length)

  // 2. Rubriques — racines puis enfants (auto-référence parentId)
  const rubriques = rows('Rubrique')
  const rubData = (r: Record<string, unknown>) => ({
    id: String(r.id), name: String(r.name),
    menuLabel: (r.menuLabel as string) ?? null, slug: String(r.slug),
    parentId: (r.parentId as string) ?? null, color: String(r.color),
    icon: String(r.icon), imageUrl: (r.imageUrl as string) ?? null,
    order: Number(r.order), isActive: Boolean(r.isActive),
    createdAt: d(r.createdAt)!, updatedAt: d(r.updatedAt)!,
  })
  // Insertion par vagues : à chaque tour, les rubriques dont le parent est
  // déjà en base (gère une arborescence de profondeur quelconque).
  const inserted = new Set(rubriques.filter(r => !r.parentId).map(r => String(r.id)))
  await db.rubrique.createMany({ data: rubriques.filter(r => !r.parentId).map(rubData) })
  let pending = rubriques.filter(r => r.parentId)
  while (pending.length) {
    const wave = pending.filter(r => inserted.has(String(r.parentId)))
    if (!wave.length) throw new Error(`Rubriques orphelines (parentId inconnu) : ${pending.map(r => r.id).join(', ')}`)
    await db.rubrique.createMany({ data: wave.map(rubData) })
    for (const r of wave) inserted.add(String(r.id))
    pending = pending.filter(r => !wave.includes(r))
  }
  await count('Rubrique', rubriques.length)

  // 3. Tags
  const tags = rows('Tag')
  await db.tag.createMany({
    data: tags.map(t => ({ id: String(t.id), name: String(t.name), slug: String(t.slug) })),
  })
  await count('Tag', tags.length)

  // 4. Articles
  const articles = rows('Article')
  for (const a of articles) {
    await db.article.create({
      data: {
        id: String(a.id), title: String(a.title),
        subtitle: String(a.subtitle ?? ''), description: String(a.description ?? ''),
        body: String(a.body ?? ''), slug: String(a.slug),
        coverImage: (a.coverImage as string) ?? null, coverAlt: String(a.coverAlt ?? ''),
        rubriqueId: String(a.rubriqueId), subRubriqueId: (a.subRubriqueId as string) ?? null,
        authorId: String(a.authorId), status: String(a.status),
        publishedAt: d(a.publishedAt), scheduledAt: d(a.scheduledAt),
        featuredOrder: a.featuredOrder == null ? null : Number(a.featuredOrder),
        views: Number(a.views), readTime: Number(a.readTime),
        youtubeUrl: (a.youtubeUrl as string) ?? null,
        createdAt: d(a.createdAt)!, updatedAt: d(a.updatedAt)!,
      },
    })
  }
  await count('Article', articles.length)

  // 5. ArticleTag (relation n-n)
  const articleTags = rows('ArticleTag')
  await db.articleTag.createMany({
    data: articleTags.map(t => ({ articleId: String(t.articleId), tagId: String(t.tagId) })),
  })
  await count('ArticleTag', articleTags.length)

  // 6. Journal des vues
  const viewLogs = rows('ArticleViewLog')
  await db.articleViewLog.createMany({
    data: viewLogs.map(v => ({
      id: String(v.id), articleId: String(v.articleId),
      day: String(v.day), count: Number(v.count),
    })),
  })
  await count('ArticleViewLog', viewLogs.length)

  // 7. Médias
  const medias = rows('Media')
  await db.media.createMany({
    data: medias.map(m => ({
      id: String(m.id), type: String(m.type), url: String(m.url),
      alt: String(m.alt ?? ''), articleId: (m.articleId as string) ?? null,
      meta: String(m.meta ?? '{}'), createdAt: d(m.createdAt)!,
    })),
  })
  await count('Media', medias.length)

  // 8. Émissions + épisodes
  const emissions = rows('Emission')
  await db.emission.createMany({
    data: emissions.map(e => ({
      id: String(e.id), title: String(e.title), description: String(e.description ?? ''),
      coverImage: (e.coverImage as string) ?? null, type: String(e.type),
      order: Number(e.order), isActive: Boolean(e.isActive),
      createdAt: d(e.createdAt)!, updatedAt: d(e.updatedAt)!,
    })),
  })
  await count('Emission', emissions.length)

  const episodes = rows('Episode')
  await db.episode.createMany({
    data: episodes.map(e => ({
      id: String(e.id), emissionId: String(e.emissionId), title: String(e.title),
      description: String(e.description ?? ''), audioUrl: String(e.audioUrl),
      duration: Number(e.duration), guests: String(e.guests ?? ''),
      articleId: (e.articleId as string) ?? null, publishAt: d(e.publishAt),
      isPublished: Boolean(e.isPublished), listens: Number(e.listens),
      createdAt: d(e.createdAt)!, updatedAt: d(e.updatedAt)!,
    })),
  })
  await count('Episode', episodes.length)

  // 9. Flash infos
  const flashes = rows('FlashInfo')
  await db.flashInfo.createMany({
    data: flashes.map(f => ({
      id: String(f.id), text: String(f.text),
      articleId: (f.articleId as string) ?? null, priority: Number(f.priority),
      isActive: Boolean(f.isActive), publishAt: d(f.publishAt)!,
      expiresAt: d(f.expiresAt), createdAt: d(f.createdAt)!, updatedAt: d(f.updatedAt)!,
    })),
  })
  await count('FlashInfo', flashes.length)

  // 10. Contacts, réseaux, messages
  const channels = rows('ContactChannel')
  await db.contactChannel.createMany({
    data: channels.map(c => ({
      id: String(c.id), type: String(c.type), label: String(c.label ?? ''),
      value: String(c.value), order: Number(c.order), isActive: Boolean(c.isActive),
    })),
  })
  await count('ContactChannel', channels.length)

  const socials = rows('SocialLink')
  await db.socialLink.createMany({
    data: socials.map(s => ({
      id: String(s.id), platform: String(s.platform), url: String(s.url),
      order: Number(s.order), isActive: Boolean(s.isActive),
    })),
  })
  await count('SocialLink', socials.length)

  const messages = rows('ContactMessage')
  await db.contactMessage.createMany({
    data: messages.map(m => ({
      id: String(m.id), name: String(m.name), email: String(m.email),
      subject: String(m.subject), message: String(m.message),
      isRead: Boolean(m.isRead), isArchived: Boolean(m.isArchived),
      receivedAt: d(m.receivedAt)!,
    })),
  })
  await count('ContactMessage', messages.length)

  // 11. Publicité
  const slots = rows('AdSlot')
  await db.adSlot.createMany({
    data: slots.map(s => ({
      id: String(s.id), name: String(s.name), position: String(s.position),
      format: String(s.format), isActive: Boolean(s.isActive),
    })),
  })
  await count('AdSlot', slots.length)

  const advertisers = rows('Advertiser')
  await db.advertiser.createMany({
    data: advertisers.map(a => ({
      id: String(a.id), name: String(a.name), contact: String(a.contact ?? ''),
      notes: String(a.notes ?? ''), createdAt: d(a.createdAt)!,
    })),
  })
  await count('Advertiser', advertisers.length)

  const campaigns = rows('AdCampaign')
  await db.adCampaign.createMany({
    data: campaigns.map(c => ({
      id: String(c.id), slotId: String(c.slotId),
      advertiserId: (c.advertiserId as string) ?? null, title: String(c.title),
      imageUrl: (c.imageUrl as string) ?? null, linkUrl: String(c.linkUrl ?? ''),
      weight: Number(c.weight), startDate: d(c.startDate)!,
      endDate: d(c.endDate), impressions: Number(c.impressions),
      clicks: Number(c.clicks), isActive: Boolean(c.isActive),
      createdAt: d(c.createdAt)!, updatedAt: d(c.updatedAt)!,
    })),
  })
  await count('AdCampaign', campaigns.length)

  // 12. Paramètres, pages, journal
  const settings = rows('SiteSetting')
  await db.siteSetting.createMany({
    data: settings.map(s => ({ key: String(s.key), value: String(s.value), updatedAt: d(s.updatedAt)! })),
  })
  await count('SiteSetting', settings.length)

  const pages = rows('EditablePage')
  await db.editablePage.createMany({
    data: pages.map(p => ({
      key: String(p.key), title: String(p.title),
      content: String(p.content ?? ''), updatedAt: d(p.updatedAt)!,
    })),
  })
  await count('EditablePage', pages.length)

  const logs = rows('ActivityLog')
  await db.activityLog.createMany({
    data: logs.map(l => ({
      id: String(l.id), userId: (l.userId as string) ?? null,
      userLabel: String(l.userLabel ?? 'système'), action: String(l.action),
      entity: String(l.entity), entityId: (l.entityId as string) ?? null,
      detail: String(l.detail ?? ''), createdAt: d(l.createdAt)!,
    })),
  })
  await count('ActivityLog', logs.length)

  console.log(`\n🎉 Migration terminée : ${total} lignes copiées vers PostgreSQL.`)

  // Vérification croisée
  const [u, a, r] = await Promise.all([
    db.user.count(), db.article.count(), db.rubrique.count(),
  ])
  console.log(`\nContrôle PostgreSQL → utilisateurs: ${u}, articles: ${a}, rubriques: ${r}`)
}

main()
  .catch((e) => { console.error('✖ Échec de la migration :', e); process.exitCode = 1 })
  .finally(() => { db.$disconnect(); lite.close() })
