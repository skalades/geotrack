import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  try {
    const layers = await prisma.mapLayer.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ success: true, data: layers })
  } catch (error) {
    console.error('Failed to fetch layers:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch layers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.geojson) {
      return NextResponse.json({ success: false, error: 'Name and geojson are required' }, { status: 400 })
    }

    const layer = await prisma.mapLayer.create({
      data: {
        name: body.name,
        geojson: typeof body.geojson === 'string' ? body.geojson : JSON.stringify(body.geojson)
      }
    })
    return NextResponse.json({ success: true, data: layer }, { status: 201 })
  } catch (error) {
    console.error('Failed to create layer:', error)
    return NextResponse.json({ success: false, error: 'Failed to create layer' }, { status: 500 })
  }
}
