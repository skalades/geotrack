// src/lib/utils/index.ts — General utility helpers

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MeasurementStatus, PointType, UserRole } from '@/types'

// ---- TailwindCSS class merger ----
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Status display helpers ----
export const STATUS_LABELS: Record<MeasurementStatus, string> = {
  unassigned: 'Belum Ditugaskan',
  progress: 'Sedang Berjalan',
  review: 'Menunggu Validasi',
  approved: 'Disetujui',
  retake: 'Perlu Diulang',
}

export const STATUS_COLORS: Record<MeasurementStatus, string> = {
  unassigned: 'bg-slate-100 text-slate-600 border-slate-300',
  progress: 'bg-amber-100 text-amber-700 border-amber-300',
  review: 'bg-blue-100 text-blue-700 border-blue-300',
  approved: 'bg-green-100 text-green-700 border-green-300',
  retake: 'bg-red-100 text-red-700 border-red-300',
}

export const STATUS_DOT_COLORS: Record<MeasurementStatus, string> = {
  unassigned: 'bg-slate-400',
  progress: 'bg-amber-400',
  review: 'bg-blue-500',
  approved: 'bg-green-500',
  retake: 'bg-red-500',
}

export const STATUS_MAP_COLORS: Record<MeasurementStatus, string> = {
  unassigned: '#94a3b8',
  progress: '#f59e0b',
  review: '#3b82f6',
  approved: '#22c55e',
  retake: '#ef4444',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Project Manager',
  surveyor: 'Surveyor Lapangan',
  client: 'Client / Viewer',
}

// ---- Point type helpers ----
export const POINT_TYPE_COLORS: Record<PointType, string> = {
  GCP: 'bg-purple-100 text-purple-700',
  ICP: 'bg-cyan-100 text-cyan-700',
}

// ---- Date helpers ----
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

// ---- Number helpers ----
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

export function calcPercent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// ---- File helpers ----
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function isImageFile(filename: string): boolean {
  return ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(getFileExtension(filename))
}

// ---- Coordinate helpers ----
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatCoordinate(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toFixed(7)
}

// ---- API helpers ----
export function buildQueryString(params: Record<string, unknown>): string {
  const filtered = Object.entries(params).filter(([, v]) => v != null && v !== '')
  if (filtered.length === 0) return ''
  return '?' + new URLSearchParams(filtered.map(([k, v]) => [k, String(v)])).toString()
}

// ---- Direction labels ----
export const DIRECTION_LABELS: Record<string, string> = {
  north: '⬆️ Utara',
  south: '⬇️ Selatan',
  east: '➡️ Timur',
  west: '⬅️ Barat',
}
