import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { createTargetPointSchema } from '@/lib/validations'

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url)
  const pointType = searchParams.get('pointType') ?? undefined
  const points = await prisma.targetPoint.findMany({
    where: pointType ? { pointType: pointType as any } : undefined,
    include: {
      measurement: {
        select: { status: true, surveyorId: true, surveyor: { select: { name: true } }, scheduledDate: true, updatedAt: true }
      }
    },
    orderBy: { pointCode: 'asc' }
  })
  return NextResponse.json({ success: true, data: points })
})

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const parsed = createTargetPointSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  const existing = await prisma.targetPoint.findUnique({ where: { pointCode: parsed.data.pointCode } })
  if (existing) return NextResponse.json({ success: false, error: 'Kode titik sudah ada' }, { status: 409 })
  const point = await prisma.targetPoint.create({ data: parsed.data })
  return NextResponse.json({ success: true, data: point }, { status: 201 })
}, ['super_admin'])
