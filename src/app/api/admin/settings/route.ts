// GET/PUT /api/admin/settings — paramètres du site + pages éditables (§7.10)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, serverError, logAction, getSettings, getStorageConfig, SETTING_KEYS, TOGGLE_KEYS } from '@/lib/server/helpers'
import { safeHttpUrl, safeMediaUrl } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

/** Clés de configuration du stockage externe (Cloudinary / Google Drive) — acceptées par le PUT, jamais renvoyées en clair par le GET. */
const STORAGE_SETTING_KEYS = [
  'storageCloudName', 'storageCloudApiKey', 'storageCloudApiSecret',
  'storageDriveFolderId', 'storageDriveClientEmail', 'storageDrivePrivateKey',
] as const

/** Sentinelle renvoyée par le GET pour un secret déjà configuré. */
const STORAGE_MASK = '••••••••'

const maskSecret = (v: string) => (v ? STORAGE_MASK : '')

/** Validation par clé : URLs http(s) uniquement (bloque javascript:, data:…). */
function cleanSettingValue(key: string, raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  switch (key) {
    case 'tvYoutubeUrl':
    case 'tvFacebookUrl':
      // vide autorisé (fonctionnalité désactivée) sinon URL absolue http(s)
      return s ? safeHttpUrl(s) : ''
    case 'logoUrl':
    case 'seoImage':
      return s ? safeMediaUrl(s) : ''
    case 'analyticsId':
      // identifiants de mesure : G-XXXX, UA-XXXX, sans injection possible
      return /^[A-Za-z0-9_-]{1,30}$/.test(s) ? s : ''
    default:
      return s.slice(0, 500)
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    // Les paramètres (identifiants de stockage inclus) ne concernent que l'ADMIN
    if (!hasMinRole(user.role, 'ADMIN')) return forbidden('Les paramètres du site sont réservés aux administrateurs.')

    const [settings, pages, storage] = await Promise.all([
      getSettings(),
      db.editablePage.findMany({ orderBy: { key: 'asc' } }),
      getStorageConfig(),
    ])

    return NextResponse.json({
      settings,
      pages,
      storage: {
        storageCloudName: storage.cloudName,
        storageCloudApiKey: storage.cloudApiKey,
        storageCloudApiSecret: maskSecret(storage.cloudApiSecret),
        storageDriveFolderId: storage.driveFolderId,
        storageDriveClientEmail: storage.driveClientEmail,
        storageDrivePrivateKey: maskSecret(storage.drivePrivateKey),
      },
    })
  } catch (e) {
    return serverError(e)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    // Écrire les paramètres (dont les secrets Cloudinary/Drive) : ADMIN uniquement
    if (!hasMinRole(user.role, 'ADMIN')) return forbidden('Les paramètres du site sont réservés aux administrateurs.')

    const body = await req.json().catch(() => ({}))
    const updates: string[] = []

    const allKeys: readonly string[] = [...SETTING_KEYS, ...STORAGE_SETTING_KEYS]
    for (const key of allKeys) {
      if (body?.[key] === undefined) continue
      // Ne jamais stocker la sentinelle masquée : une valeur « •••••••• » non modifiée
      // par l'admin ne doit pas écraser le secret existant en base.
      if ((STORAGE_SETTING_KEYS as readonly string[]).includes(key) && body[key] === STORAGE_MASK) continue
      const value = TOGGLE_KEYS.has(key)
        ? (body[key] === 'on' || body[key] === true ? 'on' : 'off')
        : (STORAGE_SETTING_KEYS as readonly string[]).includes(key)
          ? String(body[key] ?? '').slice(0, 8000)
          : cleanSettingValue(key, body[key])
      await db.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
      updates.push(key)
    }

    if (updates.length) {
      await logAction(user, 'UPDATE', 'SiteSetting', null, `Paramètres modifiés : ${updates.join(', ')}`)
    }

    const settings = await getSettings()
    return NextResponse.json({ settings })
  } catch (e) {
    return serverError(e)
  }
}
