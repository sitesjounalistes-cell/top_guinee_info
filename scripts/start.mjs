// Démarrage production portable (Windows/Linux, node ou bun).
// Le dossier standalone de Next préserve le chemin depuis la racine du
// disque (ex. .next/standalone/Downloads/topguinee-projet/server.js) :
// ce script le localise, resynchronise le .env, résout un éventuel chemin
// SQLite relatif, complète les dossiers statiques, puis lance le serveur.
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standaloneDir = path.join(root, '.next', 'standalone')

function findServerDir(dir) {
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return null }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const p = path.join(dir, e.name)
    if (fs.existsSync(path.join(p, 'server.js'))) return p
    const found = findServerDir(p)
    if (found) return found
  }
  return null
}

const target =
  fs.existsSync(path.join(standaloneDir, 'server.js'))
    ? standaloneDir
    : findServerDir(standaloneDir)

if (!target) {
  console.error('✖ Serveur standalone introuvable — lancez d\'abord : bun run build')
  process.exit(1)
}

// Complète les assets statiques (le build ne les copie pas dans standalone)
for (const [from, to] of [
  [path.join(root, '.next', 'static'), path.join(target, '.next', 'static')],
  [path.join(root, 'public'), path.join(target, 'public')],
]) {
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.cpSync(from, to, { recursive: true })
  }
}

// Les médias uploadés en mode standalone atterrissent dans public/uploads DU
// STANDALONE — dossier écrasé à chaque rebuild : on les rapatrie vers le
// public/ du projet AVANT toute copie, puis on resynchronise les uploads
// (toujours, pas seulement à la première création).
const uploadsFrom = path.join(target, 'public', 'uploads')
const uploadsRoot = path.join(root, 'public', 'uploads')
if (fs.existsSync(uploadsFrom)) {
  fs.cpSync(uploadsFrom, uploadsRoot, { recursive: true })
}
if (fs.existsSync(uploadsRoot)) {
  fs.cpSync(uploadsRoot, uploadsFrom, { recursive: true })
}

console.log(`▶ Serveur Topguinee.info (${path.relative(root, target)})`)

// Le serveur standalone charge son propre .env : on le resynchronise sur
// celui de la racine à chaque démarrage (le build ne le met jamais à jour).
const rootEnv = path.join(root, '.env')
const targetEnv = path.join(target, '.env')
if (fs.existsSync(rootEnv)) {
  fs.copyFileSync(rootEnv, targetEnv)
}

// Charge les variables du .env dans ce processus (le serveur Next les
// relira de son côté — redondance inoffensive) et lit la valeur EFFECTIVE
// de la base : c'est elle, et non un fallback par défaut, qui décide d'une
// éventuelle conversion de chemin.
if (fs.existsSync(targetEnv)) {
  for (const line of fs.readFileSync(targetEnv, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

// SQLite uniquement (dev/repli) : Prisma résout les chemins relatifs par
// rapport à prisma/schema.prisma — on les passe en absolus pour le
// standalone. PostgreSQL (production) est utilisé tel quel.
const dbUrl = process.env.DATABASE_URL || ''
if (dbUrl.startsWith('file:')) {
  const rel = dbUrl.slice(5)
  if (!path.isAbsolute(rel)) {
    const abs = `file:${path.resolve(root, 'prisma', rel).replace(/\\/g, '/')}`
    process.env.DATABASE_URL = abs
    if (fs.existsSync(targetEnv)) {
      const fixed = fs.readFileSync(targetEnv, 'utf8')
        .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${abs}`)
      fs.writeFileSync(targetEnv, fixed)
    }
    console.log(`▪ Base SQLite : ${abs}`)
  }
}

process.chdir(target)
await import(pathToFileURL(path.join(target, 'server.js')).href)
