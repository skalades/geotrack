import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import proj4 from 'proj4'

export const POST = withAuth(async (req, context) => {
  try {
    const { params, user } = context
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    const body = await req.json()
    const { finalUtmX, finalUtmY, finalElevation, finalUtmZone, startTime, endTime, horizontalAccuracy, verticalAccuracy, antennaHeight } = body

    if (!finalUtmX || !finalUtmY || !finalUtmZone) {
      return NextResponse.json({ success: false, error: 'UTM X, Y, dan Zone harus diisi' }, { status: 400 })
    }

    // Convert UTM to Lat/Lng
    const isSouth = finalUtmZone.toUpperCase().endsWith('S')
    const zoneNum = parseInt(finalUtmZone)
    const projStr = `+proj=utm +zone=${zoneNum} ${isSouth ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`
    
    let finalLng = null
    let finalLat = null
    try {
      const [lng, lat] = proj4(projStr, 'WGS84', [parseFloat(finalUtmX), parseFloat(finalUtmY)])
      finalLng = lng
      finalLat = lat
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Format Zona UTM tidak valid' }, { status: 400 })
    }

    const updated = await prisma.measurement.update({
      where: { id },
      data: {
        finalUtmX: parseFloat(finalUtmX),
        finalUtmY: parseFloat(finalUtmY),
        finalElevation: finalElevation ? parseFloat(finalElevation) : null,
        finalUtmZone: finalUtmZone.toUpperCase(),
        finalLat,
        finalLng,
        ...(startTime ? { startTime: new Date(startTime) } : {}),
        ...(endTime   ? { endTime:   new Date(endTime)   } : {}),
        ...(horizontalAccuracy !== undefined && horizontalAccuracy !== '' ? { horizontalAccuracy: parseFloat(horizontalAccuracy) } : {}),
        ...(verticalAccuracy   !== undefined && verticalAccuracy   !== '' ? { verticalAccuracy:   parseFloat(verticalAccuracy)   } : {}),
        ...(antennaHeight      !== undefined && antennaHeight      !== '' ? { antennaHeight:      parseFloat(antennaHeight)      } : {}),
      }
    })

    await prisma.activityLog.create({ 
      data: { 
        userId: user.userId, 
        action: 'update_metadata', 
        entityType: 'measurement', 
        entityId: id, 
        notes: `Updated final coordinates for ${updated.pointCode}` 
      } 
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e: any) {
    console.error('Update metadata error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}, ['super_admin'])
