/**
 * Génération des déclinaisons de marque Topguinee.info à partir du logo
 * officiel fourni (JPG fond blanc) :
 *  - logo-lockup.png       : emblème + « topguinee » + « .info » (transparent, couleurs d'origine)
 *  - logo-lockup-dark.png  : identique, adapté aux fonds navy (texte bleu marine → blanc)
 *  - logo-full.png         : lockup + slogan incrusté (transparent, couleurs d'origine)
 *  - logo-map.png          : carte de la Guinée tricolore (transparent) — avatar carré / logoUrl
 *  - icônes : app/icon.png, app/apple-icon.png, brand/icon-512.png, brand/icon-192.png
 *  - brand/og.jpg           : bannière Open Graph 1200×630
 *
 * Technique : dématage du fond blanc (alpha + un-premultiply), découpe par
 * bandes de lignes vides, re-coloration douce des pixels bleu marine.
 */
import sharp from 'sharp'
import { mkdirSync } from 'fs'

const SRC = '/tmp/logo-topguinee.jpg'
const PUB = '/home/z/my-project/public/brand'
const APP = '/home/z/my-project/src/app'
mkdirSync(PUB, { recursive: true })

type Px = { data: Uint8ClampedArray; w: number; h: number; ch: number }

async function loadDematted(): Promise<Px> {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height, ch = info.channels
  const out = new Uint8ClampedArray(w * h * 4)
  for (let i = 0, j = 0; i < w * h * ch; i += ch, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    // distance au blanc → alpha (×3 pour conserver les demi-teintes d'antialiasing)
    const d = Math.max(255 - r, 255 - g, 255 - b)
    const a = Math.min(255, d * 3)
    if (a === 0) { out[j + 3] = 0; continue }
    // un-premultiply : retire la matrice blanche (évite les halos)
    const k = 255 / a
    out[j] = Math.min(255, 255 - (255 - r) * k)
    out[j + 1] = Math.min(255, 255 - (255 - g) * k)
    out[j + 2] = Math.min(255, 255 - (255 - b) * k)
    out[j + 3] = a
  }
  return { data: out, w, h, ch: 4 }
}

/** Re-colorie le bleu marine profond (texte « guinee », slogan) en blanc. */
function navyToWhite(p: Px): Px {
  const out = new Uint8ClampedArray(p.data)
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i + 1], b = out[i + 2], a = out[i + 3]
    if (a === 0) continue
    // bleu foncé : bleu dominant, luminosité faible (le bleu « personnage/swoosh » ≈ b=181 reste intact)
    if (b > r + 25 && b >= g + 10 && b < 155 && r < 110) {
      const s = Math.min(1, Math.max(0, (155 - b) / 55))
      const m = 1 - s * 0.985
      out[i] = 255 - (255 - r) * m
      out[i + 1] = 255 - (255 - g) * m
      out[i + 2] = 255 - (255 - b) * m
    }
  }
  return { ...p, data: out }
}

/** bbox du contenu non transparent dans une zone. */
function bbox(p: Px, x0: number, y0: number, x1: number, y1: number, thr = 12) {
  let minX = x1, minY = y1, maxX = x0, maxY = y0, found = false
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (p.data[(y * p.w + x) * 4 + 3] > thr) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return found ? { x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 } : null
}

function toSharp(p: Px) {
  return sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } })
}

async function save(p: Px, file: string) {
  const bb = bbox(p, 0, 0, p.w, p.h)
  if (!bb) throw new Error(`Contenu vide : ${file}`)
  const img = toSharp(p).extract({ left: bb.x0, top: bb.y0, width: bb.x1 - bb.x0, height: bb.y1 - bb.y0 })
    .png({ compressionLevel: 9 })
  const info = await img.toFile(file)
  console.log(`✓ ${file.replace('/home/z/my-project/', '')} — ${info.width}×${info.height}`)
  return { w: info.width, h: info.height }
}

