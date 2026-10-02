'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck, Search, CheckCircle2, RotateCcw, AlertCircle,
  ExternalLink, UserCheck
} from 'lucide-react'
import Link from 'next/link'
import apiClient from '@/lib/utils/api-client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { format } from 'date-fns'

export default function MeasurementsValidationPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedM, setSelectedM] = useState<any>(null)
  const [reviewDialog, setReviewDialog] = useState(false)
  const [reassignDialog, setReassignDialog] = useState(false)
  const [reassignTarget, setReassignTarget] = useState<any>(null)
  const [retakeReason, setRetakeReason] = useState('')
  const [reassignSurveyorId, setReassignSurveyorId] = useState('')
  const [reassignDate, setReassignDate] = useState('')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['measurements'],
    queryFn: () => apiClient.get('/measurements').then(r => r.data.data),
  })

  const { data: surveyorsData } = useQuery({
    queryKey: ['surveyors-list'],
    queryFn: () => apiClient.get('/users').then(r =>
      (r.data.data as any[]).filter(u => u.role === 'surveyor' && u.isActive)
    ),
  })
  const surveyors: any[] = surveyorsData || []

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/measurements/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setReviewDialog(false)
    }
  })

  const retakeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number, reason: string }) =>
      apiClient.post(`/measurements/${id}/retake`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setReviewDialog(false)
      setRetakeReason('')
    }
  })

  const reassignMutation = useMutation({
    mutationFn: ({ code, surveyorId, scheduledDate }: { code: string; surveyorId: string; scheduledDate?: string }) =>
      apiClient.post(`/points/${code}/assign`, { surveyorId, scheduledDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setReassignDialog(false)
      setReassignTarget(null)
      setReassignSurveyorId('')
      setReassignDate('')
    },
    onError: (e: any) => alert(e?.response?.data?.error || 'Gagal reassign')
  })

  const STATUS_TABS = [
    { key: 'all', label: 'Semua' },
    { key: 'review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'retake', label: 'Retake' },
    { key: 'progress', label: 'In Progress' },
  ]

  const filtered = (data || []).filter((m: any) => {
    const matchSearch = m.pointCode.toLowerCase().includes(search.toLowerCase()) ||
      m.surveyor?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || m.status === filterStatus
    return matchSearch && matchStatus
  })

  const openReassign = (m: any) => {
    setReassignTarget(m)
    setReassignSurveyorId(m.surveyorId || '')
    setReassignDate(m.scheduledDate || '')
    setReassignDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Validasi Pengukuran</h1>
          <p className="text-sm text-slate-500 mt-1">Antrean review dan persetujuan data dari surveyor</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => {
          const count = tab.key === 'all' ? (data?.length || 0) : (data?.filter((m: any) => m.status === tab.key).length || 0)
          return (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode titik atau surveyor..."
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Titik</TableHead>
                  <TableHead>Surveyor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Terakhir Update</TableHead>
                  <TableHead>Retake</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold text-slate-800">{m.pointCode}</TableCell>
                    <TableCell>{m.surveyor?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        m.status === 'approved' ? 'success' :
                        m.status === 'retake' ? 'danger' :
                        m.status === 'progress' ? 'warning' :
                        m.status === 'review' ? 'primary' : 'default'
                      }>
                        {m.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {m.updatedAt ? format(new Date(m.updatedAt), 'dd MMM yyyy, HH:mm') : '-'}
                    </TableCell>
                    <TableCell>
                      {m.retakeCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                          <RotateCcw className="w-3 h-3" /> {m.retakeCount}x
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {m.status === 'review' && (
                          <Button
                            size="sm"
                            onClick={() => { setSelectedM(m); setReviewDialog(true) }}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Review
                          </Button>
                        )}
                        {/* Reassign button - available for progress & retake */}
                        {(m.status === 'progress' || m.status === 'retake') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReassign(m)}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Reassign
                          </Button>
                        )}
                        <Link href={`/points/${m.pointCode}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" /> Detail
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Tidak ada data ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── REVIEW DIALOG ── */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedM?.status === 'review' ? 'Review Pengukuran' : 'Detail Pengukuran'} {selectedM?.pointCode}
            </DialogTitle>
          </DialogHeader>
          {selectedM && (
            <div className="py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 font-medium">Surveyor</p>
                  <p className="font-semibold text-slate-800">{selectedM.surveyor?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Tinggi Antena</p>
                  <p className="font-semibold text-slate-800">{selectedM.antennaHeight || '-'} m</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Waktu Pengamatan</p>
                  <p className="font-semibold text-slate-800">
                    {selectedM.startTime ? format(new Date(selectedM.startTime), 'HH:mm') : '-'} s/d {selectedM.endTime ? format(new Date(selectedM.endTime), 'HH:mm') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Kondisi Sekitar</p>
                  <p className="font-semibold text-slate-800">{selectedM.conditionSekitar || '-'}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-slate-500 font-medium text-xs mb-2">Dokumentasi Foto (Preview)</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { url: selectedM.photoNorthUrl, label: 'Utara' },
                    { url: selectedM.photoSouthUrl, label: 'Selatan' },
                    { url: selectedM.photoEastUrl, label: 'Timur' },
                    { url: selectedM.photoWestUrl, label: 'Barat' }
                  ].map((photo, i) => (
                    photo.url ? (
                      <div key={i} className="relative h-24 rounded-md overflow-hidden border border-slate-200 group">
                        <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-0.5 text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {photo.label}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="h-24 bg-slate-100 rounded-md border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <span>Tidak ada</span>
                        <span>{photo.label}</span>
                      </div>
                    )
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">File RINEX</span>
                  {selectedM.rinexFileUrl ? (
                    <a
                      href={selectedM.rinexFileUrl}
                      download={`${selectedM.pointCode}.${selectedM.rinexFileUrl.split('.').pop()?.toUpperCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        Download RINEX
                      </Button>
                    </a>
                  ) : (
                    <Badge variant="danger">Tidak Ada</Badge>
                  )}
                </div>
              </div>

              {selectedM.status === 'review' && (
                <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                    <AlertCircle className="w-4 h-4" /> Tolak & Minta Retake
                  </div>
                  <Input
                    value={retakeReason}
                    onChange={e => setRetakeReason(e.target.value)}
                    placeholder="Alasan retake (Wajib jika menolak)..."
                    className="bg-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!retakeReason || retakeMutation.isPending}
                    onClick={() => retakeMutation.mutate({ id: selectedM.id, reason: retakeReason })}
                    className="w-full text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                  >
                    Kirim Perintah Retake
                  </Button>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{selectedM.status === 'review' ? 'Batal' : 'Tutup'}</Button>
                </DialogClose>
                {selectedM.status === 'review' && (
                  <Button
                    onClick={() => approveMutation.mutate(selectedM.id)}
                    loading={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Setujui Data
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── REASSIGN DIALOG ── */}
      <Dialog open={reassignDialog} onOpenChange={v => { setReassignDialog(v); if (!v) setReassignTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Titik — {reassignTarget?.pointCode}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
              <p className="font-medium">Surveyor saat ini: {reassignTarget?.surveyor?.name || '-'}</p>
              <p className="text-xs mt-0.5 text-amber-600">Pilih surveyor baru untuk mengambil alih titik ini.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Surveyor Baru</label>
              <select
                value={reassignSurveyorId}
                onChange={e => setReassignSurveyorId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">-- Pilih Surveyor --</option>
                {surveyors.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Tanggal Rencana (opsional)</label>
              <input
                type="date"
                value={reassignDate}
                onChange={e => setReassignDate(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              onClick={() => reassignMutation.mutate({
                code: reassignTarget.pointCode,
                surveyorId: reassignSurveyorId,
                scheduledDate: reassignDate || undefined,
              })}
              loading={reassignMutation.isPending}
              disabled={!reassignSurveyorId}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <UserCheck className="w-4 h-4 mr-1.5" /> Assign Ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
