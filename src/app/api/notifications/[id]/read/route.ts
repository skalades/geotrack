import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const PATCH = withAuth(async (req, { params, user }) => {
  const id = parseInt(params.id)
  const notif = await prisma.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== user.userId) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  await prisma.notification.update({ where: { id }, data: { isRead: true } })
  return NextResponse.json({ success: true })
})
