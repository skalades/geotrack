'use client'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, LayerGroup, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MeasurementStatus } from '@/types'
import { STATUS_MAP_COLORS } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Navigation } from 'lucide-react'

// Fix Leaflet default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const createCustomIcon = (status: MeasurementStatus) => {
  const color = STATUS_MAP_COLORS[status] || '#94a3b8'
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
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

export default function MapView({ points, center = [-7.65, 107.75], zoom = 11, mapLayers = [] }: MapProps) {
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
            </LayersControl.Overlay>
          )
        })}

        <LayersControl.Overlay checked name="Titik Tugas">
          <LayerGroup>
            {points.map(p => {
              if (!p.targetPoint?.targetLat || !p.targetPoint?.targetLng) return null
              return (
                <Marker 
                  key={p.id} 
                  position={[p.targetPoint.targetLat, p.targetPoint.targetLng]}
                  icon={createCustomIcon(p.status)}
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
