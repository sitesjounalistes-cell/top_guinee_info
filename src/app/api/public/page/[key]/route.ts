// GET /api/public/page/[key] — pages éditables (about, legal, privacy)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notFound, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = ['about', 'legal', 'privacy']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params
    if (!ALLOWED_KEYS.includes(key)) {
      return notFound('Page introuvable')
    }
    const page = await db.editablePage.findUnique({ where: { key } })
    if (!page) return notFound('Page introuvable')
    return NextResponse.json({
      page: {
        key: page.key,
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
