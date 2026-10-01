// GET /api/public/page/[key] — pages éditables (about, legal, privacy)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notFound, serverError } from '@/lib/server/helpers'
import { langOf, translateText, translateHtml } from '@/lib/server/translate'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = ['about', 'legal', 'privacy']

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const lang = langOf(req.url)
    const { key } = await params
    if (!ALLOWED_KEYS.includes(key)) {
      return notFound('Page introuvable')
    }
    const page = await db.editablePage.findUnique({ where: { key } })
    if (!page) return notFound('Page introuvable')
    const out = {
      key: page.key,
      title: page.title,
      content: page.content,
      updatedAt: page.updatedAt.toISOString(),
    }
    if (lang !== 'fr') {
      await Promise.all([
        (async () => { out.title = await translateText(out.title, lang) })(),
        (async () => { out.content = await translateHtml(out.content, lang) })(),
      ])
    }
    return NextResponse.json({ page: out })
  } catch (e) {
    return serverError(e)
  }
}
