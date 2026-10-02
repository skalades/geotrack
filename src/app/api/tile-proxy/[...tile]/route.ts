import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tile: string[] }> }
) {
  const { tile } = await params
  const [z, x, y] = tile ?? []
  if (!z || !x || !y) {
    return new NextResponse('Bad tile path', { status: 400 })
  }

  const esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x

  try {
    const upstream = await fetch(esriUrl, {
      headers: { 'User-Agent': 'GeoTrack/1.0', Referer: 'https://geotrack.app/' },
      next: { revalidate: 1800 },
    })
    if (!upstream.ok) return new NextResponse('Upstream error', { status: upstream.status })
    const buffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[tile-proxy] fetch error:', err)
    return new NextResponse('Proxy error', { status: 502 })
  }
}