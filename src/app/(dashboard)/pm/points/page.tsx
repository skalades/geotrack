'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Plus, Search, Upload, Pencil, Trash2,
  UserCheck, CheckCircle, AlertCircle, CalendarDays,
  Filter, Users, FileCode2, ClipboardList, Camera,
  CheckCircle2, X, Loader2, Info, ArrowLeftRight, Target
} from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import proj4 from 'proj4'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useForm as useRHForm } from 'react-hook-form'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/auth.store'

type Point = {
  id: number
  pointCode: string
  pointType: 'GCP' | 'ICP' | 'BM'
  targetLat: number | null
  targetLng: number | null
  measurement: {
    status: string
    surveyorId?: string
    surveyor?: { name: string }
    scheduledDate?: string
  } | null
}

type KmlPreviewPoint = {
  pointCode: string
  pointType: 'GCP' | 'ICP' | 'BM'
  targetLat: number | null
  targetLng: number | null
  exists?: boolean
}

type PointForm = {
  pointCode: string
  pointType: 'GCP' | 'ICP'
  targetLat: number
  targetLng: number
}

const STATUS_FILTER_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'unassigned', label: 'Belum Ditugaskan' },
  { key: 'progress', label: 'Dikerjakan' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'retake', label: 'Retake' },
]

// ── Tipe untuk BM Direct Input ──────────────────────────────────────────────
type PhotoDir = 'north' | 'south' | 'east' | 'west'
type BmPhotos = Record<PhotoDir, { url?: string; preview?: string; uploading?: boolean }>

const PHOTO_DIRS: { key: PhotoDir; label: string; icon: string }[] = [
  { key: 'north', label: 'Utara', icon: '↑' },
  { key: 'south', label: 'Selatan', icon: '↓' },
  { key: 'east',  label: 'Timur',   icon: '→' },
  { key: 'west',  label: 'Barat',   icon: '←' },
]

