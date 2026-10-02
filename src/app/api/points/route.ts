import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { createTargetPointSchema } from '@/lib/validations'

export const GET = withAuth(async (req, { user }) => {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
})

export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json()
    const parsed = createTargetPointSchema.safeParse(body)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const firstField = Object.values(flat.fieldErrors).flat()[0]
      const message = firstField ?? flat.formErrors[0] ?? 'Validasi gagal'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    const existing = await prisma.targetPoint.findUnique({ where: { pointCode: parsed.data.pointCode } })
    if (existing) return NextResponse.json({ success: false, error: 'Kode titik sudah ada' }, { status: 409 })
    const point = await prisma.targetPoint.create({ data: parsed.data })
    return NextResponse.json({ success: true, data: point }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}, ['super_admin'])