(async () => {
  const p = await loadDematted()

  // ── Bandes de contenu (lignes vides = séparateurs) ──────────────
  const rows: number[] = []
  for (let y = 0; y < p.h; y++) {
    let c = 0
    for (let x = 0; x < p.w; x += 2) if (p.data[(y * p.w + x) * 4 + 3] > 12) c++
    rows.push(c)
  }
  const bands: { y0: number; y1: number }[] = []
  let start = -1
  for (let y = 0; y <= p.h; y++) {
    const filled = y < p.h && rows[y] >= 3
    if (filled && start < 0) start = y
    if (!filled && start >= 0) { bands.push({ y0: start, y1: y }); start = -1 }
  }
  const big = bands.filter((b) => b.y1 - b.y0 > 18)
  console.log('Bandes détectées :', big.map((b) => `${b.y0}-${b.y1}`).join('  '))
  if (big.length < 2) throw new Error('Bandes inattendues')

  const b1 = big[0] // emblème + mot-symbole + .info
  const b2 = big[1] // slogan + filet tricolore
  // (les icônes sociales = bande 3, volontairement exclues)

  // ── Verrouillage graphique (lockup) ─────────────────────────────
  const cropBand = (band: { y0: number; y1: number }, from: Px): Px => {
    const h = band.y1 - band.y0
    const data = new Uint8ClampedArray(p.w * h * 4)
    data.set(from.data.subarray(band.y0 * p.w * 4, band.y1 * p.w * 4))
    return { data, w: p.w, h, ch: 4 }
  }
  const lockup = cropBand(b1, p)
  const lockupDark = navyToWhite(lockup)
  const full = cropBand({ y0: b1.y0, y1: b2.y1 }, p)

  const dimLockup = await save(lockup, `${PUB}/logo-lockup.png`)
  await save(lockupDark, `${PUB}/logo-lockup-dark.png`)
  await save(full, `${PUB}/logo-full.png`)

  // ── Carte de la Guinée (blob vert à droite de la carte) ─────────
  // zone haute, à gauche du badge .info ; vert : g dominant
  const zone = { x0: 0, y0: b1.y0, x1: Math.floor(p.w * 0.55), y1: b1.y0 + Math.floor((b1.y1 - b1.y0) * 0.62) }
  let gb: { x0: number; y0: number; x1: number; y1: number } | null = null
  {
    let minX = zone.x1, minY = zone.y1, maxX = zone.x0, maxY = zone.y0
    for (let y = zone.y0; y < zone.y1; y++) {
      for (let x = zone.x0; x < zone.x1; x++) {
        const i = (y * p.w + x) * 4
        const r = p.data[i], g = p.data[i + 1], b = p.data[i + 2], a = p.data[i + 3]
        if (a > 200 && g > 110 && g > r + 35 && g > b + 35) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
      }
    }
    if (maxX > minX) gb = { x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 }
  }
  if (!gb) throw new Error('Carte introuvable')
  console.log('Blob vert (partie verte de la carte) :', JSON.stringify(gb))
  // la carte complète : rouge à gauche du vert, débordement haut (savanes) et bas
  const mapZone = {
    x0: Math.max(0, gb.x0 - Math.floor((gb.x1 - gb.x0) * 1.35)), x1: Math.min(p.w, gb.x1 + Math.floor((gb.x1 - gb.x0) * 0.12)),
    y0: Math.max(0, gb.y0 - Math.floor((gb.y1 - gb.y0) * 0.28)), y1: Math.min(b1.y1, gb.y1 + Math.floor((gb.y1 - gb.y0) * 0.10)),
  }
  const mapCrop = await toSharp(p)
    .extract({ left: mapZone.x0, top: mapZone.y0, width: mapZone.x1 - mapZone.x0, height: mapZone.y1 - mapZone.y0 })
    .png().toBuffer()
  const mapMeta = await sharp(mapCrop).metadata()
  await sharp(mapCrop).png({ compressionLevel: 9 }).toFile(`${PUB}/logo-map.png`)
  console.log(`✓ public/brand/logo-map.png — ${mapMeta.width}×${mapMeta.height}`)

  // ── Icônes (carte sur fond blanc) ───────────────────────────────
  const iconBase = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite([
    { input: await sharp(mapCrop).resize(432, 432, { fit: 'inside' }).png().toBuffer(), top: 40, left: 40 },
  ]).png().toBuffer()
  await sharp(iconBase).toFile(`${PUB}/icon-512.png`)
  await sharp(iconBase).resize(192, 192).png().toFile(`${PUB}/icon-192.png`)
  await sharp(iconBase).resize(256, 256).png().toFile(`${APP}/icon.png`)
  await sharp(iconBase).resize(180, 180).png().toFile(`${APP}/apple-icon.png`)
  console.log('✓ icônes 512 / 192 / app icon / apple icon')

  // ── Bannière Open Graph 1200×630 ────────────────────────────────
  const lockupPng = await toSharp(lockup).png().toBuffer()
  const og = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 12, g: 21, b: 38, alpha: 1 } },
  })
    .composite([
      // filet tricolore haut
      { input: Buffer.from(`<svg width="1200" height="10"><rect width="400" height="10" fill="#D21034"/><rect x="400" width="400" height="10" fill="#FCD116"/><rect x="800" width="400" height="10" fill="#009460"/></svg>`), top: 0, left: 0 },
      { input: await sharp(lockupPng).resize(660, null, { fit: 'inside' }).png().toBuffer(), top: 150, left: 270 },
      { input: Buffer.from(`<svg width="1200" height="80"><text x="600" y="52" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-size="40" font-style="italic" font-weight="bold" fill="#FCD116">L'information au-delà du factuel</text></svg>`), top: 500, left: 0 },
    ])
    .jpeg({ quality: 88 }).toFile(`${PUB}/og.jpg`)
  console.log(`✓ public/brand/og.jpg — ${og.width}×${og.height}`)
})().catch((e) => { console.error(e); process.exit(1) })
