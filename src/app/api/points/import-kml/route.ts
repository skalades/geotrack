import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'

// ── Types ──────────────────────────────────────────────────────────────────
type PointType = 'GCP' | 'ICP' | 'BM'

interface ParsedKmlPoint {
  pointCode: string
  pointType: PointType
  targetLat: number | null
  targetLng: number | null
  location?: string
  blockId?: string
}

// ── KML Parser ─────────────────────────────────────────────────────────────
/**
 * Extracts text content between the first matching XML tags.
 */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

/**
 * Extracts all occurrences of a block between matching tags.
 */
function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi')
  return xml.match(re) ?? []
}

/**
 * Gets the value of a <SimpleData name="..."> element.
 */
function getSimpleData(xml: string, name: string): string | null {
  const re = new RegExp(`<SimpleData\\s+name=["']${name}["']>([\\s\\S]*?)<\\/SimpleData>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

/**
 * Parse a KML string and return an array of points.
 * Supports GCP (GCP_ID), ICP (ICP_ID), and BM (BM_ID) placemark types.
 */
function parseKml(kmlText: string): { points: ParsedKmlPoint[]; errors: string[] } {
  const points: ParsedKmlPoint[] = []
  const errors: string[] = []

  const placemarks = extractAllTags(kmlText, 'Placemark')

  if (placemarks.length === 0) {
    errors.push('Tidak ada Placemark ditemukan dalam file KML')
    return { points, errors }
  }

  for (const pm of placemarks) {
    try {
      // ── Coordinates ─────────────────────────────────────────────────
      const coordsRaw = extractTag(pm, 'coordinates')
      if (!coordsRaw) {
        errors.push('Placemark tanpa koordinat — dilewati')
        continue
      }

      // KML coordinates: lon,lat,alt or lon,lat
      const parts = coordsRaw.trim().split(',')
      if (parts.length < 2) {
        errors.push(`Koordinat tidak valid: "${coordsRaw}" — dilewati`)
        continue
      }
      const targetLng = parseFloat(parts[0])
      const targetLat = parseFloat(parts[1])

      if (isNaN(targetLat) || isNaN(targetLng)) {
        errors.push(`Koordinat tidak bisa di-parse: "${coordsRaw}" — dilewati`)
        continue
      }

      // ── Point ID & Type ─────────────────────────────────────────────
      const gcpId = getSimpleData(pm, 'GCP_ID')
      const icpId = getSimpleData(pm, 'ICP_ID')
      const bmId = getSimpleData(pm, 'BM_ID')

      let pointCode: string | null = null
      let pointType: PointType | null = null

      if (gcpId) {
        pointCode = gcpId.trim().toUpperCase()
        pointType = 'GCP'
      } else if (icpId) {
        pointCode = icpId.trim().toUpperCase()
        pointType = 'ICP'
      } else if (bmId) {
        pointCode = bmId.trim().toUpperCase()
        pointType = 'BM'
      }

      // Fallback: coba ambil dari <name>
      if (!pointCode) {
        const name = extractTag(pm, 'name')
        if (name) {
          const upper = name.trim().toUpperCase()
          if (upper.startsWith('GCP')) { pointCode = upper; pointType = 'GCP' }
          else if (upper.startsWith('ICP')) { pointCode = upper; pointType = 'ICP' }
          else if (upper.startsWith('BM')) { pointCode = upper; pointType = 'BM' }
        }
      }

      if (!pointCode || !pointType) {
        errors.push(`Placemark tidak memiliki ID (GCP_ID/ICP_ID/BM_ID) — dilewati`)
        continue
      }

      // ── Extra attributes ─────────────────────────────────────────────
      const location = getSimpleData(pm, 'Location') ?? undefined
      const blockId = getSimpleData(pm, 'Block_ID') ?? undefined

      points.push({ pointCode, pointType, targetLat, targetLng, location, blockId })
    } catch (e: any) {
      errors.push(`Error parsing placemark: ${e.message}`)
    }
  }

  return { points, errors }
}

// ── Route Handler ──────────────────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'kml') {
      return NextResponse.json(
        { success: false, error: 'Format file harus .kml' },
        { status: 400 }
      )
    }

    const kmlText = await file.text()
    const { points: parsedPoints, errors: parseErrors } = parseKml(kmlText)

    if (parsedPoints.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tidak ada titik yang dapat di-parse dari file KML',
        data: { created: 0, skipped: 0, errors: parseErrors },
      }, { status: 400 })
    }

    // ── Persist to DB ────────────────────────────────────────────────────
    const results = { created: 0, skipped: 0, errors: [...parseErrors] }

    for (const pt of parsedPoints) {
      try {
        const existing = await prisma.targetPoint.findUnique({
          where: { pointCode: pt.pointCode },
        })
        if (existing) {
          results.skipped++
          continue
        }
        await prisma.targetPoint.create({
          data: {
            pointCode: pt.pointCode,
            pointType: pt.pointType,
            targetLat: pt.targetLat,
            targetLng: pt.targetLng,
          },
        })
        results.created++
      } catch (e: any) {
        results.errors.push(`${pt.pointCode}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Import KML selesai: ${results.created} titik baru, ${results.skipped} dilewati, ${results.errors.length} error`,
    })
  } catch (e: any) {
    console.error('KML Import error:', e)
    return NextResponse.json(
      { success: false, error: 'Gagal memproses file KML: ' + e.message },
      { status: 500 }
    )
  }
}, ['super_admin'])
