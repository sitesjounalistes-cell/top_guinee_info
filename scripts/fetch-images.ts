// Télécharge de VRAIES images (résultats image-search web) et remplace les
// images IA du site. Convertit en JPEG optimisé (max 1600px, mozjpeg q82).
// Met ensuite à jour la base (articles, émissions, pubs, épisodes) et seed.ts.
// Usage : bun scripts/fetch-images.ts
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { PrismaClient } from '@prisma/client'

const ROOT = '/home/z/my-project'
const OUT_DIR = path.join(ROOT, 'public/uploads')
const IMG_DIR = path.join(ROOT, 'tool-results/imgsearch')
const db = new PrismaClient()

// Cible → fichier de résultats de recherche
const MAP: Record<string, string> = {
  'cover-une.jpg': 'q-une.json',
  'cover-economie.jpg': 'q-economie.json',
  'cover-sport.jpg': 'q-sport.json',
  'cover-culture.jpg': 'q-culture.json',
  'cover-politique.jpg': 'q-politique.json',
  'cover-sante.jpg': 'q-sante.json',
  'cover-education.jpg': 'q-education.json',
  'cover-international.jpg': 'q-international.json',
  'cover-redaction.jpg': 'q-redaction.json',
  'emission-journal.jpg': 'q-radio.json',
  'emission-debat.jpg': 'q-debat.jpg'.replace('.jpg', '.json'),
  'pub-orange.jpg': 'q-orange.json',
  'pub-banque.jpg': 'q-ecobank.json',
}

interface Hit {
  original_url: string
  original_width?: string
  original_height?: string
}

function parseResults(raw: string): Hit[] {
  const i = raw.indexOf('{')
  if (i < 0) return []
  try {
    const json = JSON.parse(raw.slice(i))
    return Array.isArray(json.results) ? json.results : []
  } catch {
    return []
  }
}

const px = (s?: string) => (s ? parseInt(s.replace(/\D/g, ''), 10) || 0 : 0)

/** Trie les candidats : grande image, ratio plausible, écarte les miniatures/bannières */
function rank(hits: Hit[]): Hit[] {
  return hits
    .map(h => ({ h, w: px(h.original_width), ht: px(h.original_height) }))
    .filter(({ w, ht }) => w >= 500 && ht >= 300)
    .map(({ h, w, ht }) => ({ h, score: (w * ht) * (w / ht > 2.6 || w / ht < 0.8 ? 0.15 : 1) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.h)
}

async function fetchOne(target: string, sourceFile: string): Promise<boolean> {
  const raw = await fs.readFile(path.join(IMG_DIR, sourceFile), 'utf8').catch(() => '')
  const hits = rank(parseResults(raw))
  if (!hits.length) {
    console.error(`✗ ${target}: aucun candidat dans ${sourceFile}`)
    return false
  }
  for (const hit of hits.slice(0, 4)) {
    try {
      const res = await fetch(hit.original_url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 20_000) continue // trop petit = vignette
      const out = await sharp(buf)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
      if (out.length < 15_000) continue
      await fs.writeFile(path.join(OUT_DIR, target), out)
      console.log(`✓ ${target} ← ${(out.length / 1024).toFixed(0)} Ko (${hit.original_url.slice(-40)})`)
      return true
    } catch {
      // candidat suivant
    }
  }
  console.error(`✗ ${target}: tous les téléchargements ont échoué`)
  return false
}

async function main() {
  const results = await Promise.all(
    Object.entries(MAP).map(([target, src]) => fetchOne(target, src)),
  )
  const ok = results.filter(Boolean).length
  console.log(`\n${ok}/${results.length} images remplacées`)
  if (ok === 0) process.exit(1)

  // ── seed.ts : cas spéciaux puis renommage générique .png → .jpg ──
  const seedPath = path.join(ROOT, 'prisma/seed.ts')
  let seed = await fs.readFile(seedPath, 'utf8')
  const specials: [RegExp, string][] = [
    [/img\('cover-societe\.png'\), alt: 'Centre de santé en Guinée'/, "img('cover-sante.jpg'), alt: 'Centre de santé en Guinée'"],
    [/img\('cover-societe\.png'\), alt: 'Élèves guinéens en classe'/, "img('cover-education.jpg'), alt: 'Élèves guinéens en classe'"],
    [/img\('cover-politique\.png'\), alt: 'Salle de rédaction'/, "img('cover-redaction.jpg'), alt: 'Salle de rédaction'"],
    [/sample-chronique\.mp3/, 'sample-chronique.wav'],
  ]
  for (const [re, to] of specials) seed = seed.replace(re, to)
  seed = seed.replace(/img\('(cover-|emission-|pub-)[a-z]+\.png'\)/g, (m) => m.replace('.png', '.jpg'))
  await fs.writeFile(seedPath, seed)
  console.log('✓ seed.ts mis à jour')

  // ── Base de données : mêmes règles ──────────────────────────────
  const articles = await db.article.findMany({
    where: { coverImage: { contains: '/uploads/' } },
    select: { id: true, coverImage: true, title: true, coverAlt: true },
  })
  for (const a of articles) {
    if (!a.coverImage) continue
    let next = a.coverImage.replace(/\.png$/, '.jpg')
    if (a.coverImage.includes('cover-societe')) {
      const hay = `${a.title} ${a.coverAlt}`.toLowerCase()
      next = hay.includes('sant') || hay.includes('clinic')
        ? '/uploads/cover-sante.jpg'
        : '/uploads/cover-education.jpg'
    } else if (a.coverImage.includes('cover-politique')) {
      const hay = `${a.title} ${a.coverAlt}`.toLowerCase()
      if (hay.includes('rédaction') || hay.includes('redaction') || hay.includes('journaliste')) {
        next = '/uploads/cover-redaction.jpg'
      }
    }
    if (next !== a.coverImage) {
      await db.article.update({ where: { id: a.id }, data: { coverImage: next } })
    }
  }

  // Émissions (coverImage) et campagnes pub (imageUrl)
  const emissions = await db.emission.findMany({
    where: { coverImage: { contains: '/uploads/' } },
    select: { id: true, coverImage: true },
  })
  for (const em of emissions) {
    if (em.coverImage?.endsWith('.png')) {
      await db.emission.update({
        where: { id: em.id },
        data: { coverImage: em.coverImage.replace(/\.png$/, '.jpg') },
      })
    }
  }
  const campaigns = await db.adCampaign.findMany({
    where: { imageUrl: { contains: '/uploads/' } },
    select: { id: true, imageUrl: true },
  })
  for (const c of campaigns) {
    if (c.imageUrl?.endsWith('.png')) {
      await db.adCampaign.update({
        where: { id: c.id },
        data: { imageUrl: c.imageUrl.replace(/\.png$/, '.jpg') },
      })
    }
  }

  // Épisodes : l'échantillon audio est un .wav (le .mp3 n'existe pas sur le disque)
  await db.episode.updateMany({
    where: { audioUrl: '/uploads/audio/sample-chronique.mp3' },
    data: { audioUrl: '/uploads/audio/sample-chronique.wav' },
  })

  // ── Nettoyage des anciennes images IA (.png) sauf le logo ───────
  const files = await fs.readdir(OUT_DIR)
  for (const f of files) {
    if (/^(cover-|emission-|pub-).+\.png$/.test(f)) {
      await fs.rm(path.join(OUT_DIR, f)).catch(() => {})
      console.log(`🗑 ancien ${f} supprimé`)
    }
  }
  console.log('Terminé.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
