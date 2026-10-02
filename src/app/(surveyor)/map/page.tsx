'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { MapPin, Tag } from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import { Skeleton } from '@/components/ui/loading'

const MapView = dynamic(() => import('@/components/maps/map-view'), { 
  ssr: false,
  loading: () => <Skeleton className="w-full h-full rounded-none" />
})

export default function SurveyorMapPage() {
  const [showLabels, setShowLabels] = useState(false)

  const { data: points, isLoading } = useQuery({
    queryKey: ['my-tasks-map'],
    queryFn: () => apiClient.get('/measurements/my?limit=10000').then(r => r.data.data),
  })

  const { data: mapLayers = [] } = useQuery({
    queryKey: ['map-layers'],
    queryFn: () => apiClient.get('/map-layers').then(r => r.data.data),
  })

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 pt-10 pb-3 safe-top shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" /> Peta Titik
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Titik yang ditugaskan kepada Anda</p>
          </div>
          {/* Toggle label */}
          <button
            onClick={() => setShowLabels(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              showLabels
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title={showLabels ? 'Sembunyikan label' : 'Tampilkan label titik & area'}
          >
            <Tag className="w-3.5 h-3.5" />
            Label
          </button>
        </div>
      </div>
      <div className="flex-1 relative z-0">
        {isLoading ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : (
          <MapView points={points || []} mapLayers={mapLayers} center={[-7.65, 107.75]} zoom={12} showLabels={showLabels} />
        )}
      </div>
    </div>
  )
}