export default function MasterPointsPage() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPoint, setEditPoint] = useState<Point | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Point | null>(null)
  const [importDialog, setImportDialog] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  // ── KML Import dialog state ──
  const [kmlDialog, setKmlDialog] = useState(false)
  const [kmlFile, setKmlFile] = useState<File | null>(null)
  const [kmlPreview, setKmlPreview] = useState<KmlPreviewPoint[]>([])
  const [kmlParsing, setKmlParsing] = useState(false)
  const [kmlImporting, setKmlImporting] = useState(false)
  const [kmlResult, setKmlResult] = useState<any>(null)
  const kmlFileRef = useRef<HTMLInputElement>(null)
  // ── Assign dialog state ──
  const [assignPoint, setAssignPoint] = useState<Point | null>(null)
  const [assignSurveyorId, setAssignSurveyorId] = useState('')
  const [assignDate, setAssignDate] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  // ── BM Direct Input dialog state ──
  const [bmInputPoint, setBmInputPoint] = useState<Point | null>(null)
  const [bmForm, setBmForm] = useState({
    observationDate: '',
    conditionSekitar: '',
    weather: '',
    receiverType: '',
    fieldNotes: '',
    finalUtmX: '',
    finalUtmY: '',
    finalElevation: '',
    finalUtmZone: '',
    horizontalAccuracy: '',
    verticalAccuracy: '',
  })
  const [bmPhotos, setBmPhotos] = useState<BmPhotos>({ north: {}, south: {}, east: {}, west: {} })
  const [bmRinexUrl, setBmRinexUrl] = useState('')
  const [bmRinexUploading, setBmRinexUploading] = useState(false)
  const [bmError, setBmError] = useState('')
  const [bmStep, setBmStep] = useState(0) // 0=info, 1=koordinat, 2=foto
  const bmRinexRef = useRef<HTMLInputElement>(null)
  // ── GCP Direct Input dialog state ──
  const [gcpInputPoint, setGcpInputPoint] = useState<Point | null>(null)
  const [gcpStep, setGcpStep] = useState(0) // 0=info, 1=koordinat
  const [gcpError, setGcpError] = useState('')
  const [gcpForm, setGcpForm] = useState({
    observationDate: '',
    conditionSekitar: '',
    weather: '',
    receiverType: '',
    fieldNotes: '',
    antennaHeight: '',
    startTime: '',
    endTime: '',
    finalUtmX: '',
    finalUtmY: '',
    finalElevation: '',
    finalUtmZone: '',
    horizontalAccuracy: '',
    verticalAccuracy: '',
  })
  const [gcpPhotos, setGcpPhotos] = useState<BmPhotos>({ north: {}, south: {}, east: {}, west: {} })
  const [gcpRinexUrl, setGcpRinexUrl] = useState('')
  const [gcpRinexUploading, setGcpRinexUploading] = useState(false)
  const gcpRinexRef = useRef<HTMLInputElement>(null)
  // ── Coordinate format toggle untuk form Tambah/Edit Titik ──
  const [coordFormat, setCoordFormat] = useState<'latlng' | 'utm'>('latlng')
  const [utmX, setUtmX] = useState('')
  const [utmY, setUtmY] = useState('')
  const [utmZone, setUtmZone] = useState('')
  const [utmConvertError, setUtmConvertError] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['points'],
    queryFn: () => apiClient.get('/points').then(r => r.data.data as Point[]),
  })

  // Fetch surveyors for assign dialog
  const { data: surveyorsData } = useQuery({
    queryKey: ['surveyors-list'],
    queryFn: () => apiClient.get('/users').then(r =>
      (r.data.data as any[]).filter(u => u.role === 'surveyor' && u.isActive)
    ),
  })
  const surveyors: any[] = surveyorsData || []

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useRHForm<PointForm>({
    defaultValues: { pointType: 'GCP' }
  })

  const createMutation = useMutation({
    mutationFn: (newPoint: PointForm) => apiClient.post('/points', newPoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      setDialogOpen(false)
      reset()
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Gagal membuat titik')
  })

  const updateMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<PointForm> }) =>
      apiClient.put(`/points/${code}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      setDialogOpen(false)
      setEditPoint(null)
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Gagal mengupdate titik')
  })

  const deleteMutation = useMutation({
    mutationFn: (code: string) => apiClient.delete(`/points/${code}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      setDeleteConfirm(null)
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Gagal menghapus titik')
  })

  // ── Assign mutation ──
  const assignMutation = useMutation({
    mutationFn: ({ code, surveyorId, scheduledDate }: { code: string; surveyorId: string; scheduledDate?: string }) =>
      apiClient.post(`/points/${code}/assign`, { surveyorId, scheduledDate: scheduledDate || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setAssignPoint(null)
      setAssignSurveyorId('')
      setAssignDate('')
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Gagal assign surveyor')
  })

  // ── BM Direct Input mutation ──
  const bmDirectMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/measurements/bm-direct', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      queryClient.invalidateQueries({ queryKey: ['measurements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      closeBmDialog()
    },
    onError: (e: any) => setBmError(e?.response?.data?.error || 'Gagal menyimpan data BM'),
  })

  // ── GCP Direct Input mutation ──
  const gcpDirectMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/measurements/gcp-direct', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      queryClient.invalidateQueries({ queryKey: ['measurements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      closeGcpDialog()
    },
    onError: (e: any) => setGcpError(e?.response?.data?.error || 'Gagal menyimpan data GCP'),
  })

  // ── GCP Direct Input helpers ──────────────────────────────────────────────
  const openGcpDialog = (p: Point) => {
    setGcpInputPoint(p)
    setGcpStep(0)
    setGcpError('')
    setGcpForm({
      observationDate: '',
      conditionSekitar: '',
      weather: '',
      receiverType: '',
      fieldNotes: '',
      antennaHeight: '',
      startTime: '',
      endTime: '',
      finalUtmX: '',
      finalUtmY: '',
      finalElevation: '',
      finalUtmZone: '',
      horizontalAccuracy: '',
      verticalAccuracy: '',
    })
    setGcpPhotos({ north: {}, south: {}, east: {}, west: {} })
    setGcpRinexUrl('')
    if (gcpRinexRef.current) gcpRinexRef.current.value = ''
  }

  const closeGcpDialog = () => {
    setGcpInputPoint(null)
    setGcpError('')
    setGcpStep(0)
  }

  const uploadGcpPhoto = async (dir: PhotoDir, file: File) => {
    setGcpPhotos(prev => ({ ...prev, [dir]: { ...prev[dir], uploading: true } }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('direction', dir)
      const res = await apiClient.post('/uploads/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url: string = res.data.data.url
      const preview = URL.createObjectURL(file)
      setGcpPhotos(prev => ({ ...prev, [dir]: { url, preview, uploading: false } }))
    } catch (e: any) {
      setGcpPhotos(prev => ({ ...prev, [dir]: { uploading: false } }))
      setGcpError(`Gagal upload foto ${dir}: ${e?.response?.data?.error || e.message}`)
    }
  }

  const uploadGcpRinex = async (file: File) => {
    setGcpRinexUploading(true)
    setGcpError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiClient.post('/uploads/rinex', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setGcpRinexUrl(res.data.data.url)
    } catch (e: any) {
      setGcpError('Gagal upload RINEX: ' + (e?.response?.data?.error || e.message))
    } finally {
      setGcpRinexUploading(false)
    }
  }

  const handleGcpSubmit = () => {
    setGcpError('')
    if (!gcpForm.finalUtmX || !gcpForm.finalUtmY || !gcpForm.finalUtmZone) {
      setGcpError('Koordinat UTM X, Y, dan Zone wajib diisi')
      return
    }
    gcpDirectMutation.mutate({
      pointCode: gcpInputPoint!.pointCode,
      ...gcpForm,
      photoNorthUrl: gcpPhotos.north.url || undefined,
      photoSouthUrl: gcpPhotos.south.url || undefined,
      photoEastUrl:  gcpPhotos.east.url || undefined,
      photoWestUrl:  gcpPhotos.west.url || undefined,
      rinexFileUrl: gcpRinexUrl || undefined,
    })
  }

  const GCP_STEPS = ['Informasi Pengamatan', 'Koordinat Final', 'Foto & Dokumen']

  const toCoord = (val: any): number | undefined => {
    const n = parseFloat(val)
    return isNaN(n) ? undefined : n
  }

  const onSubmit = (d: PointForm) => {
    // Jika mode UTM, konversi dulu sebelum submit
    if (coordFormat === 'utm') {
      const ok = applyUtmConversion()
      if (!ok) return // tampilkan error, jangan submit
      // Setelah konversi, nilai targetLat/Lng sudah di-set via setValue
      // Kita ambil nilai terbaru dari watch
    }
    if (editPoint) {
      updateMutation.mutate({
        code: editPoint.pointCode,
        data: { pointType: d.pointType, targetLat: toCoord(d.targetLat), targetLng: toCoord(d.targetLng) }
      })
    } else {
      createMutation.mutate({ ...d, targetLat: (toCoord(d.targetLat) ?? 0) as number, targetLng: (toCoord(d.targetLng) ?? 0) as number })
    }
  }

  const openEdit = (p: Point) => {
    setEditPoint(p)
    setValue('pointCode', p.pointCode)
    // pointType BM hanya diizinkan untuk create; saat edit BM kita cast ke GCP agar form valid
    setValue('pointType', (p.pointType === 'BM' ? 'GCP' : p.pointType) as 'GCP' | 'ICP')
    setValue('targetLat', p.targetLat ?? 0)
    setValue('targetLng', p.targetLng ?? 0)
    // Reset koordinat toggle ke Lat/Lng saat buka edit
    setCoordFormat('latlng')
    setUtmX(''); setUtmY(''); setUtmZone(''); setUtmConvertError('')
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditPoint(null)
    reset({ pointType: 'GCP', pointCode: '', targetLat: undefined as any, targetLng: undefined as any })
    // Reset koordinat toggle
    setCoordFormat('latlng')
    setUtmX(''); setUtmY(''); setUtmZone(''); setUtmConvertError('')
    setDialogOpen(true)
  }

  // ── Konversi UTM → Lat/Lng dan isi form ─────────────────────────────────
  const applyUtmConversion = () => {
    setUtmConvertError('')
    if (!utmX || !utmY || !utmZone) {
      setUtmConvertError('UTM X, Y, dan Zone wajib diisi')
      return false
    }
    const zone = utmZone.trim().toUpperCase()
    const zoneNum = parseInt(zone)
    if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 60) {
      setUtmConvertError('Nomor zona tidak valid (1–60). Contoh: 49S')
      return false
    }
    const isSouth = zone.endsWith('S')
    const projStr = `+proj=utm +zone=${zoneNum} ${isSouth ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`
    try {
      const [lng, lat] = proj4(projStr, 'WGS84', [parseFloat(utmX), parseFloat(utmY)])
      setValue('targetLat', parseFloat(lat.toFixed(8)))
      setValue('targetLng', parseFloat(lng.toFixed(8)))
      return true
    } catch {
      setUtmConvertError('Konversi gagal — periksa kembali nilai UTM dan zona')
      return false
    }
  }

  const openAssign = (p: Point) => {
    setAssignPoint(p)
    setAssignSurveyorId(p.measurement?.surveyorId || '')
    setAssignDate(p.measurement?.scheduledDate || '')
  }

  // ── BM Direct Input helpers ──────────────────────────────────────────────
  const openBmDialog = (p: Point) => {
    setBmInputPoint(p)
    setBmForm({
      observationDate: '',
      conditionSekitar: '',
      weather: '',
      receiverType: '',
      fieldNotes: '',
      finalUtmX: '',
      finalUtmY: '',
      finalElevation: '',
      finalUtmZone: '',
      horizontalAccuracy: '',
      verticalAccuracy: '',
    })
    setBmPhotos({ north: {}, south: {}, east: {}, west: {} })
    setBmRinexUrl('')
    setBmError('')
    setBmStep(0)
  }

  const closeBmDialog = () => {
    setBmInputPoint(null)
    setBmError('')
    setBmStep(0)
  }

  const uploadBmPhoto = async (dir: PhotoDir, file: File) => {
    setBmPhotos(prev => ({ ...prev, [dir]: { ...prev[dir], uploading: true } }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('direction', dir)
      const res = await apiClient.post('/uploads/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url: string = res.data.data.url
      const preview = URL.createObjectURL(file)
      setBmPhotos(prev => ({ ...prev, [dir]: { url, preview, uploading: false } }))
    } catch (e: any) {
      setBmPhotos(prev => ({ ...prev, [dir]: { uploading: false } }))
      setBmError(`Gagal upload foto ${dir}: ${e?.response?.data?.error || e.message}`)
    }
  }

  const uploadBmRinex = async (file: File) => {
    setBmRinexUploading(true)
    setBmError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiClient.post('/uploads/rinex', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBmRinexUrl(res.data.data.url)
    } catch (e: any) {
      setBmError(`Gagal upload RINEX: ${e?.response?.data?.error || e.message}`)
    } finally {
      setBmRinexUploading(false)
    }
  }

  const handleBmSubmit = () => {
    setBmError('')
    // Validasi step 0 (info)
    if (!bmForm.observationDate) { setBmError('Tanggal pengamatan wajib diisi'); return }
    // Validasi step 1 (koordinat)
    if (!bmForm.finalUtmX || !bmForm.finalUtmY || !bmForm.finalUtmZone) {
      setBmError('Koordinat UTM X, Y, dan Zone wajib diisi'); return
    }
    // Validasi step 2 (foto)
    const missingPhotos = PHOTO_DIRS.filter(d => !bmPhotos[d.key]?.url).map(d => d.label)
    if (missingPhotos.length > 0) {
      setBmError(`Foto berikut belum diupload: ${missingPhotos.join(', ')}`); return
    }

    bmDirectMutation.mutate({
      pointCode: bmInputPoint!.pointCode,
      ...bmForm,
      photoNorthUrl: bmPhotos.north.url,
      photoSouthUrl: bmPhotos.south.url,
      photoEastUrl:  bmPhotos.east.url,
      photoWestUrl:  bmPhotos.west.url,
      rinexFileUrl:  bmRinexUrl || undefined,
    })
  }

  const bmAllPhotosUploaded = PHOTO_DIRS.every(d => !!bmPhotos[d.key]?.url)
  const BM_STEPS = ['Informasi Pengamatan', 'Koordinat Final', 'Dokumentasi Foto']

  const handleImport = async () => {
    const file = importFileRef.current?.files?.[0]
    if (!file) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post('/points/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImportResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['points'] })
    } catch (e: any) {
      setImportResult({ success: false, message: e?.response?.data?.error || 'Import gagal' })
    } finally {
      setImportLoading(false)
    }
  }

  // ── KML handlers ────────────────────────────────────────────────────────
  const parseKmlClient = (kmlText: string): KmlPreviewPoint[] => {
    const points: KmlPreviewPoint[] = []
    const pmMatches = kmlText.match(/<Placemark[\s\S]*?<\/Placemark>/gi) ?? []
    for (const pm of pmMatches) {
      const coordsMatch = pm.match(/<coordinates>\s*([^<]+)\s*<\/coordinates>/i)
      if (!coordsMatch) continue
      const parts = coordsMatch[1].trim().split(',')
      if (parts.length < 2) continue
      const targetLng = parseFloat(parts[0])
      const targetLat = parseFloat(parts[1])
      if (isNaN(targetLat) || isNaN(targetLng)) continue

      const gcpId = pm.match(/<SimpleData\s+name=["']GCP_ID["']>([^<]+)<\/SimpleData>/i)
      const icpId = pm.match(/<SimpleData\s+name=["']ICP_ID["']>([^<]+)<\/SimpleData>/i)
      const bmId  = pm.match(/<SimpleData\s+name=["']BM_ID["']>([^<]+)<\/SimpleData>/i)

      let pointCode = ''
      let pointType: 'GCP' | 'ICP' | 'BM' | null = null
      if (gcpId)      { pointCode = gcpId[1].trim().toUpperCase(); pointType = 'GCP' }
      else if (icpId) { pointCode = icpId[1].trim().toUpperCase(); pointType = 'ICP' }
      else if (bmId)  { pointCode = bmId[1].trim().toUpperCase();  pointType = 'BM'  }

      if (!pointCode || !pointType) continue
      points.push({ pointCode, pointType, targetLat, targetLng })
    }
    return points
  }

  const handleKmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setKmlResult(null)
    if (!file) { setKmlFile(null); setKmlPreview([]); return }
    setKmlFile(file)
    setKmlParsing(true)
    try {
      const text = await file.text()
      const previewed = parseKmlClient(text)
      // Mark which already exist
      const existingCodes = new Set((data || []).map(p => p.pointCode))
      const withExists = previewed.map(p => ({ ...p, exists: existingCodes.has(p.pointCode) }))
      setKmlPreview(withExists)
    } catch {
      setKmlPreview([])
    } finally {
      setKmlParsing(false)
    }
  }

  const handleKmlImport = async () => {
    if (!kmlFile) return
    setKmlImporting(true)
    setKmlResult(null)
    try {
      const formData = new FormData()
      formData.append('file', kmlFile)
      const res = await apiClient.post('/points/import-kml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setKmlResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['points'] })
    } catch (e: any) {
      setKmlResult({ success: false, message: e?.response?.data?.error || 'Import KML gagal' })
    } finally {
      setKmlImporting(false)
    }
  }

  const openKmlDialog = () => {
    setKmlDialog(true)
    setKmlFile(null)
    setKmlPreview([])
    setKmlResult(null)
    if (kmlFileRef.current) kmlFileRef.current.value = ''
  }

  // Filtered & searched
  const filtered = (data || []).filter(p => {
    const matchSearch = p.pointCode.toLowerCase().includes(search.toLowerCase()) ||
      (p.measurement?.surveyor?.name || '').toLowerCase().includes(search.toLowerCase())
    const status = p.measurement?.status || 'unassigned'
    const matchStatus = filterStatus === 'all' || status === filterStatus
    return matchSearch && matchStatus
  })

  const isCanEdit = (p: Point) => !p.measurement || p.measurement.status !== 'approved'

  // Stats
  const total = data?.length || 0
  const unassignedCount = data?.filter(p => !p.measurement || p.measurement.status === 'unassigned').length || 0
  const assignedCount = total - unassignedCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Master Titik</h1>
          <p className="text-sm text-slate-500 mt-1">
            Total <strong>{total}</strong> titik GCP/ICP —&nbsp;
            <span className="text-amber-600 font-medium">{unassignedCount} belum ditugaskan</span>,&nbsp;
            <span className="text-green-600 font-medium">{assignedCount} sudah ditugaskan</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => { setImportDialog(true); setImportResult(null) }}>
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </Button>
          <Button variant="outline" className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={openKmlDialog}>
            <FileCode2 className="w-4 h-4" /> Import KML
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Tambah Titik
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <Filter className="w-4 h-4 text-slate-400 mr-1" />
        {STATUS_FILTER_TABS.map(tab => {
          const count = tab.key === 'all'
            ? total
            : tab.key === 'unassigned'
              ? data?.filter(p => !p.measurement || p.measurement.status === 'unassigned').length || 0
              : data?.filter(p => p.measurement?.status === tab.key).length || 0
          return (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* ── ASSIGN SURVEYOR DIALOG ── */}
      <Dialog open={!!assignPoint} onOpenChange={v => !v && setAssignPoint(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              {assignPoint?.measurement?.surveyorId ? 'Reassign' : 'Assign'} Surveyor — {assignPoint?.pointCode}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-5">
            {/* Info titik */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Tipe Titik</p>
                <p className="font-bold text-slate-800">{assignPoint?.pointType}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Koordinat Target</p>
                <p className="font-mono text-xs text-slate-700">
                  {assignPoint?.targetLat ? `${assignPoint.targetLat?.toFixed(5)}` : '—'}
                </p>
              </div>
            </div>

            {/* Current surveyor info */}
            {assignPoint?.measurement?.surveyorId && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Surveyor saat ini: {assignPoint?.measurement?.surveyor?.name}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Pilih surveyor baru untuk mengalihkan penugasan.</p>
                </div>
              </div>
            )}

            {/* Surveyor select */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Pilih Surveyor <span className="text-red-500">*</span>
              </label>
              {surveyors.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-500 text-center">
                  Belum ada surveyor aktif. Tambah surveyor di Manajemen Pengguna.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {surveyors.map(s => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        assignSurveyorId === s.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="surveyor"
                        value={s.id}
                        checked={assignSurveyorId === s.id}
                        onChange={() => setAssignSurveyorId(s.id)}
                        className="hidden"
                      />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        assignSurveyorId === s.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{s.name}</p>
                        <p className="text-xs text-slate-500 truncate">{s.email}</p>
                      </div>
                      {assignSurveyorId === s.id && (
                        <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Tanggal rencana */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <CalendarDays className="w-4 h-4 inline mr-1.5 text-slate-400" />
                Tanggal Rencana Pengukuran
                <span className="text-slate-400 font-normal ml-1">(opsional)</span>
              </label>
              <input
                type="date"
                value={assignDate}
                onChange={e => setAssignDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              onClick={() => assignPoint && assignMutation.mutate({
                code: assignPoint.pointCode,
                surveyorId: assignSurveyorId,
                scheduledDate: assignDate || undefined
              })}
              loading={assignMutation.isPending}
              disabled={!assignSurveyorId}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <UserCheck className="w-4 h-4" />
              {assignPoint?.measurement?.surveyorId ? 'Assign Ulang' : 'Tugaskan Surveyor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── KML IMPORT DIALOG ── */}
      <Dialog open={kmlDialog} onOpenChange={v => { setKmlDialog(v); if (!v) { setKmlFile(null); setKmlPreview([]); setKmlResult(null) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-emerald-600" />
              Import Titik dari File KML
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Info format */}
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1 border border-slate-200">
              <p className="font-semibold text-slate-800 mb-2">Format KML yang didukung:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                  <p className="font-bold text-blue-700 mb-1">GCP</p>
                  <p className="text-slate-500">Atribut: <code className="bg-white px-1 rounded">GCP_ID</code></p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                  <p className="font-bold text-amber-700 mb-1">ICP</p>
                  <p className="text-slate-500">Atribut: <code className="bg-white px-1 rounded">ICP_ID</code></p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                  <p className="font-bold text-emerald-700 mb-1">BM</p>
                  <p className="text-slate-500">Atribut: <code className="bg-white px-1 rounded">BM_ID</code></p>
                </div>
              </div>
            </div>

            {/* File input */}
            <label className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
              kmlFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400'
            }`}>
              <FileCode2 className={`w-8 h-8 ${kmlFile ? 'text-emerald-500' : 'text-slate-400'}`} />
              <div className="text-center">
                {kmlFile ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700">{kmlFile.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Klik untuk ganti file</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-700">Klik untuk pilih file KML</p>
                    <p className="text-xs text-slate-400 mt-0.5">.kml — maks. 10 MB</p>
                  </>
                )}
              </div>
              <input
                ref={kmlFileRef}
                type="file"
                accept=".kml"
                className="hidden"
                onChange={handleKmlFileChange}
              />
            </label>

            {/* Preview titik */}
            {kmlParsing && (
              <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-sm">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                Membaca file KML...
              </div>
            )}

            {!kmlParsing && kmlPreview.length > 0 && !kmlResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    Preview — <span className="text-emerald-600">{kmlPreview.filter(p => !p.exists).length} titik baru</span>
                    {kmlPreview.filter(p => p.exists).length > 0 && (
                      <span className="text-slate-400 ml-1">({kmlPreview.filter(p => p.exists).length} sudah ada, akan dilewati)</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Kode Titik</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Tipe</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Latitude</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Longitude</th>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {kmlPreview.map((pt, i) => (
                          <tr key={i} className={pt.exists ? 'opacity-40' : ''}>
                            <td className="px-3 py-2 font-mono font-semibold text-slate-800">{pt.pointCode}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pt.pointType === 'GCP' ? 'bg-blue-100 text-blue-700' :
                                pt.pointType === 'ICP' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>{pt.pointType}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500">{pt.targetLat?.toFixed(7)}</td>
                            <td className="px-3 py-2 font-mono text-slate-500">{pt.targetLng?.toFixed(7)}</td>
                            <td className="px-3 py-2">
                              {pt.exists
                                ? <span className="text-slate-400 italic">Sudah ada</span>
                                : <span className="text-emerald-600 font-medium">Baru</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!kmlParsing && kmlFile && kmlPreview.length === 0 && !kmlResult && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Tidak ada titik GCP/ICP/BM yang ditemukan dalam file KML ini.
              </div>
            )}

            {/* Hasil import */}
            {kmlResult && (
              <div className={`rounded-xl p-4 text-sm ${kmlResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {kmlResult.success
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span className={`font-semibold ${kmlResult.success ? 'text-green-700' : 'text-red-700'}`}>{kmlResult.message}</span>
                </div>
                {kmlResult.data && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-green-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-700">{kmlResult.data.created}</p>
                      <p className="text-xs text-green-600">Ditambahkan</p>
                    </div>
                    <div className="text-center bg-slate-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-slate-700">{kmlResult.data.skipped}</p>
                      <p className="text-xs text-slate-500">Dilewati</p>
                    </div>
                    <div className="text-center bg-red-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-red-700">{kmlResult.data.errors?.length || 0}</p>
                      <p className="text-xs text-red-600">Error</p>
                    </div>
                  </div>
                )}
                {kmlResult.data?.errors?.length > 0 && (
                  <div className="mt-3 max-h-28 overflow-y-auto space-y-1">
                    {kmlResult.data.errors.map((e: string, i: number) => (
                      <p key={i} className="text-xs text-red-600">• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Tutup</Button></DialogClose>
            {!kmlResult && (
              <Button
                onClick={handleKmlImport}
                loading={kmlImporting}
                disabled={kmlImporting || kmlParsing || kmlPreview.filter(p => !p.exists).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <FileCode2 className="w-4 h-4" />
                Import {kmlPreview.filter(p => !p.exists).length > 0 ? `${kmlPreview.filter(p => !p.exists).length} Titik` : 'KML'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPORT DIALOG ── */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Titik dari CSV / Excel</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1.5 border border-slate-200">
              <p className="font-semibold text-slate-800 mb-2">Format kolom yang didukung:</p>
              <div className="grid grid-cols-2 gap-1">
                <p><code className="bg-slate-200 px-1 rounded text-xs">point_code</code> / <code className="bg-slate-200 px-1 rounded text-xs">Kode Titik</code> — wajib</p>
                <p><code className="bg-slate-200 px-1 rounded text-xs">point_type</code> / <code className="bg-slate-200 px-1 rounded text-xs">Tipe</code> — GCP/ICP</p>
                <p><code className="bg-slate-200 px-1 rounded text-xs">target_lat</code> / <code className="bg-slate-200 px-1 rounded text-xs">Latitude</code></p>
                <p><code className="bg-slate-200 px-1 rounded text-xs">target_lng</code> / <code className="bg-slate-200 px-1 rounded text-xs">Longitude</code></p>
              </div>
            </div>

            <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer transition-colors">
              <Upload className="w-8 h-8 text-slate-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Klik untuk pilih file</p>
                <p className="text-xs text-slate-400 mt-0.5">.xlsx, .xls, .csv — maks. 5 MB</p>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={() => setImportResult(null)}
              />
            </label>

            {importResult && (
              <div className={`rounded-xl p-4 text-sm ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {importResult.success
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span className={`font-semibold ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>{importResult.message}</span>
                </div>
                {importResult.data && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-green-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-700">{importResult.data.created}</p>
                      <p className="text-xs text-green-600">Ditambahkan</p>
                    </div>
                    <div className="text-center bg-slate-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-slate-700">{importResult.data.skipped}</p>
                      <p className="text-xs text-slate-500">Dilewati</p>
                    </div>
                    <div className="text-center bg-red-100 rounded-lg p-2">
                      <p className="text-lg font-bold text-red-700">{importResult.data.errors?.length || 0}</p>
                      <p className="text-xs text-red-600">Error</p>
                    </div>
                  </div>
                )}
                {importResult.data?.errors?.length > 0 && (
                  <div className="mt-3 max-h-28 overflow-y-auto space-y-1">
                    {importResult.data.errors.map((e: string, i: number) => (
                      <p key={i} className="text-xs text-red-600">• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Tutup</Button></DialogClose>
            <Button onClick={handleImport} loading={importLoading} disabled={importLoading} className="bg-blue-600 hover:bg-blue-700">
              <Upload className="w-4 h-4 mr-1.5" /> Mulai Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE / EDIT DIALOG ── */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setEditPoint(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPoint ? `Edit Titik — ${editPoint.pointCode}` : 'Tambah Master Titik'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Kode Titik</label>
              <Input
                {...register('pointCode', {
                  required: 'Kode titik wajib diisi',
                  pattern: {
                    value: /^(GCP|ICP|BM)-\d{3}$/,
                    message: 'Format: GCP-001, ICP-001, atau BM-001'
                  }
                })}
                placeholder="Contoh: GCP-001"
                className={`mt-1 ${errors.pointCode ? 'border-red-400 focus:ring-red-400' : ''}`}
                disabled={!!editPoint}
              />
              {errors.pointCode && (
                <p className="text-red-500 text-xs mt-1">{errors.pointCode.message}</p>
              )}
              <p className="text-slate-400 text-xs mt-1">Format: GCP-001, ICP-001, atau BM-001</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Tipe</label>
              <select {...register('pointType')} className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="GCP">GCP</option>
                <option value="ICP">ICP</option>
                <option value="BM">BM</option>
              </select>
            </div>

            {/* ── Format Koordinat Toggle ── */}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Koordinat Target</label>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setCoordFormat('latlng'); setUtmConvertError('') }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      coordFormat === 'latlng'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Lat / Lng
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCoordFormat('utm'); setUtmConvertError('') }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      coordFormat === 'utm'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <ArrowLeftRight className="w-3 h-3 inline mr-1" />
                    UTM
                  </button>
                </div>
              </div>

              {/* Mode Lat/Lng */}
              {coordFormat === 'latlng' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Latitude</label>
                    <Input
                      type="number"
                      step="any"
                      {...register('targetLat')}
                      placeholder="-7.65432"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Longitude</label>
                    <Input
                      type="number"
                      step="any"
                      {...register('targetLng')}
                      placeholder="107.76543"
                    />
                  </div>
                </div>
              )}

              {/* Mode UTM */}
              {coordFormat === 'utm' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">UTM X (Easting)</label>
                      <input
                        type="number"
                        step="any"
                        value={utmX}
                        onChange={e => setUtmX(e.target.value)}
                        placeholder="742500.123"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">UTM Y (Northing)</label>
                      <input
                        type="number"
                        step="any"
                        value={utmY}
                        onChange={e => setUtmY(e.target.value)}
                        placeholder="9178900.456"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Zona UTM</label>
                      <input
                        type="text"
                        value={utmZone}
                        onChange={e => setUtmZone(e.target.value)}
                        placeholder="49S"
                        className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">Format zona: nomor + hemisphere. Contoh: <span className="font-mono bg-slate-100 px-1 rounded">49S</span>, <span className="font-mono bg-slate-100 px-1 rounded">48S</span>, <span className="font-mono bg-slate-100 px-1 rounded">50N</span></p>

                  {/* Error konversi */}
                  {utmConvertError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {utmConvertError}
                    </div>
                  )}

                  {/* Tombol konversi + preview hasil */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={applyUtmConversion}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      Konversi ke Lat/Lng
                    </button>
                    {/* Preview hasil */}
                    {(watch('targetLat') || watch('targetLng')) && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono">
                          {watch('targetLat')?.toFixed(6)}, {watch('targetLng')?.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {editPoint ? 'Simpan Perubahan' : 'Simpan Titik'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM DIALOG ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Hapus Titik</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <Trash2 className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">{deleteConfirm?.pointCode}</p>
                <p className="text-sm text-slate-600 mt-0.5">Titik ini akan dihapus permanen dari sistem.</p>
              </div>
            </div>
            {/* Peringatan ekstra jika titik sudah approved */}
            {deleteConfirm?.measurement?.status === 'approved' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  <strong>Peringatan:</strong> Titik ini sudah berstatus <strong>Approved</strong>.
                  Seluruh data pengukuran, foto, dan koordinat final akan ikut terhapus dan <strong>tidak dapat dipulihkan</strong>.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.pointCode)}
              loading={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TABLE ── */}
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode titik atau nama surveyor..."
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Titik</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Koordinat Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Surveyor</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead className="text-right min-w-[180px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const status = p.measurement?.status || 'unassigned'
                  const canEdit = isCanEdit(p)
                  const hasAssigned = !!(p.measurement?.surveyorId)
                  return (
                    <TableRow key={p.id} className="group">
                      <TableCell className="font-semibold text-slate-800">{p.pointCode}</TableCell>
                      <TableCell>
                        <Badge variant={p.pointType === 'GCP' ? 'primary' : p.pointType === 'ICP' ? 'warning' : 'success'}>{p.pointType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-slate-500">
                          {p.targetLat
                            ? <>{p.targetLat.toFixed(5)}, {p.targetLng?.toFixed(5)}</>
                            : <span className="text-slate-300">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          status === 'approved' ? 'success' :
                          status === 'retake' ? 'danger' :
                          status === 'progress' ? 'warning' :
                          status === 'review' ? 'primary' : 'gray'
                        }>
                          {status === 'unassigned' ? 'Unassigned'
                            : status === 'progress' ? 'In Progress'
                            : status === 'review' ? 'Under Review'
                            : status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {p.measurement?.surveyor?.name
                          ? <span className="font-medium">{p.measurement.surveyor.name}</span>
                          : <span className="text-slate-300 italic">Belum ditugaskan</span>}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {p.measurement?.scheduledDate
                          ? format(new Date(p.measurement.scheduledDate), 'dd MMM yyyy')
                          : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Tombol Input Data BM — khusus titik BM yang belum approved */}
                          {p.pointType === 'BM' && status !== 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openBmDialog(p)}
                              className="gap-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Input Data BM
                            </Button>
                          )}
                          {/* Assign / Reassign button — tidak ditampilkan untuk BM (gunakan Input Data BM) */}
                          {/* Tombol Input Data GCP/ICP — untuk GCP/ICP yang belum approved */}
                          {(p.pointType === 'GCP' || p.pointType === 'ICP') && status !== 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGcpDialog(p)}
                              className="gap-1 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                            >
                              <Target className="w-3.5 h-3.5" />
                              Input Koordinat
                            </Button>
                          )}
                          {p.pointType !== 'BM' && status !== 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssign(p)}
                              className={`gap-1 text-xs ${
                                hasAssigned
                                  ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                                  : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              {hasAssigned ? 'Reassign' : 'Assign'}
                            </Button>
                          )}
                          {/* Edit button — only unassigned, non-BM */}
                          {canEdit && p.pointType !== 'BM' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(p)}
                              className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 gap-1 text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>
                          )}
                          {/* Edit BM — tetap bisa edit kode/koordinat jika unassigned */}
                          {canEdit && p.pointType === 'BM' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(p)}
                              className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 gap-1 text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {/* Delete button — super_admin dapat hapus status apapun */}
                          {user?.role === 'super_admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirm(p)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 border-red-100 hover:border-red-200 gap-1 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {status === 'approved' && p.pointType !== 'BM' && (
                            <span className="text-xs text-slate-400 italic px-2">Selesai ✓</span>
                          )}
                          {status === 'approved' && p.pointType === 'BM' && (
                            <span className="text-xs text-emerald-600 italic px-2 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> BM Approved
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <MapPin className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">Tidak ada titik ditemukan</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer info */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>Menampilkan {filtered.length} dari {total} titik</span>
            {filterStatus !== 'all' && (
              <button onClick={() => setFilterStatus('all')} className="text-blue-500 hover:text-blue-700 font-medium">
                Reset filter
              </button>
            )}
          </div>
        )}
      </Card>

      {/* ── GCP/ICP DIRECT INPUT DIALOG ── */}
      <Dialog open={!!gcpInputPoint} onOpenChange={v => { if (!v) closeGcpDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">Input Koordinat Final {gcpInputPoint?.pointType}</p>
                <p className="text-xs font-normal text-slate-500 mt-0.5">{gcpInputPoint?.pointCode}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center gap-0 mt-1 mb-4">
            {GCP_STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < gcpStep ? 'bg-blue-500 text-white' :
                    i === gcpStep ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {i < gcpStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                    i === gcpStep ? 'text-blue-700' : i < gcpStep ? 'text-blue-500' : 'text-slate-400'
                  }`}>{label}</span>
                </div>
                {i < GCP_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < gcpStep ? 'bg-blue-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Error banner */}
          {gcpError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{gcpError}</span>
              <button onClick={() => setGcpError('')} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── STEP 0: Informasi Pengamatan ── */}
          {gcpStep === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                <p>Isi informasi tanggal dan detail pengamatan lapangan.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    <CalendarDays className="w-4 h-4 inline mr-1 text-slate-400" />
                    Tanggal Pengamatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={gcpForm.observationDate}
                    onChange={e => setGcpForm(f => ({ ...f, observationDate: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tinggi Antena (m)</label>
                  <input
                    type="number"
                    step="any"
                    value={gcpForm.antennaHeight}
                    onChange={e => setGcpForm(f => ({ ...f, antennaHeight: e.target.value }))}
                    placeholder="1.645"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Waktu Mulai</label>
                  <input
                    type="time"
                    value={gcpForm.startTime}
                    onChange={e => setGcpForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Waktu Selesai</label>
                  <input
                    type="time"
                    value={gcpForm.endTime}
                    onChange={e => setGcpForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipe Receiver GPS</label>
                  <input
                    type="text"
                    value={gcpForm.receiverType}
                    onChange={e => setGcpForm(f => ({ ...f, receiverType: e.target.value }))}
                    placeholder="Trimble R10"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cuaca</label>
                  <input
                    type="text"
                    value={gcpForm.weather}
                    onChange={e => setGcpForm(f => ({ ...f, weather: e.target.value }))}
                    placeholder="Cerah, Berawan, ..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kondisi Sekitar</label>
                <input
                  type="text"
                  value={gcpForm.conditionSekitar}
                  onChange={e => setGcpForm(f => ({ ...f, conditionSekitar: e.target.value }))}
                  placeholder="Terbuka, dekat jalan, ..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Lapangan</label>
                <textarea
                  value={gcpForm.fieldNotes}
                  onChange={e => setGcpForm(f => ({ ...f, fieldNotes: e.target.value }))}
                  placeholder="Deskripsi lokasi, kondisi fisik, keterangan tambahan..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── STEP 1: Koordinat Final ── */}
          {gcpStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                <p>Masukkan koordinat hasil olahan post-processing. Sistem akan otomatis mengkonversi UTM ke Lat/Lng.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Zona UTM <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={gcpForm.finalUtmZone}
                  onChange={e => setGcpForm(f => ({ ...f, finalUtmZone: e.target.value }))}
                  placeholder="Contoh: 48S"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Format: nomor zona + hemisphere (N/S). Contoh: 48S, 49S, 50N</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    UTM X (Easting) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={gcpForm.finalUtmX}
                    onChange={e => setGcpForm(f => ({ ...f, finalUtmX: e.target.value }))}
                    placeholder="742500.123"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    UTM Y (Northing) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={gcpForm.finalUtmY}
                    onChange={e => setGcpForm(f => ({ ...f, finalUtmY: e.target.value }))}
                    placeholder="9178900.456"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Elevasi / Ketinggian (m)</label>
                <input
                  type="number"
                  step="any"
                  value={gcpForm.finalElevation}
                  onChange={e => setGcpForm(f => ({ ...f, finalElevation: e.target.value }))}
                  placeholder="125.500"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Akurasi Horizontal (m)</label>
                  <input
                    type="number"
                    step="any"
                    value={gcpForm.horizontalAccuracy}
                    onChange={e => setGcpForm(f => ({ ...f, horizontalAccuracy: e.target.value }))}
                    placeholder="0.015"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Akurasi Vertikal (m)</label>
                  <input
                    type="number"
                    step="any"
                    value={gcpForm.verticalAccuracy}
                    onChange={e => setGcpForm(f => ({ ...f, verticalAccuracy: e.target.value }))}
                    placeholder="0.025"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Upload RINEX opsional — dipindah ke step 2 */}
            </div>
          )}

          {/* ── STEP 2: Foto & Dokumen ── */}
          {gcpStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                <Camera className="w-4 h-4 shrink-0" />
                <p>Upload foto dokumentasi dari <strong>4 arah mata angin</strong> (opsional). File RINEX juga bersifat opsional.</p>
              </div>

              {/* Grid foto 4 arah */}
              <div className="grid grid-cols-2 gap-3">
                {PHOTO_DIRS.map(({ key, label, icon }) => {
                  const photo = gcpPhotos[key]
                  return (
                    <label
                      key={key}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                        photo.url
                          ? 'border-blue-400 bg-blue-50'
                          : photo.uploading
                          ? 'border-slate-300 bg-slate-50'
                          : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                      style={{ minHeight: '140px' }}
                    >
                      {photo.preview ? (
                        <div className="relative w-full h-36">
                          <img src={photo.preview} alt={label} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-xs font-bold text-center">{icon} {label}</p>
                          </div>
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          {/* Tombol hapus foto */}
                          <button
                            type="button"
                            onClick={e => { e.preventDefault(); setGcpPhotos(prev => ({ ...prev, [key]: {} })) }}
                            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : photo.uploading ? (
                        <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs">Mengupload...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold">{icon}</div>
                          <p className="text-sm font-semibold text-slate-600">{label}</p>
                          <p className="text-[11px] text-slate-400">Tap untuk upload</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/heic,image/webp"
                        className="hidden"
                        disabled={photo.uploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadGcpPhoto(key, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )
                })}
              </div>

              {/* Status foto */}
              <div className="flex items-center gap-2 flex-wrap">
                {PHOTO_DIRS.map(({ key, label }) => (
                  <div key={key} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                    gcpPhotos[key]?.url ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {gcpPhotos[key]?.url ? <CheckCircle2 className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                    {label}
                  </div>
                ))}
              </div>

              {/* Upload RINEX opsional */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  File RINEX <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                {gcpRinexUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-blue-700 font-medium flex-1 truncate">File RINEX terupload</span>
                    <button
                      onClick={() => { setGcpRinexUrl(''); if (gcpRinexRef.current) gcpRinexRef.current.value = '' }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer transition-colors">
                    {gcpRinexUploading
                      ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      : <Upload className="w-5 h-5 text-slate-400" />
                    }
                    <div>
                      <p className="text-sm text-slate-600 font-medium">
                        {gcpRinexUploading ? 'Mengupload RINEX...' : 'Klik untuk upload RINEX'}
                      </p>
                      <p className="text-xs text-slate-400">.zip, .rar, .obs, .nav, .rnx — maks. 100 MB</p>
                    </div>
                    <input
                      ref={gcpRinexRef}
                      type="file"
                      accept=".zip,.rar,.obs,.nav,.rnx,.txt"
                      className="hidden"
                      disabled={gcpRinexUploading}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadGcpRinex(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}



          {/* Footer navigasi */}
          <DialogFooter className="mt-6 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={closeGcpDialog}>Batal</Button>
              </DialogClose>
              {gcpStep > 0 && (
                <Button variant="outline" onClick={() => { setGcpError(''); setGcpStep(s => s - 1) }}>
                  ← Kembali
                </Button>
              )}
            </div>
            <div>
              {gcpStep < 2 ? (
                <Button
                  onClick={() => {
                    setGcpError('')
                    if (gcpStep === 0 && !gcpForm.observationDate) {
                      setGcpError('Tanggal pengamatan wajib diisi')
                      return
                    }
                    if (gcpStep === 1 && (!gcpForm.finalUtmX || !gcpForm.finalUtmY || !gcpForm.finalUtmZone)) {
                      setGcpError('Koordinat UTM X, Y, dan Zone wajib diisi')
                      return
                    }
                    setGcpStep(s => s + 1)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  Lanjut →
                </Button>
              ) : (
                <Button
                  onClick={handleGcpSubmit}
                  loading={gcpDirectMutation.isPending}
                  disabled={gcpDirectMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan &amp; Setujui {gcpInputPoint?.pointType}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BM DIRECT INPUT DIALOG ── */}
      <Dialog open={!!bmInputPoint} onOpenChange={v => { if (!v) closeBmDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ClipboardList className="w-4.5 h-4.5 text-emerald-700" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">Input Data BM Existing</p>
                <p className="text-xs font-normal text-slate-500 mt-0.5">{bmInputPoint?.pointCode}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center gap-0 mt-1 mb-4">
            {BM_STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < bmStep ? 'bg-emerald-500 text-white' :
                    i === bmStep ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {i < bmStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                    i === bmStep ? 'text-emerald-700' : i < bmStep ? 'text-emerald-500' : 'text-slate-400'
                  }`}>{label}</span>
                </div>
                {i < BM_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < bmStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Error banner */}
          {bmError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{bmError}</span>
              <button onClick={() => setBmError('')} className="ml-auto shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── STEP 0: Informasi Pengamatan ── */}
          {bmStep === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
                <Info className="w-4 h-4 shrink-0" />
                <p>Isi informasi tanggal dan deskripsi lapangan. Tinggi alat dan waktu pengamatan <strong>tidak diperlukan</strong> untuk input BM existing.</p>
              </div>

              {/* Tanggal pengamatan — WAJIB */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  <CalendarDays className="w-4 h-4 inline mr-1 text-slate-400" />
                  Tanggal Pengamatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bmForm.observationDate}
                  onChange={e => setBmForm(f => ({ ...f, observationDate: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipe Receiver GPS</label>
                  <input
                    type="text"
                    value={bmForm.receiverType}
                    onChange={e => setBmForm(f => ({ ...f, receiverType: e.target.value }))}
                    placeholder="Contoh: Trimble R10"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cuaca</label>
                  <input
                    type="text"
                    value={bmForm.weather}
                    onChange={e => setBmForm(f => ({ ...f, weather: e.target.value }))}
                    placeholder="Cerah, Berawan, ..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kondisi Sekitar</label>
                <input
                  type="text"
                  value={bmForm.conditionSekitar}
                  onChange={e => setBmForm(f => ({ ...f, conditionSekitar: e.target.value }))}
                  placeholder="Terbuka, dekat jalan, ..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan Lapangan</label>
                <textarea
                  value={bmForm.fieldNotes}
                  onChange={e => setBmForm(f => ({ ...f, fieldNotes: e.target.value }))}
                  placeholder="Deskripsi BM, kondisi fisik, keterangan tambahan..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── STEP 1: Koordinat Final ── */}
          {bmStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                <p>Masukkan koordinat hasil olahan (post-processing). Sistem akan otomatis mengkonversi UTM ke Lat/Lng.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Zona UTM <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bmForm.finalUtmZone}
                  onChange={e => setBmForm(f => ({ ...f, finalUtmZone: e.target.value }))}
                  placeholder="Contoh: 49S"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Format: nomor zona + hemisphere (N/S). Contoh: 49S, 48S, 50N</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    UTM X (Easting) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={bmForm.finalUtmX}
                    onChange={e => setBmForm(f => ({ ...f, finalUtmX: e.target.value }))}
                    placeholder="742500.123"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    UTM Y (Northing) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={bmForm.finalUtmY}
                    onChange={e => setBmForm(f => ({ ...f, finalUtmY: e.target.value }))}
                    placeholder="9178900.456"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Elevasi / Ketinggian (m)</label>
                <input
                  type="number"
                  step="any"
                  value={bmForm.finalElevation}
                  onChange={e => setBmForm(f => ({ ...f, finalElevation: e.target.value }))}
                  placeholder="125.500"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Akurasi Horizontal (m)</label>
                  <input
                    type="number"
                    step="any"
                    value={bmForm.horizontalAccuracy}
                    onChange={e => setBmForm(f => ({ ...f, horizontalAccuracy: e.target.value }))}
                    placeholder="0.015"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Akurasi Vertikal (m)</label>
                  <input
                    type="number"
                    step="any"
                    value={bmForm.verticalAccuracy}
                    onChange={e => setBmForm(f => ({ ...f, verticalAccuracy: e.target.value }))}
                    placeholder="0.025"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Dokumentasi Foto ── */}
          {bmStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                <Camera className="w-4 h-4 shrink-0" />
                <p>Upload foto dokumentasi dari <strong>4 arah mata angin</strong>. File RINEX bersifat opsional.</p>
              </div>

              {/* Grid foto 4 arah */}
              <div className="grid grid-cols-2 gap-3">
                {PHOTO_DIRS.map(({ key, label, icon }) => {
                  const photo = bmPhotos[key]
                  return (
                    <label
                      key={key}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                        photo.url
                          ? 'border-emerald-400 bg-emerald-50'
                          : photo.uploading
                          ? 'border-slate-300 bg-slate-50'
                          : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                      style={{ minHeight: '140px' }}
                    >
                      {photo.preview ? (
                        <div className="relative w-full h-36">
                          <img src={photo.preview} alt={label} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-xs font-bold text-center">{icon} {label}</p>
                          </div>
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : photo.uploading ? (
                        <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs">Mengupload...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold">{icon}</div>
                          <p className="text-sm font-semibold text-slate-600">{label}</p>
                          <p className="text-[11px] text-slate-400">Tap untuk upload <span className="text-red-500">*</span></p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/heic,image/webp"
                        className="hidden"
                        disabled={photo.uploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) uploadBmPhoto(key, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )
                })}
              </div>

              {/* Status foto */}
              <div className="flex items-center gap-2">
                {PHOTO_DIRS.map(({ key, label }) => (
                  <div key={key} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                    bmPhotos[key]?.url ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {bmPhotos[key]?.url ? <CheckCircle2 className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                    {label}
                  </div>
                ))}
              </div>

              {/* Upload RINEX opsional */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  File RINEX <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                {bmRinexUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-blue-700 font-medium flex-1 truncate">File RINEX terupload</span>
                    <button
                      onClick={() => { setBmRinexUrl(''); if (bmRinexRef.current) bmRinexRef.current.value = '' }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer transition-colors">
                    {bmRinexUploading
                      ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                      : <Upload className="w-5 h-5 text-slate-400" />
                    }
                    <div>
                      <p className="text-sm text-slate-600 font-medium">
                        {bmRinexUploading ? 'Mengupload RINEX...' : 'Klik untuk upload RINEX'}
                      </p>
                      <p className="text-xs text-slate-400">.zip, .rar, .obs, .nav, .rnx — maks. 100 MB</p>
                    </div>
                    <input
                      ref={bmRinexRef}
                      type="file"
                      accept=".zip,.rar,.obs,.nav,.rnx,.txt"
                      className="hidden"
                      disabled={bmRinexUploading}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadBmRinex(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Footer navigasi */}
          <DialogFooter className="mt-6 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" onClick={closeBmDialog}>Batal</Button>
              </DialogClose>
              {bmStep > 0 && (
                <Button variant="outline" onClick={() => { setBmError(''); setBmStep(s => s - 1) }}>
                  ← Kembali
                </Button>
              )}
            </div>
            <div>
              {bmStep < 2 ? (
                <Button
                  onClick={() => {
                    setBmError('')
                    if (bmStep === 0 && !bmForm.observationDate) {
                      setBmError('Tanggal pengamatan wajib diisi')
                      return
                    }
                    if (bmStep === 1 && (!bmForm.finalUtmX || !bmForm.finalUtmY || !bmForm.finalUtmZone)) {
                      setBmError('Koordinat UTM X, Y, dan Zone wajib diisi')
                      return
                    }
                    setBmStep(s => s + 1)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  Lanjut →
                </Button>
              ) : (
                <Button
                  onClick={handleBmSubmit}
                  loading={bmDirectMutation.isPending}
                  disabled={!bmAllPhotosUploaded || bmDirectMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan & Setujui BM
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
