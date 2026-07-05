import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const POST = withAuth(async (req, context) => {
  try {
    const { params, user } = context
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    const body = await req.json().catch(() => ({}))
    
    const measurement = await prisma.measurement.findUnique({ where: { id }, include: { surveyor: true } })
    if (!measurement) return NextResponse.json({ success: false, error: 'Pengukuran tidak ditemukan' }, { status: 404 })
    if (measurement.surveyorId !== user.userId && user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Tidak punya akses' }, { status: 403 })
    }

    const updatedData = {
      photoNorthUrl: body.photoNorthUrl || measurement.photoNorthUrl,
      photoSouthUrl: body.photoSouthUrl || measurement.photoSouthUrl,
      photoEastUrl: body.photoEastUrl || measurement.photoEastUrl,
      photoWestUrl: body.photoWestUrl || measurement.photoWestUrl,
      rinexFileUrl: body.rinexFileUrl || measurement.rinexFileUrl,
      status: 'review'
    }

    const hasAllPhotos = updatedData.photoNorthUrl && updatedData.photoSouthUrl && updatedData.photoEastUrl && updatedData.photoWestUrl
    const hasRinex = updatedData.rinexFileUrl
    
    if (!hasAllPhotos || !hasRinex) {
      return NextResponse.json({ success: false, error: 'Lengkapi semua foto dan file RINEX sebelum submit' }, { status: 400 })
    }
    
    const updated = await prisma.measurement.update({ where: { id }, data: updatedData })
    
    const pms = await prisma.user.findMany({ where: { role: 'super_admin', isActive: true } })
    await Promise.all(pms.map(pm =>
      prisma.notification.create({ data: { userId: pm.id, type: 'submitted', message: `${measurement.pointCode} menunggu validasi Anda. Submit oleh: ${measurement.surveyor.name}`, pointCode: measurement.pointCode } })
    ))
    
    await prisma.activityLog.create({ data: { userId: user.userId, action: 'submitted', entityType: 'measurement', entityId: id } })
    
    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, stack: e.stack }, { status: 500 })
  }
}, ['super_admin', 'surveyor'])
