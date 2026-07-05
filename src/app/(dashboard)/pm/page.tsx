'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, RotateCcw, AlertCircle, BarChart3, Users, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/loading'
import apiClient from '@/lib/utils/api-client'
import dynamic from 'next/dynamic'

const DailyProgressChart = dynamic(
  () => import('@/components/charts/dashboard-charts').then(m => m.DailyProgressChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
)

const SurveyorBarChart = dynamic(
  () => import('@/components/charts/dashboard-charts').then(m => m.SurveyorBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
)

const DAYS_OPTIONS = [7, 14, 30]

export default function PMDashboardPage() {
  const [chartDays, setChartDays] = useState(14)

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get('/dashboard/summary').then(r => r.data.data),
    refetchInterval: 60000,
  })

  const { data: analyticsRes, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['dashboard-analytics', chartDays],
    queryFn: () => apiClient.get(`/dashboard/analytics?days=${chartDays}`).then(r => r.data.data),
    refetchInterval: 120000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  const s = summaryRes
  if (!s) return null

  const stats = [
    { label: 'Total Titik', value: s.total, icon: MapPinIcon, color: 'bg-slate-100 text-slate-700' },
    { label: 'Belum Ditugaskan', value: s.unassigned, icon: AlertCircle, color: 'bg-slate-100 text-slate-700' },
    { label: 'Sedang Dikerjakan', value: s.progress, icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { label: 'Menunggu Validasi', value: s.review, icon: BarChart3, color: 'bg-blue-100 text-blue-700' },
    { label: 'Disetujui', value: s.approved, icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    { label: 'Perlu Retake', value: s.retake, icon: RotateCcw, color: 'bg-red-100 text-red-700' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Utama</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan progress pengukuran titik GCP/ICP</p>
      </div>

      {/* Progress Bar */}
      <Card padding="lg" className="bg-gradient-to-r from-blue-700 to-blue-900 text-white border-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full">
            <h2 className="text-lg font-semibold mb-2">Progress Keseluruhan</h2>
            <div className="flex justify-between text-sm mb-2 text-blue-200">
              <span>{s.approved} dari {s.total} titik disetujui</span>
              <span className="font-bold text-white">{s.progressPercent}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-green-400 h-3 rounded-full transition-all duration-1000"
                style={{ width: `${s.progressPercent}%` }}
              />
            </div>
          </div>
          <div className="md:border-l border-white/20 md:pl-8 flex gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold">{s.review}</p>
              <p className="text-xs text-blue-200 uppercase tracking-wide mt-1">Menunggu Review</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-300">{s.retake}</p>
              <p className="text-xs text-blue-200 uppercase tracking-wide mt-1">Retake</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map(stat => (
          <Card key={stat.label} padding="lg">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${stat.color}`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── CHARTS SECTION ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Daily Line Chart */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <CardTitle>Progres Harian</CardTitle>
              </div>
              <div className="flex gap-1">
                {DAYS_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setChartDays(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      chartDays === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {d}H
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          {loadingAnalytics ? (
            <Skeleton className="h-[280px] w-full mt-4" />
          ) : analyticsRes?.daily ? (
            <div className="mt-4">
              <DailyProgressChart data={analyticsRes.daily} />
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Belum ada data</div>
          )}
        </Card>

        {/* Surveyor Bar Chart */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <CardTitle>Produktivitas Surveyor</CardTitle>
            </div>
          </CardHeader>
          {loadingAnalytics ? (
            <Skeleton className="h-[280px] w-full mt-4" />
          ) : analyticsRes?.surveyors?.length > 0 ? (
            <div className="mt-4">
              <SurveyorBarChart data={analyticsRes.surveyors} />
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Belum ada data surveyor</div>
          )}
        </Card>
      </div>

      {/* Surveyor Leaderboard Table */}
      <Card padding="lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <CardTitle>Tabel Performa Surveyor</CardTitle>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Surveyor</th>
                <th className="px-4 py-3 font-semibold text-center">Total Tugas</th>
                <th className="px-4 py-3 font-semibold text-center text-green-600">Selesai</th>
                <th className="px-4 py-3 font-semibold text-center text-amber-600">Berjalan</th>
                <th className="px-4 py-3 font-semibold text-center text-red-600">Retake</th>
                <th className="px-4 py-3 font-semibold text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {s.surveyorStats?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada data surveyor</td>
                </tr>
              ) : (
                s.surveyorStats?.map((st: any) => {
                  const pct = st.total > 0 ? Math.round((st.approved / st.total) * 100) : 0
                  return (
                    <tr key={st.surveyorId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{st.surveyorName}</td>
                      <td className="px-4 py-3 text-center">{st.total}</td>
                      <td className="px-4 py-3 text-center font-medium text-green-600">{st.approved}</td>
                      <td className="px-4 py-3 text-center text-amber-600">{st.progress}</td>
                      <td className="px-4 py-3 text-center text-red-600">{st.retake}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-slate-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-xs font-medium">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function MapPinIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}
