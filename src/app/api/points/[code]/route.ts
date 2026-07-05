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

// PUT: edit titik (hanya jika unassigned)
export const PUT = withAuth(async (req, { params }) => {
  const { code } = params
  const body = await req.json()
  const point = await prisma.targetPoint.findUnique({
    where: { pointCode: code },
    include: { measurement: { select: { status: true } } }
  })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })
  // Boleh edit jika: belum punya measurement atau status unassigned
  if (point.measurement && point.measurement.status !== 'unassigned') {
    return NextResponse.json({ success: false, error: 'Titik tidak dapat diedit karena sudah dalam proses pengukuran' }, { status: 400 })
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
}, ['super_admin'])

// DELETE: hapus titik (hanya jika unassigned)
export const DELETE = withAuth(async (req, { params }) => {
  const { code } = params
  const point = await prisma.targetPoint.findUnique({
    where: { pointCode: code },
    include: { measurement: { select: { status: true } } }
  })
  if (!point) return NextResponse.json({ success: false, error: 'Titik tidak ditemukan' }, { status: 404 })
  if (point.measurement && point.measurement.status !== 'unassigned') {
    return NextResponse.json({ success: false, error: 'Titik tidak dapat dihapus karena sudah dalam proses pengukuran' }, { status: 400 })
  }
  // Hapus measurement unassigned jika ada, lalu hapus point
  if (point.measurement) {
    await prisma.measurement.deleteMany({ where: { pointCode: code } })
  }
  await prisma.targetPoint.delete({ where: { pointCode: code } })
  return NextResponse.json({ success: true, message: 'Titik berhasil dihapus' })
}, ['super_admin'])
