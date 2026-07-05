'use client'
import { useQuery } from '@tanstack/react-query'
import { MapPin, CheckCircle2, Clock, RotateCcw, Bell, Wifi, WifiOff, ChevronRight, Calendar } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/loading'
import { formatDate, formatTimeAgo, calcPercent } from '@/lib/utils'
import apiClient from '@/lib/utils/api-client'
import { useState, useEffect } from 'react'

export default function SurveyorHomePage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handler = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler) }
  }, [])

  const { data: summaryRes, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get('/dashboard/summary').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: notifRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then(r => r.data),
  })

  const { data: tasksRes, isLoading: loadingTasks } = useQuery({
    queryKey: ['my-tasks-today'],
    queryFn: () => apiClient.get('/measurements/my?status=progress&limit=3').then(r => r.data),
  })

  const summary = summaryRes
  const notifications = notifRes?.data?.slice(0, 3) ?? []
  const todayTasks = tasksRes?.data ?? []
  const unread = notifRes?.unreadCount ?? 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Sore'
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 px-4 pt-10 pb-6 safe-top">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-blue-200 text-sm">{greeting},</p>
            <h1 className="text-white font-bold text-xl">{user?.name ?? 'Surveyor'}</h1>
            <p className="text-blue-300 text-xs mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <button
              onClick={() => router.push('/profile?tab=notifications')}
              className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Bell className="w-5 h-5 text-white" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Progress ring */}
        {loadingStats ? (
          <div className="mt-4 bg-white/10 rounded-2xl p-4"><Skeleton className="h-16" /></div>
        ) : summary && (
          <div className="mt-4 bg-white/10 backdrop-blur rounded-2xl p-4 flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
                  strokeDasharray={`${summary.progressPercent} ${100 - summary.progressPercent}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{summary.progressPercent}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Progress Proyek</p>
              <p className="text-blue-200 text-xs mt-0.5">{summary.approved} dari {summary.total} titik disetujui</p>
              <div className="flex gap-3 mt-2">
                <span className="text-xs text-amber-300">⏳ {summary.progress} berjalan</span>
                <span className="text-xs text-red-300">🔄 {summary.retake} retake</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Today's Tasks */}
        <Card padding="none">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-slate-800 text-sm">Tugas Saya</h2>
            </div>
            <button onClick={() => router.push('/tasks')} className="text-blue-600 text-xs font-medium flex items-center gap-0.5">
              Lihat semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loadingTasks ? (
            <div className="p-4 space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : todayTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Tidak ada tugas aktif</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {todayTasks.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/input?code=${t.pointCode}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{t.pointCode}</p>
                    <p className="text-xs text-slate-500">{t.scheduledDate ? formatDate(t.scheduledDate) : 'Jadwal belum diset'}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-slate-800 text-sm">Notifikasi</h2>
                {unread > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {notifications.map((n: any) => (
                <div key={n.id} className={`px-4 py-3 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                  <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick stats */}
        {!loadingStats && summary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-700">{summary.approved}</p>
              <p className="text-xs text-green-600">Approved</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-3 text-center">
              <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-700">{summary.review}</p>
              <p className="text-xs text-amber-600">Review</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-3 text-center">
              <RotateCcw className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-700">{summary.retake}</p>
              <p className="text-xs text-red-600">Retake</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}