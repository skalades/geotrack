import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { measurementFormSchema, measurementFilterSchema } from '@/lib/validations'

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url)
  const filters = measurementFilterSchema.parse(Object.fromEntries(searchParams))
  const where: any = {}
  if (user.role === 'surveyor') where.surveyorId = user.userId
  if (filters.status) where.status = filters.status
  if (filters.surveyorId) where.surveyorId = filters.surveyorId
  if (filters.search) where.pointCode = { contains: filters.search }
  const [data, total] = await Promise.all([
    prisma.measurement.findMany({
      where,
      include: {
        surveyor: { select: { id: true, name: true, email: true } },
        targetPoint: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.measurement.count({ where })
  ])
  return NextResponse.json({ success: true, data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) })
})

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const parsed = measurementFormSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  const existing = await prisma.measurement.findUnique({ where: { pointCode: parsed.data.pointCode } })
  if (!existing) return NextResponse.json({ success: false, error: 'Titik belum di-assign' }, { status: 400 })
  if (existing.surveyorId !== user.userId && user.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Tidak punya akses ke titik ini' }, { status: 403 })
  }
  const updateData: any = { ...parsed.data, status: 'progress' }
  if (updateData.startTime) updateData.startTime = new Date(updateData.startTime)
  if (updateData.endTime) updateData.endTime = new Date(updateData.endTime)

  const updated = await prisma.measurement.update({
    where: { pointCode: parsed.data.pointCode },
    data: updateData
  })
  return NextResponse.json({ success: true, data: updated })
}, ['super_admin', 'surveyor'])
