import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const GET = withAuth(async (req, { user }) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  const unreadCount = await prisma.notification.count({ where: { userId: user.userId, isRead: false } })
  return NextResponse.json({ success: true, data: notifications, unreadCount })
})
