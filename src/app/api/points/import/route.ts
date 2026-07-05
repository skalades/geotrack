import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExt = ['xlsx', 'xls', 'csv']
    if (!ext || !allowedExt.includes(ext)) {
      return NextResponse.json({ success: false, error: 'Format file harus .xlsx, .xls, atau .csv' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Dynamically import xlsx
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'File kosong atau tidak memiliki data' }, { status: 400 })
    }

    // Normalize column names (case-insensitive)
    const results = { created: 0, skipped: 0, errors: [] as string[] }

    for (const row of rows) {
      // Support berbagai format kolom
      const rawCode = row['point_code'] || row['pointCode'] || row['Kode Titik'] || row['kode_titik'] || row['CODE'] || row['code'] || ''
      const rawType = row['point_type'] || row['pointType'] || row['Tipe'] || row['tipe'] || row['TYPE'] || 'GCP'
      const rawLat = row['target_lat'] || row['targetLat'] || row['Latitude'] || row['lat'] || row['LAT'] || null
      const rawLng = row['target_lng'] || row['targetLng'] || row['Longitude'] || row['lng'] || row['LNG'] || null

      const pointCode = String(rawCode).trim().toUpperCase()
      if (!pointCode) { results.skipped++; continue }

      const pointType = String(rawType).trim().toUpperCase()
      if (!['GCP', 'ICP'].includes(pointType)) {
        results.errors.push(`${pointCode}: Tipe '${rawType}' tidak valid (harus GCP atau ICP)`)
        continue
      }

      const targetLat = rawLat !== null && rawLat !== '' ? parseFloat(rawLat) : null
      const targetLng = rawLng !== null && rawLng !== '' ? parseFloat(rawLng) : null

      try {
        const existing = await prisma.targetPoint.findUnique({ where: { pointCode } })
        if (existing) { results.skipped++; continue }
        await prisma.targetPoint.create({
          data: { pointCode, pointType: pointType as 'GCP' | 'ICP', targetLat, targetLng }
        })
        results.created++
      } catch (e: any) {
        results.errors.push(`${pointCode}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Import selesai: ${results.created} titik baru, ${results.skipped} dilewati, ${results.errors.length} error`
    })
  } catch (e: any) {
    console.error('Import error:', e)
    return NextResponse.json({ success: false, error: 'Gagal memproses file: ' + e.message }, { status: 500 })
  }
}, ['super_admin'])
