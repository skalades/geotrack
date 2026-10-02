'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Printer, MapPin, Wrench, Edit3, Loader2, FileDown, CalendarDays, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import apiClient from '@/lib/utils/api-client'
import { useAuthStore } from '@/store/auth.store'
import { usePdfGenerator } from '@/hooks/usePdfGenerator'
import { PointReportTemplate } from '@/components/pdf/PointReportTemplate'
import 'leaflet/dist/leaflet.css'

import dynamic from 'next/dynamic'
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
import L from 'leaflet'

// Nama Project Manager tetap
const PM_NAME = 'HERDI PEBRYANA'

const defaultIcon = typeof window !== 'undefined' ? new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
}) : null

export default function PointDetailsPage() {
  const { pointCode } = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const { ref: pdfRef, generating, generate } = usePdfGenerator(`GeoTrack-${pointCode}.pdf`)
  
  const [editModal, setEditModal] = useState(false)
  const [mapSnapshot, setMapSnapshot] = useState<string | undefined>()
  const [formData, setFormData] = useState({
    finalUtmX: '', finalUtmY: '', finalElevation: '', finalUtmZone: '48S',
    startTime: '', endTime: '',
    horizontalAccuracy: '', verticalAccuracy: '',
    antennaHeight: '',
    // Field khusus BM
    observationDate: '',
    observationDuration: '',
  })

  const { data: measurement, isLoading } = useQuery({
    queryKey: ['measurement', pointCode],
    queryFn: async () => {
      const res = await apiClient.get('/measurements')
      const m = res.data.data.find((x: any) => x.pointCode === pointCode)
      if (!m) throw new Error('Data tidak ditemukan')
      return m
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.post(`/measurements/${measurement?.id}/metadata`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurement', pointCode] })
      setEditModal(false)
    }
  })

  const isBM = measurement?.targetPoint?.pointType === 'BM'

  useEffect(() => {
    if (measurement) {
      const toLocalDT = (d: any) => {
        if (!d) return ''
        const date = new Date(d)
        if (isNaN(date.getTime())) return ''
        const yyyy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        const hh = String(date.getHours()).padStart(2, '0')
        const mins = String(date.getMinutes()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}T${hh}:${mins}`
      }

      setFormData({
        finalUtmX: measurement.finalUtmX?.toString() || '',
        finalUtmY: measurement.finalUtmY?.toString() || '',
        finalElevation: measurement.finalElevation?.toString() || '',
        finalUtmZone: measurement.finalUtmZone || '48S',
        startTime: toLocalDT(measurement.startTime),
        endTime: toLocalDT(measurement.endTime),
        horizontalAccuracy: measurement.horizontalAccuracy?.toString() || '',
        verticalAccuracy: measurement.verticalAccuracy?.toString() || '',
        antennaHeight: measurement.antennaHeight?.toString() || '',
        observationDate: measurement.observationDate || '',
        observationDuration: '',
      })
    }
  }, [measurement])

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
  }

  if (!measurement) {
    return <div className="p-8 text-center text-slate-500">Data tidak ditemukan</div>
  }

  const handlePrint = () => {
    window.print()
  }

  const lat = measurement.finalLat || measurement.targetPoint?.targetLat
  const lng = measurement.finalLng || measurement.targetPoint?.targetLng

  /**
   * Generate map snapshot (ESRI satellite tiles via proxy → canvas → data URL) then capture PDF.
   * Doing this in two steps ensures the template re-renders with the map image
   * before html-to-image captures it.
   */
  const handleDownloadPdf = async () => {
    if (generating) return
    try {
      if (lat && lng) {
        const { generateMapSnapshot } = await import('@/lib/utils/map-snapshot')
        const snapshot = await generateMapSnapshot(lat, lng)
        setMapSnapshot(snapshot)
        // Give React enough time to re-render the template with the satellite map image
        await new Promise(r => setTimeout(r, 500))
      }
    } catch (e) {
      console.warn('Map snapshot failed, generating PDF without map:', e)
    }
    generate()
  }

  const toDMS = (dd?: number, isLat?: boolean) => {
    if (typeof dd !== 'number') return '-'
    const dir = dd < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E')
    const absDd = Math.abs(dd)
    const d = Math.floor(absDd)
    const m = Math.floor((absDd - d) * 60)
    const s = ((absDd - d - m / 60) * 3600).toFixed(4)
    return `${d}°${m}'${s}"${dir}`
  }

  // Hitung durasi dari startTime/endTime
  const calcDuration = () => {
    if (!measurement.startTime || !measurement.endTime) return null
    const mins = Math.round((new Date(measurement.endTime).getTime() - new Date(measurement.startTime).getTime()) / 60000)
    return mins >= 60 ? `${Math.floor(mins/60)} jam ${mins%60} mnt` : `${mins} menit`
  }

  // Format tanggal pengamatan BM (dari observationDate atau startTime)
  const formatObservationDate = () => {
    const dateStr = measurement.observationDate || (measurement.startTime ? measurement.startTime.split('T')[0] : null)
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 print:p-0 print:m-0 print:max-w-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 uppercase">DESKRIPSI {measurement.targetPoint?.pointType || 'GCP'}</h1>
          <p className="text-slate-500 font-medium">
            {isBM ? 'Bench Mark Reference' : 'Ground Control Point Reference'} #{pointCode}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handlePrint} className="bg-white">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button
            onClick={handleDownloadPdf}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FileDown className="w-4 h-4 mr-2" /> {generating ? 'Generating...' : 'Download PDF'}
          </Button>
          {user?.role === 'super_admin' && (
            <Button onClick={() => setEditModal(true)} className="bg-black text-white hover:bg-gray-800">
              <Edit3 className="w-4 h-4 mr-2" /> Edit Metadata
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Lokasi & Deskripsi */}
          <Card className="p-6 border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-sm">LOKASI & DESKRIPSI</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Koordinat Target Awal</p>
                <p className="text-sm font-semibold text-slate-800">
                  {measurement.targetPoint?.targetLat}, {measurement.targetPoint?.targetLng}
                </p>
              </div>
              <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                <p className="text-xs text-blue-700 font-medium mb-1">Deskripsi Tambahan</p>
                <p className="text-sm text-slate-700 italic">
                  "{measurement.conditionSekitar || 'Tidak ada catatan lingkungan.'}"
                </p>
              </div>
              {/* Catatan lapangan — tampilkan jika ada */}
              {measurement.fieldNotes && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium mb-1">Catatan Lapangan</p>
                  <p className="text-sm text-slate-700">{measurement.fieldNotes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Alat Survey — tampilan berbeda untuk BM vs GCP/ICP */}
          <Card className="p-6 border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-sm">ALAT SURVEY</h3>
            </div>

            {isBM ? (
              /* ── Tampilan khusus BM ── */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Tipe Unit</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">GNSS</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Alat</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{measurement.receiverType || '-'}</p>
                </div>

                {/* Tanggal Pengamatan (bukan waktu jam) */}
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-medium mb-1">
                    <CalendarDays className="w-3 h-3 inline mr-1 text-slate-400" />
                    Tanggal Pengamatan
                  </p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{formatObservationDate()}</p>
                </div>

                {/* Surveyor — tampilkan nama PM tanpa label jabatan */}
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-medium mb-1">Surveyor</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{PM_NAME}</p>
                </div>

              </div>
            ) : (
              /* ── Tampilan GCP / ICP (existing) ── */
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Tipe Unit</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">GNSS</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Alat</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{measurement.receiverType || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Waktu Akuisisi</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">
                    {measurement.startTime ? new Date(measurement.startTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Waktu Pengamatan</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">
                    {measurement.startTime ? new Date(measurement.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} - {measurement.endTime ? new Date(measurement.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Durasi Pengamatan</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">
                    {calcDuration() || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Surveyor</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{measurement.surveyor?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Tinggi Antena</p>
                  <p className="text-sm font-semibold text-slate-800 uppercase">{measurement.antennaHeight ? `${measurement.antennaHeight} m` : '-'}</p>
                </div>

              </div>
            )}
          </Card>
        </div>

        {/* Right Column (Koordinat & Peta) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl">
            <div className="bg-[#1e293b] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5 opacity-70"><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/></div>
                <h3 className="font-semibold text-sm">KOORDINAT GEODETIK & UTM</h3>
              </div>
              <Badge className="bg-blue-500 text-white hover:bg-blue-600 border-0">WGS 84</Badge>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Sistem</th>
                    <th className="px-6 py-3">East ( X ) / Lng</th>
                    <th className="px-6 py-3">North ( Y ) / Lat</th>
                    <th className="px-6 py-3 text-right">Elevasi ( Z )</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-600">Geodetic</td>
                    <td className="px-6 py-4 text-slate-700 font-mono">{toDMS(measurement.finalLng || measurement.targetPoint?.targetLng, false)}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono">{toDMS(measurement.finalLat || measurement.targetPoint?.targetLat, true)}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-right">{measurement.finalElevation ? `${measurement.finalElevation.toFixed(3)} m` : '-'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-600">UTM {measurement.finalUtmZone ? `(${measurement.finalUtmZone})` : ''}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono">{measurement.finalUtmX ? measurement.finalUtmX.toFixed(3) : '-'}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono">{measurement.finalUtmY ? measurement.finalUtmY.toFixed(3) : '-'}</td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-right">{measurement.finalElevation ? `${measurement.finalElevation.toFixed(3)} m` : '-'}</td>
                  </tr>
                  {(measurement.horizontalAccuracy != null || measurement.verticalAccuracy != null) && (
                    <tr className="bg-blue-50/40">
                      <td className="px-6 py-3 font-bold text-blue-600 text-xs">AKURASI</td>
                      <td className="px-6 py-3" colSpan={2}>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-500">↔ Horizontal:</span>
                          <span className="font-mono font-semibold text-sm text-blue-700">
                            {measurement.horizontalAccuracy != null ? `${measurement.horizontalAccuracy.toFixed(3)} m` : '-'}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-xs text-slate-500">↕ Vertikal:</span>
                          <span className="font-mono font-semibold text-sm text-blue-700">
                            {measurement.verticalAccuracy != null ? `${measurement.verticalAccuracy.toFixed(3)} m` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">HRMS / VRMS</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-100 px-6 py-2 text-right text-xs text-slate-500 border-t border-slate-200">
              Data Final (Processed from RINEX)
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl">
            <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-700 text-sm">LOKASI {measurement.targetPoint?.pointType} (VISUAL CONTEXT)</h3>
              </div>
            </div>
            <div className="h-64 w-full bg-slate-200 relative z-0">
              {lat && lng && defaultIcon ? (
                <MapContainer center={[lat, lng]} zoom={18} style={{ height: '100%', width: '100%' }} className="z-0">
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    attribution="Google Satellite"
                  />
                  <Marker position={[lat, lng]} icon={defaultIcon} />
                </MapContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">Peta tidak tersedia</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Foto 4 Arah */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl print:break-inside-avoid">
        <div className="bg-slate-50 px-6 py-3 flex items-center gap-2 border-b border-slate-200">
          <div className="w-4 h-4 border-2 border-slate-400 rounded-sm" />
          <h3 className="font-semibold text-slate-700 text-sm">FOTO {measurement.targetPoint?.pointType} (ORIENTATION VIEWS)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { url: measurement.photoNorthUrl, label: 'UTARA', bearing: '0° N' },
              { url: measurement.photoEastUrl, label: 'TIMUR', bearing: '90° E' },
              { url: measurement.photoSouthUrl, label: 'SELATAN', bearing: '180° S' },
              { url: measurement.photoWestUrl, label: 'BARAT', bearing: '270° W' }
            ].map((photo, i) => (
              <div key={i} className="relative aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden group border border-slate-200 shadow-sm">
                {photo.url ? (
                  <img src={photo.url} alt={photo.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <span className="text-xs">Tidak ada foto</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                  <p className="font-bold text-sm tracking-wide">{photo.label}</p>
                  <p className="text-[10px] text-slate-300">Bearing: {photo.bearing}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Edit Metadata Modal — konten berbeda untuk BM vs GCP/ICP */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Metadata — {measurement.targetPoint?.pointType} {pointCode}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault()
            updateMutation.mutate(formData)
          }} className="space-y-4">
            {/* Koordinat — sama untuk semua tipe */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">UTM Easting (X)</label>
                <Input value={formData.finalUtmX} onChange={e => setFormData({ ...formData, finalUtmX: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">UTM Northing (Y)</label>
                <Input value={formData.finalUtmY} onChange={e => setFormData({ ...formData, finalUtmY: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Elevasi (Z) m</label>
                <Input value={formData.finalElevation} onChange={e => setFormData({ ...formData, finalElevation: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Zona UTM</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={formData.finalUtmZone}
                  onChange={e => setFormData({ ...formData, finalUtmZone: e.target.value })}
                >
                  {['47N','47S','48N','48S','49N','49S','50N','50S','51N','51S'].map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>

            {isBM ? (
              /* ── Form khusus BM: Tanggal + Durasi + Tinggi Antena ── */
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pengamatan BM</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-slate-400" /> Tanggal Pengamatan
                    </label>
                    <Input
                      type="date"
                      value={formData.observationDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setFormData({ ...formData, observationDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" /> Durasi Pengamatan
                    </label>
                    <Input
                      placeholder="Contoh: 2 jam 30 menit"
                      value={formData.observationDuration}
                      onChange={e => setFormData({ ...formData, observationDuration: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tinggi Antena (m)</label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Cth: 1.850"
                      value={formData.antennaHeight}
                      onChange={e => setFormData({ ...formData, antennaHeight: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Form GCP/ICP: Waktu Mulai/Selesai + Tinggi Antena ── */
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Waktu Pengamatan</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Waktu Mulai</label>
                    <Input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Waktu Selesai</label>
                    <Input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Akurasi — sama untuk semua tipe */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Akurasi Pengukuran</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">↔ Horizontal (m)</label>
                  <Input
                    type="number" step="0.001" min="0" placeholder="Cth: 0.025"
                    value={formData.horizontalAccuracy}
                    onChange={e => setFormData({ ...formData, horizontalAccuracy: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">↕ Vertikal (m)</label>
                  <Input
                    type="number" step="0.001" min="0" placeholder="Cth: 0.045"
                    value={formData.verticalAccuracy}
                    onChange={e => setFormData({ ...formData, verticalAccuracy: e.target.value })}
                  />
                </div>
                {/* Tinggi Antena hanya di GCP/ICP (BM sudah ada di atas) */}
                {!isBM && (
                  <div className="space-y-1 col-span-2 mt-2">
                    <label className="text-sm font-medium">Tinggi Antena (m)</label>
                    <Input
                      type="number" step="0.001" min="0" placeholder="Cth: 1.850"
                      value={formData.antennaHeight}
                      onChange={e => setFormData({ ...formData, antennaHeight: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Akurasi adalah Nilai HRMS / VRMS.</p>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Batal</Button>
              </DialogClose>
              <Button type="submit" loading={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">Simpan Final</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template — off-screen, captured by html2canvas */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', zIndex: -1 }}>
        <PointReportTemplate ref={pdfRef} measurement={measurement} mapSnapshot={mapSnapshot} />
      </div>
    </div>
  )
}
