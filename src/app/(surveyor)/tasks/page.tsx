'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { MapPin, Search, RefreshCw } from 'lucide-react'
import { MeasurementStatus } from '@/types'
import { StatusBadge, PointTypeBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import apiClient from '@/lib/utils/api-client'

const FILTERS: { label: string; value: string }[] = [
  { label: 'Semua', value: '' },
  { label: 'Berjalan', value: 'progress' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Retake', value: 'retake' },
]

export default function TasksPage() {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['my-tasks', activeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (activeFilter) params.set('status', activeFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')
      return apiClient.get(`/measurements/my?${params}`).then(r => r.data)
    },
  })

  const tasks = data?.data ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-10 pb-3 safe-top">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-slate-800">Daftar Tugas</h1>
          <button onClick={() => refetch()} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode titik..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : tasks.length === 0 ? (
          <EmptyState icon={MapPin} title="Tidak ada tugas" description="Belum ada titik yang di-assign ke Anda" />
        ) : (
          tasks.map((task: any) => (
            <button
              key={task.id}
              onClick={() => router.push(`/input?code=${task.pointCode}`)}
              className="w-full bg-white rounded-2xl border border-slate-200 p-4 text-left card-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 font-mono text-sm">{task.pointCode}</span>
                      <PointTypeBadge type={task.targetPoint?.pointType ?? 'GCP'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {task.scheduledDate ? `📅 ${formatDate(task.scheduledDate)}` : 'Jadwal belum diset'}
                    </p>
                  </div>
                </div>
                <StatusBadge status={task.status as MeasurementStatus} />
              </div>
              {task.pmNotes && task.status === 'retake' && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs text-red-600 font-medium">Alasan Retake:</p>
                  <p className="text-xs text-red-700 mt-0.5">{task.pmNotes}</p>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}