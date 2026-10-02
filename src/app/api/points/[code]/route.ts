import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

// GET single point
export const GET = withAuth(async (req, { params }) => {
  const { code } = params
  const point = await prisma.targetPoint.findUnique({
    where: { pointCode: code },
    include: {
      measurement: {
        select: {
          status: true, surveyorId: true,
          surveyor: { select: { name: true } },
          scheduledDate: true, updatedAt: true,
          antennaHeight: true, weather: true, conditionSekitar: true,
          photoNorthUrl: true, photoSouthUrl: true, photoEastUrl: true, photoWestUrl: true,
          rinexFileUrl: true, retakeCount: true, pmNotes: true,
          startTime: true, endTime: true,
        }
      }
    }
  })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ success: true, data: point })
})

// PUT: edit titik (PM & super_admin — blokir hanya jika sudah approved)
export const PUT = withAuth(async (req, { params }) => {
  const { code } = params
  const body = await req.json()
  const point = await prisma.targetPoint.findUnique({
    where: { pointCode: code },
    include: { measurement: { select: { status: true } } }
  })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })
  // Blokir hanya jika sudah approved
  if (point.measurement && point.measurement.status === 'approved') {
    return NextResponse.json({ success: false, error: 'Titik tidak dapat diedit karena sudah berstatus Approved' }, { status: 400 })
  }
  const { pointType, targetLat, targetLng } = body
  const updated = await prisma.targetPoint.update({
    where: { pointCode: code },
    data: {
      ...(pointType ? { pointType } : {}),
      ...(targetLat !== undefined ? { targetLat: Number(targetLat) || null } : {}),
      ...(targetLng !== undefined ? { targetLng: Number(targetLng) || null } : {}),
    }
  })
  return NextResponse.json({ success: true, data: updated })
}, ['super_admin', 'pm'])

// DELETE: hapus titik — super_admin dapat hapus status apapun
export const DELETE = withAuth(async (req, { params }) => {
  const { code } = params
  const point = await prisma.targetPoint.findUnique({
    where: { pointCode: code },
    include: { measurement: { select: { id: true, status: true } } }
  })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })

  // Cascade: hapus activity log & measurement terkait (semua status)
  if (point.measurement) {
    await prisma.activityLog.deleteMany({ where: { entityType: 'measurement', entityId: point.measurement.id } })
    await prisma.measurement.deleteMany({ where: { pointCode: code } })
  }

  await prisma.targetPoint.delete({ where: { pointCode: code } })
  return NextResponse.json({ success: true, message: 'Titik berhasil dihapus' })
}, ['super_admin'])
