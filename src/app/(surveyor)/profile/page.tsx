'use client'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { User, Mail, Shield, LogOut, Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/utils/api-client'
import { ROLE_LABELS, formatTimeAgo } from '@/lib/utils'

export default function ProfilePage() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()

  const { data: summaryRes } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get('/dashboard/summary').then(r => r.data.data),
  })
  const { data: notifRes } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then(r => r.data),
  })

  const handleLogout = () => { clearAuth(); router.push('/login') }
  const stats = summaryRes
  const notifications: any[] = notifRes?.data ?? []
  const unread: number = notifRes?.unreadCount ?? 0

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-br from-blue-700 to-blue-900 px-4 pt-12 pb-8 safe-top">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center mb-3">
            <span className="text-3xl text-white font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-white font-bold text-xl">{user?.name}</h1>
          <p className="text-blue-200 text-sm">{user?.email}</p>
          <span className="mt-2 px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium">
            {user?.role ? ROLE_LABELS[user.role] : ''}
          </span>
        </div>
        {stats && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Approved', val: stats.approved },
              { label: 'Berjalan', val: stats.progress },
              { label: 'Retake', val: stats.retake },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{s.val}</p>
                <p className="text-xs text-blue-200">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Notifikasi */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-800 text-sm">Notifikasi</span>
            </div>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{unread} baru</span>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Belum ada notifikasi</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
              {notifications.slice(0, 10).map((n: any) => (
                <div key={n.id} className={`px-4 py-3 ${!n.isRead ? 'bg-blue-50/60' : ''}`}>
                  <p className="text-xs text-slate-700 leading-snug">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info akun */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-50">
            {[
              { icon: User, label: 'Nama', val: user?.name },
              { icon: Mail, label: 'Email', val: user?.email },
              { icon: Shield, label: 'Peran', val: user?.role ? ROLE_LABELS[user.role] : '-' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-3.5">
                <row.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <p className="text-sm font-medium text-slate-800">{row.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Keluar dari Akun
        </button>
        <p className="text-center text-slate-400 text-xs py-2">GeoTrack Cikelet v2.0 · 2026</p>
      </div>
    </div>
  )
}
