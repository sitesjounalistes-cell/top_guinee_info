// GET /api/admin/messages?q=&status=all|unread|read|archived — messagerie (§7.3)
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUser, hasMinRole } from '@/lib/auth'
import { unauth, forbidden, serverError } from '@/lib/server/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return unauth()
    if (!hasMinRole(user.role, 'CHIEF_EDITOR')) return forbidden('La gestion de ce contenu est réservée aux responsables de rédaction.')

    const sp = new URL(req.url).searchParams
    const status = sp.get('status') || 'all'
    const q = (sp.get('q') || '').trim()

    const where: Prisma.ContactMessageWhereInput = {}
    if (status === 'unread') {
      where.isRead = false
      where.isArchived = false
    } else if (status === 'read') {
      where.isRead = true
      where.isArchived = false
    } else if (status === 'archived') {
      where.isArchived = true
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ]
    }

    const messages = await db.contactMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: 200,
    })
    return NextResponse.json({ messages })
  } catch (e) {
    return serverError(e)
  }
}
