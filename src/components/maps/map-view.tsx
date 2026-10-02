'use client'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, LayersControl, LayerGroup, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MeasurementStatus } from '@/types'
import { STATUS_MAP_COLORS } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Navigation } from 'lucide-react'
import type { FeatureCollection, Feature, Position } from 'geojson'

// ── Centroid helpers ──────────────────────────────────────────────────────────
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
const areaLabelIcon = L.divIcon({ className: '', html: '', iconSize: [0, 0] })

// Fix Leaflet default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const createCustomIcon = (status: MeasurementStatus, pointCode?: string, showLabels?: boolean) => {
  const color = STATUS_MAP_COLORS[status] || '#94a3b8'
  const labelHtml = showLabels && pointCode
    ? `<div style="
        position:absolute;
        top: 18px;
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
    className: 'custom-leaflet-marker',
    html: `<div style="position:relative;width:16px;height:16px">
      <div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>
      ${labelHtml}
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const createUserIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(59, 130, 246, 0.8); animation: pulse 2s infinite;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

interface MapProps {
  points: any[]
  center?: [number, number]
  zoom?: number
  mapLayers?: any[]
  showLabels?: boolean
}

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

function LocationButton({ location }: { location: [number, number] | null }) {
  const map = useMap()
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (location) {
          map.flyTo(location, 16)
        } else {
          alert('Sedang mencari lokasi, pastikan GPS/Izin Lokasi aktif.')
        }
      }}
      className="absolute bottom-24 right-6 z-[1000] bg-white p-3 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors"
      title="Pusatkan ke Lokasi Saya"
    >
      <Navigation className="w-5 h-5" />
    </button>
  )
}

export default function MapView({ points, center = [-7.65, 107.75], zoom = 11, mapLayers = [], showLabels = false }: MapProps) {
  const [mounted, setMounted] = useState(false)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)

    // Request GPS Location
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude])
        },
        (err) => {
          console.warn('Geolocation error:', err.message)
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      )
      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  if (!mounted) return <div className="w-full h-full bg-slate-100 flex items-center justify-center animate-pulse text-slate-400">Loading map...</div>

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 10 }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer checked name="Satellite (Esri)">
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
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
                {/* Area labels */}
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
                    <Marker key={`${layer.id}-lbl-${fi}`} position={pos} icon={areaLabelIcon}>
                      <Tooltip permanent direction="center" className="area-label-tooltip" offset={[0, 0]}>
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

        <LayersControl.Overlay checked name="Titik Tugas">
          <LayerGroup>
            {points.map(p => {
              if (!p.targetPoint?.targetLat || !p.targetPoint?.targetLng) return null
              return (
                <Marker
                  key={`${p.id}-${showLabels}`}
                  position={[p.targetPoint.targetLat, p.targetPoint.targetLng]}
                  icon={createCustomIcon(p.status, p.pointCode, showLabels)}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-bold text-sm">{p.pointCode}</p>
                      <p className="text-xs text-slate-500 mb-2 capitalize">{p.status}</p>
                      <button 
                        onClick={() => router.push(`/input?code=${p.pointCode}`)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs w-full"
                      >
                        Buka Input
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
      
      <MapUpdater center={center} zoom={zoom} />
      <LocationButton location={userLocation} />

      {userLocation && (
        <Marker position={userLocation} icon={createUserIcon()}>
          <Popup>Lokasi Anda saat ini</Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
