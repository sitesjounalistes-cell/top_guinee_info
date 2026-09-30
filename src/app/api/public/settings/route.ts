// GET /api/public/settings — paramètres du site + canaux de contact + réseaux sociaux
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSettings } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [settings, contacts, socials] = await Promise.all([
      getSettings(),
      db.contactChannel.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
      db.socialLink.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    ])
    return NextResponse.json({ settings, contacts, socials })
  } catch (e) {
    console.error('[public/settings]', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des paramètres' }, { status: 500 })
  }
}
