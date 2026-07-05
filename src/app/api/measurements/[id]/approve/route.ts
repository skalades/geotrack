import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const POST = withAuth(async (req, context) => {
  try {
    const { params, user } = context
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
  const { pmNotes } = await req.json().catch(() => ({}))
  const measurement = await prisma.measurement.findUnique({ where: { id }, include: { surveyor: true } })
  if (!measurement) return NextResponse.json({ success: false, error: 'Pengukuran tidak ditemukan' }, { status: 404 })
  if (measurement.status !== 'review') return NextResponse.json({ success: false, error: 'Status harus Under Review untuk diapprove' }, { status: 400 })
  const updated = await prisma.measurement.update({ where: { id }, data: { status: 'approved', pmNotes: pmNotes ?? null } })
  // Notify surveyor
  await prisma.notification.create({ data: { userId: measurement.surveyorId, type: 'approved', message: `${measurement.pointCode} telah DISETUJUI oleh Project Manager`, pointCode: measurement.pointCode } })
  await prisma.activityLog.create({ data: { userId: user.userId, action: 'approved', entityType: 'measurement', entityId: id, oldValue: JSON.stringify({ status: 'review' }), newValue: JSON.stringify({ status: 'approved' }), notes: pmNotes } })
  return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 })
  }
}, ['super_admin'])
