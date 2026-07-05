// src/store/auth.store.ts — Auth State Management (Zustand)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthUser, UserRole } from '@/types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setUser: (user: AuthUser) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void

  // Helpers
  hasRole: (roles: UserRole[]) => boolean
  isSurveyor: () => boolean
  isPM: () => boolean
  isClient: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ accessToken: token }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      hasRole: (roles) => {
        const { user } = get()
        return user ? roles.includes(user.role) : false
      },

      isSurveyor: () => get().user?.role === 'surveyor',
      isPM: () => get().user?.role === 'super_admin',
      isClient: () => get().user?.role === 'client',
    }),
    {
      name: 'geotrack-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
