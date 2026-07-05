// src/lib/utils/api-client.ts — Axios API Client with Auth interceptors

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Request interceptor — attach Bearer token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('geotrack-auth')
      if (raw) {
        const state = JSON.parse(raw)
        const token = state?.state?.accessToken
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return config
})

// Response interceptor — handle 401, refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const raw = localStorage.getItem('geotrack-auth')
        if (raw) {
          const state = JSON.parse(raw)
          const refreshToken = state?.state?.refreshToken
          if (refreshToken) {
            const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
            const { accessToken } = res.data.data
            // Update store
            const newState = JSON.parse(localStorage.getItem('geotrack-auth') ?? '{}')
            if (newState.state) {
              newState.state.accessToken = accessToken
              localStorage.setItem('geotrack-auth', JSON.stringify(newState))
            }
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`
            }
            return apiClient(originalRequest)
          }
        }
      } catch {
        // Refresh failed — clear auth
        localStorage.removeItem('geotrack-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
