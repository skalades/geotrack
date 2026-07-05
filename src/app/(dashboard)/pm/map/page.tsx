'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { MapPin, Filter, X, Trash2, Loader2 } from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import { Skeleton } from '@/components/ui/loading'
import { STATUS_LABELS, STATUS_MAP_COLORS } from '@/lib/utils'
import { MeasurementStatus } from '@/types'
import { kml } from '@tmcw/togeojson'
import type { FeatureCollection } from 'geojson'
import { UploadCloud } from 'lucide-react'

const PMMapView = dynamic(() => import('@/components/maps/pm-map-view'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-none" />,
})

const ALL_STATUSES: (MeasurementStatus | 'unassigned')[] = ['unassigned', 'progress', 'review', 'approved', 'retake']

export default function PMMapPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSurveyor, setFilterSurveyor] = useState<string>('all')
  const [isUploading, setIsUploading] = useState(false)
  const queryClient = useQueryClient()

  // Fetch map layers
  const { data: mapLayers = [] } = useQuery({
    queryKey: ['map-layers'],
    queryFn: () => apiClient.get('/map-layers').then(r => r.data.data),
  })

  // Delete layer mutation
  const deleteLayerMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/map-layers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-layers'] })
    }
  })

  const handleKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      let kmlText = ''

      if (file.name.toLowerCase().endsWith('.kmz')) {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        const unzipped = await zip.loadAsync(file)
        
        // Cari file .kml pertama di dalam archive kmz
        const kmlFile = Object.values(unzipped.files).find(f => f.name.toLowerCase().endsWith('.kml'))
        if (!kmlFile) throw new Error('File KML tidak ditemukan di dalam KMZ')
        
        kmlText = await kmlFile.async('text')
      } else {
        kmlText = await file.text()
      }

      const parser = new DOMParser()
      const xml = parser.parseFromString(kmlText, 'text/xml')
      const geojson = kml(xml)

      await apiClient.post('/map-layers', {
        name: file.name,
        geojson: geojson
      })

      queryClient.invalidateQueries({ queryKey: ['map-layers'] })
    } catch (err) {
      console.error('Failed to parse/upload KML/KMZ', err)
      alert('Gagal membaca atau menyimpan file. Pastikan format KML/KMZ valid.')
    } finally {
      setIsUploading(false)
    }

    // Reset input supaya bisa upload file yang sama lagi jika dihapus
    e.target.value = ''
  }

  const { data: pointsData, isLoading } = useQuery({
    queryKey: ['points-map'],
    queryFn: () => apiClient.get('/points').then(r => r.data.data),
    refetchInterval: 60000,
  })

  const { data: usersData } = useQuery({
    queryKey: ['surveyors-list'],
    queryFn: () => apiClient.get('/users').then(r =>
      (r.data.data as any[]).filter(u => u.role === 'surveyor')
    ),
  })

  const points: any[] = pointsData || []
  const surveyors: any[] = usersData || []

  // Stats by status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: points.length }
    for (const s of ALL_STATUSES) {
      counts[s] = points.filter(p =>
        s === 'unassigned' ? !p.measurement || p.measurement.status === 'unassigned' : p.measurement?.status === s
      ).length
    }
    return counts
  }, [points])

  // Filtered points
  const filteredPoints = useMemo(() => {
    return points.filter(p => {
      const status = p.measurement?.status || 'unassigned'
      const matchStatus = filterStatus === 'all' || status === filterStatus
      const matchSurveyor = filterSurveyor === 'all' || p.measurement?.surveyorId === filterSurveyor
      return matchStatus && matchSurveyor
    })
  }, [points, filterStatus, filterSurveyor])

  const hasCoords = filteredPoints.filter(p => p.targetLat && p.targetLng)

  return (
    <div className="-m-4 lg:-m-8 h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-800">Peta Titik GCP/ICP</h1>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {hasCoords.length} / {points.length} titik
          </span>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5 ml-auto items-center">
          <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-colors border border-blue-200`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {isUploading ? 'Menyimpan...' : 'Upload KML/AOI'}
            <input 
              type="file" 
              accept=".kml,.kmz" 
              className="hidden" 
              onChange={handleKmlUpload}
              disabled={isUploading}
            />
          </label>
          {mapLayers.map((layer: any) => (
            <div key={layer.id} className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 mr-1">
              <span className="max-w-[100px] truncate" title={layer.name}>{layer.name}</span>
              <button
                onClick={() => {
                  if (confirm(`Hapus layer ${layer.name}?`)) {
                    deleteLayerMutation.mutate(layer.id)
                  }
                }}
                className="text-red-500 hover:text-red-700 ml-1"
                title="Hapus Layer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({statusCounts.all})
          </button>
          {ALL_STATUSES.map(s => {
            const color = STATUS_MAP_COLORS[s as MeasurementStatus]
            const label = STATUS_LABELS[s as MeasurementStatus]
            const isActive = filterStatus === s
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(isActive ? 'all' : s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5`}
                style={{
                  backgroundColor: isActive ? color : color + '20',
                  color: isActive ? 'white' : color,
                }}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: isActive ? 'white' : color }} />
                {label} ({statusCounts[s] || 0})
              </button>
            )
          })}
        </div>

        {/* Surveyor filter */}
        {surveyors.length > 0 && (
          <select
            value={filterSurveyor}
            onChange={e => setFilterSurveyor(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Surveyor</option>
            {surveyors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {(filterStatus !== 'all' || filterSurveyor !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterSurveyor('all') }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
          >
            <X className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[999] flex gap-2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-100 pointer-events-none">
        {ALL_STATUSES.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_MAP_COLORS[s as MeasurementStatus] }} />
            <span className="text-xs text-slate-600">{STATUS_LABELS[s as MeasurementStatus]}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 relative z-0">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : (
          <PMMapView points={filteredPoints} mapLayers={mapLayers} />
        )}
      </div>
    </div>
  )
}
