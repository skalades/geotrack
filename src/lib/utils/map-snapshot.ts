// src/lib/utils/map-snapshot.ts
//
// Pre-renders ESRI World Imagery satellite tiles to a canvas data URL.
// Tiles diambil via proxy /api/tile-proxy/* agar bebas CORS sehingga
// aman untuk di-drawImage ke canvas dan di-export sebagai data URL.

const TILE_SIZE = 256
// Gunakan proxy server lokal — hindari CORS block dari ESRI
const SATELLITE_TILE_URL = '/api/tile-proxy'

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  )
}

async function fetchTileAsDataUrl(z: number, x: number, y: number): Promise<string> {
  try {
    const res = await fetch(`${SATELLITE_TILE_URL}/${z}/${x}/${y}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    const blank = document.createElement('canvas')
    blank.width = TILE_SIZE
    blank.height = TILE_SIZE
    const ctx = blank.getContext('2d')!
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    return blank.toDataURL()
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(img)
    img.src = src
  })
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#2563eb'
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, Math.PI * 2)
  ctx.fill()
}

export interface MapSnapshotOptions {
  zoom?: number
  cols?: number
  rows?: number
}

export async function generateMapSnapshot(
  lat: number,
  lng: number,
  options: MapSnapshotOptions = {}
): Promise<string> {
  const { zoom = 18, cols = 4, rows = 3 } = options

  const cx = lngToTileX(lng, zoom)
  const cy = latToTileY(lat, zoom)
  const startX = cx - Math.floor(cols / 2)
  const startY = cy - Math.floor(rows / 2)

  const canvasW = TILE_SIZE * cols
  const canvasH = TILE_SIZE * rows
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const tilePromises = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = startX + col
      const ty = startY + row
      tilePromises.push(
        fetchTileAsDataUrl(zoom, tx, ty).then((dataUrl) => ({ col, row, dataUrl }))
      )
    }
  }

  const tiles = await Promise.all(tilePromises)

  for (const { col, row, dataUrl } of tiles) {
    const img = await loadImage(dataUrl)
    ctx.drawImage(img, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE)
  }

  const n = Math.pow(2, zoom)
  const latRad = (lat * Math.PI) / 180
  const globalTileX = ((lng + 180) / 360) * n
  const globalTileY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n

  const markerX = (globalTileX - startX) * TILE_SIZE
  const markerY = (globalTileY - startY) * TILE_SIZE

  drawMarker(ctx, markerX, markerY)

  return canvas.toDataURL('image/jpeg', 0.9)
}
