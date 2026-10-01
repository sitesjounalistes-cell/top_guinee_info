// GET /api/public/search — alias du listing public (contrat worklog)
import { NextResponse } from 'next/server'
import { listPublicArticles } from '@/lib/server/public-articles'
import { langOf, translateCards } from '@/lib/server/translate'
import { serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    const data = await listPublicArticles(sp)
    await translateCards(data.items, langOf(req.url))
    return NextResponse.json(data)
  } catch (e) {
    return serverError(e)
  }
}
