/* Rotation des mots de passe de la rédaction (PostgreSQL/Neon).
 * Génère des mots de passe forts, les hash en scrypt (même schéma que
 * src/lib/auth.ts), met à jour les comptes et trace l'action dans le
 * journal d'activité. Usage : bun scripts/rotate-passwords.ts
 */
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${key}`
}

// Jeu de caractères sans ambiguïtés (0/O, 1/l/I exclus)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
function strongPassword(length = 18): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

async function main() {
  const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } })
  if (!users.length) throw new Error('Aucun utilisateur en base.')

  console.log('Rotation des mots de passe :\n')
  for (const u of users) {
    const password = strongPassword()
    await db.user.update({
      where: { id: u.id },
      data: { passwordHash: hashPassword(password) },
    })
    await db.activityLog.create({
      data: {
        userId: u.id,
        userLabel: u.name,
        action: 'UPDATE',
        entity: 'User',
        entityId: u.id,
        detail: 'Rotation du mot de passe (script de sécurisation)',
      },
    })
    console.log(`  ${u.email.padEnd(32)} ${password}`)
  }
  console.log('\n⚠ Conservez ces identifiants maintenant — ils ne seront plus affichés.')
}

main()
  .catch((e) => { console.error('✖ Échec :', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
