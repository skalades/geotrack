'use client'
import { useAuthStore } from '@/store/auth.store'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, MapPin, ClipboardCheck, Download, Activity, LogOut, Menu, X, Map } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'

const PM_MENU = [
  { href: '/pm', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pm/points', label: 'Master Titik', icon: MapPin },
  { href: '/pm/map', label: 'Peta Interaktif', icon: Map },
  { href: '/pm/measurements', label: 'Validasi Data', icon: ClipboardCheck },
  { href: '/pm/users', label: 'Manajemen Surveyor', icon: Users },
  { href: '/pm/exports', label: 'Export Laporan', icon: Download },
  { href: '/pm/audit', label: 'Audit Log', icon: Activity },
]

export default function PMLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isPM, user, clearAuth } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    } else if (!isPM()) {
      if (user?.role === 'surveyor') router.push('/home')
      else router.push('/client')
    }
  }, [isAuthenticated, isPM, user, router])

  if (!isAuthenticated || !isPM()) return null

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <h1 className="font-bold text-xl text-blue-700 tracking-tight">GeoTrack</h1>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="mb-6 px-3">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Navigasi Utama</p>
          </div>
          {PM_MENU.map(item => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-blue-700 font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
            </div>
          </div>
          <button 
            onClick={() => { clearAuth(); router.push('/login') }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Topbar (Mobile) */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg text-slate-800 ml-2">PM Dashboard</h1>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
