import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import proj4 from 'proj4'

/**
 * POST /api/measurements/gcp-direct
 *
 * PM dapat menginput koordinat final GCP/ICP yang sudah diolah (post-processing)
 * langsung ke status "approved" tanpa melalui alur surveyor.
 *
 * Wajib   : pointCode, observationDate, koordinat UTM final
 * Opsional : foto 4 arah, rinexFileUrl, kondisi, cuaca, receiver, catatan, akurasi,
 *            antennaHeight, startTime, endTime
 */
export const POST = withAuth(async (req, context) => {
  try {
    const { user } = context
    const body = await req.json()

    const {
      pointCode,
      observationDate,
      conditionSekitar,
      weather,
      receiverType,
      fieldNotes,
      finalUtmX,
      finalUtmY,
      finalElevation,
      finalUtmZone,
      horizontalAccuracy,
      verticalAccuracy,
      antennaHeight,
      startTime,
      endTime,
      photoNorthUrl,
      photoSouthUrl,
      photoEastUrl,
      photoWestUrl,
      rinexFileUrl,
    } = body

    // -- Validasi field wajib --
    if (!pointCode) {
      return NextResponse.json({ success: false, error: 'Kode titik wajib diisi' }, { status: 400 })
    }
    if (!observationDate) {
      return NextResponse.json({ success: false, error: 'Tanggal pengamatan wajib diisi' }, { status: 400 })
    }
    if (!finalUtmX || !finalUtmY || !finalUtmZone) {
      return NextResponse.json({ success: false, error: 'Koordinat UTM (X, Y, Zone) wajib diisi' }, { status: 400 })
    }

    // -- Cek titik ada & tipe GCP/ICP --
    const targetPoint = await prisma.targetPoint.findUnique({ where: { pointCode } })
    if (!targetPoint) {
      return NextResponse.json(
        { success: false, error: 'Titik ' + pointCode + ' tidak ditemukan di master data' },
        { status: 404 }
      )
    }
    if (targetPoint.pointType !== 'GCP' && targetPoint.pointType !== 'ICP') {
      return NextResponse.json(
        { success: false, error: 'Titik ' + pointCode + ' bukan tipe GCP/ICP (tipe: ' + targetPoint.pointType + ')' },
        { status: 400 }
      )
    }

    // -- Cek apakah sudah approved --
    const existing = await prisma.measurement.findUnique({ where: { pointCode } })
    if (existing && existing.status === 'approved') {
      return NextResponse.json(
        { success: false, error: 'Data ' + pointCode + ' sudah berstatus Approved' },
        { status: 409 }
      )
    }

    // -- Konversi UTM -> Lat/Lng --
    const isSouth = finalUtmZone.toUpperCase().endsWith('S')
    const zoneNum = parseInt(finalUtmZone)
    if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 60) {
      return NextResponse.json(
        { success: false, error: 'Nomor zona UTM tidak valid (harus 1-60)' },
        { status: 400 }
      )
    }
    const projStr = '+proj=utm +zone=' + zoneNum + (isSouth ? ' +south' : '') + ' +datum=WGS84 +units=m +no_defs'

    let finalLng: number | null = null
    let finalLat: number | null = null
    try {
      const [lng, lat] = proj4(projStr, 'WGS84', [parseFloat(finalUtmX), parseFloat(finalUtmY)])
      finalLng = lng
      finalLat = lat
    } catch {
      return NextResponse.json(
        { success: false, error: 'Format Zona UTM tidak valid, konversi koordinat gagal' },
        { status: 400 }
      )
    }

    // -- Payload measurement --
    const measurementData = {
      status: 'approved' as const,
      observationDate,
      conditionSekitar: conditionSekitar ?? null,
      weather: weather ?? null,
      receiverType: receiverType ?? null,
      fieldNotes: fieldNotes ?? null,
      antennaHeight: antennaHeight ? parseFloat(antennaHeight) : null,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      finalUtmX: parseFloat(finalUtmX),
      finalUtmY: parseFloat(finalUtmY),
      finalElevation: finalElevation ? parseFloat(finalElevation) : null,
      finalUtmZone: finalUtmZone.toUpperCase(),
      finalLat,
      finalLng,
      horizontalAccuracy:
        horizontalAccuracy !== undefined && horizontalAccuracy !== ''
          ? parseFloat(horizontalAccuracy)
          : null,
      verticalAccuracy:
        verticalAccuracy !== undefined && verticalAccuracy !== ''
          ? parseFloat(verticalAccuracy)
          : null,
      // Foto opsional
      photoNorthUrl: photoNorthUrl ?? null,
      photoSouthUrl: photoSouthUrl ?? null,
      photoEastUrl: photoEastUrl ?? null,
      photoWestUrl: photoWestUrl ?? null,
      rinexFileUrl: rinexFileUrl ?? null,
    }

    let result
    if (existing) {
      result = await prisma.measurement.update({
        where: { pointCode },
        data: measurementData,
      })
    } else {
      result = await prisma.measurement.create({
        data: {
          pointCode,
          surveyorId: user.userId,
          assignedAt: new Date(),
          ...measurementData,
        },
      })
    }

    // -- Activity log --
    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: 'gcp_direct_input',
        entityType: 'measurement',
        entityId: result.id,
        newValue: JSON.stringify({ status: 'approved', observationDate, pointCode }),
        notes: targetPoint.pointType + ' ' + pointCode + ' diinput langsung oleh PM (koordinat final, tanpa alur surveyor)',
      },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    console.error('[gcp-direct] error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}, ['super_admin'])