'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ClipboardList, Plus, Map, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/home', label: 'Beranda', icon: Home },
  { href: '/tasks', label: 'Tugas', icon: ClipboardList },
  { href: '/input', label: 'Input', icon: Plus, isFab: true },
  { href: '/map', label: 'Peta', icon: Map },
  { href: '/profile', label: 'Profil', icon: User },
]

export function SurveyorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isSurveyor } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      {/* Page content */}
      <main className="flex-1 pb-20 overflow-y-auto mobile-scroll">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 bg-white border-t border-slate-200 safe-bottom">
        <div className="flex items-center">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            if (item.isFab) {
              return (
                <div key={item.href} className="flex-1 flex justify-center -mt-5">
                  <button
                    onClick={() => router.push(item.href)}
                    className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 flex items-center justify-center transition-all active:scale-95 hover:bg-blue-700 border-4 border-white"
                    aria-label="Input baru"
                  >
                    <Plus className="w-7 h-7" />
                  </button>
                </div>
              )
            }

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors relative tap-highlight-none',
                  isActive ? 'text-blue-600' : 'text-slate-400'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>
                  {item.label}
                </span>
                {isActive && <span className="nav-active-dot" />}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
