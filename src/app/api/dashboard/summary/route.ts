import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const GET = withAuth(async (req, { user }) => {
  const where = user.role === 'surveyor' ? { surveyorId: String(user.userId) } : {}
  const [total, unassigned, progress, review, approved, retake] = await Promise.all([
    prisma.targetPoint.count(),
    prisma.measurement.count({ where: { ...(where as any), status: 'unassigned' } }),
    prisma.measurement.count({ where: { ...(where as any), status: 'progress' } }),
    prisma.measurement.count({ where: { ...(where as any), status: 'review' } }),
    prisma.measurement.count({ where: { ...(where as any), status: 'approved' } }),
    prisma.measurement.count({ where: { ...(where as any), status: 'retake' } }),
  ])
  const progressPercent = total > 0 ? Math.round((approved / total) * 100) : 0
  // Per surveyor stats (PM only)
  let surveyorStats: any[] = []
  if (user.role === 'super_admin') {
    const surveyors = await prisma.user.findMany({ where: { role: 'surveyor', isActive: true } })
    surveyorStats = await Promise.all(surveyors.map(async s => {
      const [sTotal, sApproved, sRetake, sProgress] = await Promise.all([
        prisma.measurement.count({ where: { surveyorId: s.id } }),
        prisma.measurement.count({ where: { surveyorId: s.id, status: 'approved' } }),
        prisma.measurement.count({ where: { surveyorId: s.id, status: 'retake' } }),
        prisma.measurement.count({ where: { surveyorId: s.id, status: 'progress' } }),
      ])
      return { surveyorId: s.id, surveyorName: s.name, total: sTotal, approved: sApproved, retake: sRetake, progress: sProgress }
    }))
  }
  return NextResponse.json({ success: true, data: { total, unassigned, progress, review, approved, retake, progressPercent, surveyorStats } })
})
