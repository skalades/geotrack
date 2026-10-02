'use client'
import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, LayersControl, GeoJSON, LayerGroup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MeasurementStatus } from '@/types'
import { STATUS_MAP_COLORS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import type { FeatureCollection, Geometry, Feature, Position } from 'geojson'

// ── Centroid helper ──────────────────────────────────────────────────────────
/** Compute the arithmetic centroid of a coordinate ring or point. */
function ringCentroid(coords: Position[]): [number, number] {
  let lat = 0, lng = 0
  for (const c of coords) { lng += c[0]; lat += c[1] }
  return [lat / coords.length, lng / coords.length]
}

function featureCentroid(feature: Feature): [number, number] | null {
  const geom = feature.geometry
  if (!geom) return null
  if (geom.type === 'Point') return [geom.coordinates[1], geom.coordinates[0]]
  if (geom.type === 'LineString') return ringCentroid(geom.coordinates)
  if (geom.type === 'Polygon') return ringCentroid(geom.coordinates[0])
  if (geom.type === 'MultiPolygon') return ringCentroid(geom.coordinates[0][0])
  if (geom.type === 'MultiLineString') return ringCentroid(geom.coordinates[0])
  return null
}

const labelIcon = L.divIcon({ className: '', html: '', iconSize: [0, 0] })

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const createIcon = (status: string | null, pointCode?: string, showLabels?: boolean) => {
  const color = STATUS_MAP_COLORS[(status || 'unassigned') as MeasurementStatus] || '#94a3b8'
  const labelHtml = showLabels && pointCode
    ? `<div style="
        position:absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        color: #1e293b;
        font-size: 10px;
        font-weight: 700;
        font-family: monospace;
        white-space: nowrap;
        padding: 1px 5px;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        border: 1px solid ${color};
        pointer-events: none;
      ">${pointCode}</div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:14px;height:14px">
      <div style="
        background-color: ${color};
        width: 14px; height: 14px;
        border-radius: 50%;
        border: 2.5px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      "></div>
      ${labelHtml}
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

interface PMMapPoint {
  id: number
  pointCode: string
  pointType: string
  targetLat: number | null
  targetLng: number | null
  measurement?: {
    status: string
    surveyorId?: string
    surveyor?: { name: string }
    scheduledDate?: string
    photoNorthUrl?: string
    retakeCount?: number
  } | null
}

interface PMMapViewProps {
  points: PMMapPoint[]
  center?: [number, number]
  zoom?: number
  mapLayers?: any[]
  showLabels?: boolean
}

function BoundsUpdater({ points }: { points: PMMapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    const validPoints = points.filter(p => p.targetLat && p.targetLng)
    if (validPoints.length === 0) return
    const bounds = L.latLngBounds(
      validPoints.map(p => [p.targetLat!, p.targetLng!])
    )
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [points, map])
  return null
}

export default function PMMapView({ points, center = [-7.65, 107.75], zoom = 11, mapLayers = [], showLabels = false }: PMMapViewProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return <div className="w-full h-full bg-slate-100 flex items-center justify-center animate-pulse text-slate-400 text-sm">Memuat peta…</div>
  }

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 0 }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satelit (Esri)">
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>

        {mapLayers.map((layer) => {
          let geojson = null
          try {
            geojson = typeof layer.geojson === 'string' ? JSON.parse(layer.geojson) : layer.geojson
          } catch (e) {
            console.error('Failed to parse geojson for layer', layer.name)
          }
          if (!geojson) return null

          return (
            <LayersControl.Overlay key={layer.id} checked name={layer.name}>
              <LayerGroup>
                <GeoJSON
                  data={geojson}
                  style={{
                    color: '#3b82f6',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2
                  }}
                />
                {/* Area labels on centroid */}
                {showLabels && (geojson as FeatureCollection).features?.map((feat: any, fi: number) => {
                  const p = feat.properties || {}
                  const label: string | null =
                    p.name || p.Name || p.NAME ||
                    p.nama || p.Nama || p.NAMA ||
                    p.label || p.Label || p.LABEL ||
                    p.keterangan || p.Keterangan ||
                    p.description || p.Description ||
                    p.lokasi || p.Lokasi ||
                    p.Block_ID || p.block_id ||
                    p.KML_FOLDER ||
                    (Object.values(p).find((v: any) => typeof v === 'string' && v.trim()) as string | undefined) ||
                    null
                  if (!label) return null
                  const pos = featureCentroid(feat)
                  if (!pos) return null
                  return (
                    <Marker key={`${layer.id}-lbl-${fi}`} position={pos} icon={labelIcon}>
                      <Tooltip
                        permanent
                        direction="center"
                        className="area-label-tooltip"
                        offset={[0, 0]}
                      >
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '11px',
                          color: '#1e40af',
                          background: 'rgba(255,255,255,0.88)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #3b82f6',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          pointerEvents: 'none',
                        }}>{label}</span>
                      </Tooltip>
                    </Marker>
                  )
                })}
              </LayerGroup>
            </LayersControl.Overlay>
          )
        })}

        <LayersControl.Overlay checked name="Sebaran Titik GCP">
          <LayerGroup>
            {points.length > 0 && <BoundsUpdater points={points} />}
            {points.map(p => {
              if (!p.targetLat || !p.targetLng) return null
              const status = p.measurement?.status || 'unassigned'
              const statusLabel = STATUS_LABELS[status as MeasurementStatus] || status
              const color = STATUS_MAP_COLORS[status as MeasurementStatus] || '#94a3b8'
              return (
                <Marker
                  key={`${p.id}-${showLabels}`}
                  position={[p.targetLat, p.targetLng]}
                  icon={createIcon(status, p.pointCode, showLabels)}
                >
                  <Popup minWidth={180} maxWidth={220}>
                    <div className="py-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-sm text-slate-800">{p.pointCode}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: color + '22', color }}>
                          {p.pointType}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="font-semibold" style={{ color }}>{statusLabel}</span>
                        </div>
                        {p.measurement?.surveyor?.name && (
                          <div className="flex justify-between">
                            <span>Surveyor:</span>
                            <span className="font-medium text-slate-700">{p.measurement.surveyor.name}</span>
                          </div>
                        )}
                        {p.measurement?.scheduledDate && (
                          <div className="flex justify-between">
                            <span>Jadwal:</span>
                            <span>{p.measurement.scheduledDate}</span>
                          </div>
                        )}
                        {(p.measurement?.retakeCount ?? 0) > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Retake:</span>
                            <span className="font-semibold">{p.measurement!.retakeCount}x</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        <Link
                          href={`/points/${p.pointCode}`}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-2 rounded text-center transition-colors"
                        >
                          Detail
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}
