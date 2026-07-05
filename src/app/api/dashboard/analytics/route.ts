import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')
  const clampedDays = Math.min(Math.max(days, 7), 90)

  // Generate date range (last N days)
  const today = new Date()
  const dateRange = Array.from({ length: clampedDays }, (_, i) => {
    const d = subDays(today, clampedDays - 1 - i)
    return format(d, 'yyyy-MM-dd')
  })

  // Get all approved measurements with their updatedAt
  const approvedMeasurements = await prisma.measurement.findMany({
    where: {
      status: 'approved',
      updatedAt: { gte: subDays(today, clampedDays) }
    },
    select: { updatedAt: true, surveyorId: true, surveyor: { select: { name: true } } }
  })

  // Also get retake requests per day
  const retakeHistories = await prisma.retakeHistory.findMany({
    where: { createdAt: { gte: subDays(today, clampedDays) } },
    select: { createdAt: true }
  })

  // Build daily chart data
  const dailyMap: Record<string, { date: string; approved: number; retake: number }> = {}
  for (const d of dateRange) {
    dailyMap[d] = { date: d, approved: 0, retake: 0 }
  }

  for (const m of approvedMeasurements) {
    const key = format(new Date(m.updatedAt), 'yyyy-MM-dd')
    if (dailyMap[key]) dailyMap[key].approved++
  }

  for (const r of retakeHistories) {
    const key = format(new Date(r.createdAt), 'yyyy-MM-dd')
    if (dailyMap[key]) dailyMap[key].retake++
  }

  const dailyData = Object.values(dailyMap)

  // Per-surveyor stats (for bar chart)
  const surveyors = await prisma.user.findMany({
    where: { role: 'surveyor', isActive: true },
    select: { id: true, name: true }
  })

  const surveyorData = await Promise.all(surveyors.map(async (s) => {
    const [total, approved, review, retake, progress] = await Promise.all([
      prisma.measurement.count({ where: { surveyorId: s.id } }),
      prisma.measurement.count({ where: { surveyorId: s.id, status: 'approved' } }),
      prisma.measurement.count({ where: { surveyorId: s.id, status: 'review' } }),
      prisma.measurement.count({ where: { surveyorId: s.id, status: 'retake' } }),
      prisma.measurement.count({ where: { surveyorId: s.id, status: 'progress' } }),
    ])
    const approveRate = total > 0 ? Math.round((approved / total) * 100) : 0
    return { name: s.name, surveyorId: s.id, total, approved, review, retake, progress, approveRate }
  }))

  return NextResponse.json({
    success: true,
    data: {
      daily: dailyData,
      surveyors: surveyorData,
      days: clampedDays,
    }
  })
}, ['super_admin'])
