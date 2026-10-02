import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { retakeSchema } from '@/lib/validations'

export const POST = withAuth(async (req, context) => {
  try {
    const { params, user } = context
    const id = parseInt(String(params.id))
  const body = await req.json()
  const parsed = retakeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  const measurement = await prisma.measurement.findUnique({ where: { id } })
  if (!measurement) return NextResponse.json({ success: false, error: 'Pengukuran tidak ditemukan' }, { status: 404 })
  if (measurement.status !== 'review') return NextResponse.json({ success: false, error: 'Status harus Under Review untuk retake' }, { status: 400 })
  if (measurement.retakeCount >= 3) return NextResponse.json({ success: false, error: 'Batas maksimal retake (3x) telah tercapai' }, { status: 400 })
  // Save retake history
  await prisma.retakeHistory.create({
    data: { measurementId: id, retakeNumber: measurement.retakeCount + 1, reason: parsed.data.reason, pmId: user.userId, oldPhotoNorthUrl: measurement.photoNorthUrl, oldPhotoSouthUrl: measurement.photoSouthUrl, oldPhotoEastUrl: measurement.photoEastUrl, oldPhotoWestUrl: measurement.photoWestUrl, oldRinexFileUrl: measurement.rinexFileUrl }
  })
  const updated = await prisma.measurement.update({
    where: { id },
    data: { status: 'retake', retakeCount: { increment: 1 }, pmNotes: parsed.data.reason, photoNorthUrl: null, photoSouthUrl: null, photoEastUrl: null, photoWestUrl: null, rinexFileUrl: null }
  })
  // Notify surveyor
  await prisma.notification.create({ data: { userId: measurement.surveyorId, type: 'retake', message: `${measurement.pointCode} perlu DIULANG. Alasan: ${parsed.data.reason}`, pointCode: measurement.pointCode } })
  await prisma.activityLog.create({ data: { userId: user.userId, action: 'retake', entityType: 'measurement', entityId: id, notes: parsed.data.reason } })
  return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 })
  }
}, ['super_admin'])
