// GET /api/public/media/audio/[fileId] — proxy de streaming Google Drive (§6.3)
// L'audio n'est jamais stocké sur le site : à chaque écoute, le serveur
// demande le flux à Google Drive et le relaie (avec support de Range).
// Anti-abus : limite de débit par IP — un flood de requêtes ne peut plus
// épuiser le quota du compte de service ni la bande passante sortante.
import { NextResponse } from 'next/server'
import { getDriveFileStream } from '@/lib/server/storage'
import { rateLimit, clientIp } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  try {
    if (!rateLimit(`audio:${clientIp(req)}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Trop de requêtes audio à la suite.' }, { status: 429 })
    }

    const { fileId } = await ctx.params
    const stream = await getDriveFileStream(fileId, req.headers.get('range'))

    if (!stream) {
      return NextResponse.json(
        { error: 'Audio indisponible (Google Drive non configuré ou fichier introuvable)' },
        { status: 404 },
      )
    }

    const headers = new Headers({
      'Content-Type': stream.contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    })
    if (stream.contentLength) headers.set('Content-Length', stream.contentLength)
    if (stream.contentRange) headers.set('Content-Range', stream.contentRange)

    return new NextResponse(stream.body, { status: stream.status, headers })
  } catch (e) {
    console.error('[public/media/audio]', e)
    return NextResponse.json({ error: 'Erreur lors du streaming audio' }, { status: 500 })
  }
}
