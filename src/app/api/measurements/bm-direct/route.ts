import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import proj4 from 'proj4'

/**
 * POST /api/measurements/bm-direct
 *
 * Memungkinkan PM (super_admin) untuk menginput data BM existing yang sudah
 * diukur dan diolah langsung ke status "approved" tanpa melalui alur surveyor.
 *
 * Tidak diperlukan  : antennaHeight, startTime, endTime
 * Wajib diisi       : observationDate, koordinat UTM final, foto 4 arah
 * Opsional          : rinexFileUrl, kondisi, cuaca, receiver, catatan, akurasi
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
      photoNorthUrl,
      photoSouthUrl,
      photoEastUrl,
      photoWestUrl,
      rinexFileUrl,
    } = body

    // ── Validasi field wajib ─────────────────────────────────────────────────
    if (!pointCode) {
      return NextResponse.json({ success: false, error: 'Kode titik wajib diisi' }, { status: 400 })
    }
    if (!observationDate) {
      return NextResponse.json({ success: false, error: 'Tanggal pengamatan wajib diisi' }, { status: 400 })
    }
    if (!finalUtmX || !finalUtmY || !finalUtmZone) {
      return NextResponse.json({ success: false, error: 'Koordinat UTM (X, Y, Zone) wajib diisi' }, { status: 400 })
    }
    if (!photoNorthUrl || !photoSouthUrl || !photoEastUrl || !photoWestUrl) {
      return NextResponse.json(
        { success: false, error: 'Foto 4 arah (Utara, Selatan, Timur, Barat) wajib diupload' },
        { status: 400 }
      )
    }

    // ── Cek titik ada & tipe BM ──────────────────────────────────────────────
    const targetPoint = await prisma.targetPoint.findUnique({ where: { pointCode } })
    if (!targetPoint) {
      return NextResponse.json(
        { success: false, error: `Titik ${pointCode} tidak ditemukan di master data` },
        { status: 404 }
      )
    }
    if (targetPoint.pointType !== 'BM') {
      return NextResponse.json(
        { success: false, error: `Titik ${pointCode} bukan tipe BM (tipe: ${targetPoint.pointType})` },
        { status: 400 }
      )
    }

    // ── Cek apakah sudah approved ────────────────────────────────────────────
    const existing = await prisma.measurement.findUnique({ where: { pointCode } })
    if (existing && existing.status === 'approved') {
      return NextResponse.json(
        { success: false, error: `Data BM ${pointCode} sudah berstatus Approved` },
        { status: 409 }
      )
    }

    // ── Konversi UTM → Lat/Lng ───────────────────────────────────────────────
    const isSouth = finalUtmZone.toUpperCase().endsWith('S')
    const zoneNum = parseInt(finalUtmZone)
    if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 60) {
      return NextResponse.json(
        { success: false, error: 'Nomor zona UTM tidak valid (harus 1-60)' },
        { status: 400 }
      )
    }
    const projStr = `+proj=utm +zone=${zoneNum} ${isSouth ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`

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

    // ── Payload measurement ──────────────────────────────────────────────────
    const measurementData = {
      status: 'approved' as const,
      observationDate,
      conditionSekitar: conditionSekitar ?? null,
      weather: weather ?? null,
      receiverType: receiverType ?? null,
      fieldNotes: fieldNotes ?? null,
      // Tinggi alat & waktu tidak diperlukan untuk BM direct input
      antennaHeight: null,
      startTime: null,
      endTime: null,
      // Koordinat final hasil olahan
      finalUtmX: parseFloat(finalUtmX),
      finalUtmY: parseFloat(finalUtmY),
      finalElevation: finalElevation ? parseFloat(finalElevation) : null,
      finalUtmZone: finalUtmZone.toUpperCase(),
      finalLat,
      finalLng,
      // Akurasi (opsional)
      horizontalAccuracy:
        horizontalAccuracy !== undefined && horizontalAccuracy !== ''
          ? parseFloat(horizontalAccuracy)
          : null,
      verticalAccuracy:
        verticalAccuracy !== undefined && verticalAccuracy !== ''
          ? parseFloat(verticalAccuracy)
          : null,
      // Foto wajib 4 arah
      photoNorthUrl,
      photoSouthUrl,
      photoEastUrl,
      photoWestUrl,
      // RINEX opsional
      rinexFileUrl: rinexFileUrl ?? null,
    }

    let result
    if (existing) {
      // Update measurement yang sudah ada (pernah di-assign ke surveyor)
      result = await prisma.measurement.update({
        where: { pointCode },
        data: measurementData,
      })
    } else {
      // Belum ada measurement — buat baru dengan PM sebagai "surveyor" (pencatat)
      result = await prisma.measurement.create({
        data: {
          pointCode,
          surveyorId: user.userId, // PM sebagai pencatat data existing
          assignedAt: new Date(),
          ...measurementData,
        },
      })
    }

    // ── Activity log ─────────────────────────────────────────────────────────
    await prisma.activityLog.create({
      data: {
        userId: user.userId,
        action: 'bm_direct_input',
        entityType: 'measurement',
        entityId: result.id,
        newValue: JSON.stringify({ status: 'approved', observationDate, pointCode }),
        notes: `BM ${pointCode} diinput langsung oleh PM (data existing, tanpa alur surveyor)`,
      },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (e: any) {
    console.error('[bm-direct] error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}, ['super_admin'])
