'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MapPin, Plus, Search, Upload, Pencil, Trash2,
  UserCheck, CheckCircle, AlertCircle, CalendarDays,
  Filter, Users
} from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useForm as useRHForm } from 'react-hook-form'
import { format } from 'date-fns'

type Point = {
  id: number
  pointCode: string
  pointType: 'GCP' | 'ICP'
  targetLat: number | null
  targetLng: number | null
  measurement: {
    status: string
    surveyorId?: string
    surveyor?: { name: string }
    scheduledDate?: string
  } | null
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

export default function MasterPointsPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPoint, setEditPoint] = useState<Point | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Point | null>(null)
  const [importDialog, setImportDialog] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  // ── Assign dialog state ──
  const [assignPoint, setAssignPoint] = useState<Point | null>(null)
  const [assignSurveyorId, setAssignSurveyorId] = useState('')
  const [assignDate, setAssignDate] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
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

  const { register, handleSubmit, reset, setValue } = useRHForm<PointForm>({
    defaultValues: { pointType: 'GCP' }
  })

  const createMutation = useMutation({
    mutationFn: (newPoint: PointForm) => apiClient.post('/points', newPoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      setDialogOpen(false)
      reset()
    }
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

  const onSubmit = (d: PointForm) => {
    if (editPoint) {
      updateMutation.mutate({
        code: editPoint.pointCode,
        data: { pointType: d.pointType, targetLat: Number(d.targetLat) || undefined, targetLng: Number(d.targetLng) || undefined }
      })
    } else {
      createMutation.mutate({ ...d, targetLat: Number(d.targetLat), targetLng: Number(d.targetLng) })
    }
  }

  const openEdit = (p: Point) => {
    setEditPoint(p)
    setValue('pointCode', p.pointCode)
    setValue('pointType', p.pointType)
    setValue('targetLat', p.targetLat ?? 0)
    setValue('targetLng', p.targetLng ?? 0)
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditPoint(null)
    reset({ pointType: 'GCP', pointCode: '', targetLat: undefined as any, targetLng: undefined as any })
    setDialogOpen(true)
  }

  const openAssign = (p: Point) => {
    setAssignPoint(p)
    setAssignSurveyorId(p.measurement?.surveyorId || '')
    setAssignDate(p.measurement?.scheduledDate || '')
  }

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

  // Filtered & searched
  const filtered = (data || []).filter(p => {
    const matchSearch = p.pointCode.toLowerCase().includes(search.toLowerCase()) ||
      (p.measurement?.surveyor?.name || '').toLowerCase().includes(search.toLowerCase())
    const status = p.measurement?.status || 'unassigned'
    const matchStatus = filterStatus === 'all' || status === filterStatus
    return matchSearch && matchStatus
  })

  const isCanEdit = (p: Point) => !p.measurement || p.measurement.status === 'unassigned'

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
              <Input {...register('pointCode', { required: true })} placeholder="Contoh: GCP-001" className="mt-1" disabled={!!editPoint} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Tipe</label>
              <select {...register('pointType')} className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <option value="GCP">GCP</option>
                <option value="ICP">ICP</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Latitude Target</label>
                <Input type="number" step="any" {...register('targetLat')} placeholder="-7.65432" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Longitude Target</label>
                <Input type="number" step="any" {...register('targetLng')} placeholder="107.76543" className="mt-1" />
              </div>
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
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <Trash2 className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">{deleteConfirm?.pointCode}</p>
                <p className="text-sm text-slate-600 mt-0.5">Titik ini akan dihapus permanen dari sistem.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.pointCode)}
              loading={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus
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
                        <Badge variant={p.pointType === 'GCP' ? 'primary' : 'warning'}>{p.pointType}</Badge>
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
                          {/* Assign / Reassign button — always visible */}
                          {status !== 'approved' && (
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
                          {/* Edit button — only unassigned */}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(p)}
                              className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 gap-1 text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>
                          )}
                          {/* Delete button — only unassigned */}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirm(p)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 border-red-100 hover:border-red-200 gap-1 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {status === 'approved' && (
                            <span className="text-xs text-slate-400 italic px-2">Selesai ✓</span>
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
    </div>
  )
}
