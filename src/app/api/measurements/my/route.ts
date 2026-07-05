// src/app/api/measurements/my/route.ts — Get measurements for logged-in surveyor

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { measurementFilterSchema } from '@/lib/validations'

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url)
  const filters = measurementFilterSchema.parse(Object.fromEntries(searchParams))

  const where: any = { surveyorId: user.userId }
  if (filters.status) where.status = filters.status
  if (filters.search) where.pointCode = { contains: filters.search }

  const [data, total] = await Promise.all([
    prisma.measurement.findMany({
      where,
      include: {
        surveyor: { select: { id: true, name: true, email: true } },
        targetPoint: true,
        retakeHistories: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.measurement.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  })
}, ['super_admin', 'surveyor'])
