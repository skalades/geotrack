import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { assignPointSchema } from '@/lib/validations'

export const POST = withAuth(async (req, { params, user }) => {
  const { code } = params
  const body = await req.json()
  const parsed = assignPointSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  const { surveyorId, scheduledDate } = parsed.data
  const point = await prisma.targetPoint.findUnique({ where: { pointCode: code } })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })
  const surveyor = await prisma.user.findUnique({ where: { id: surveyorId } })
  if (!surveyor || surveyor.role !== 'surveyor') return NextResponse.json({ success: false, error: 'Surveyor tidak valid' }, { status: 400 })
  const measurement = await prisma.measurement.upsert({
    where: { pointCode: code },
    update: { surveyorId, status: 'progress', scheduledDate, assignedAt: new Date() },
    create: { pointCode: code, surveyorId, status: 'progress', scheduledDate, assignedAt: new Date() }
  })
  // Notify surveyor
  await prisma.notification.create({
    data: { userId: surveyorId, type: 'assigned', message: `Anda mendapat tugas baru: ${code}${scheduledDate ? ' — Jadwal: ' + scheduledDate : ''}`, pointCode: code }
  })
  await prisma.activityLog.create({
    data: { userId: user.userId, action: 'assign_point', entityType: 'measurement', entityId: measurement.id, newValue: JSON.stringify({ surveyorId, scheduledDate }) }
  })
  return NextResponse.json({ success: true, data: measurement })
}, ['super_admin'])
