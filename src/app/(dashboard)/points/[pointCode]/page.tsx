'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Printer, MapPin, Wrench, Edit3, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import apiClient from '@/lib/utils/api-client'
import { useAuthStore } from '@/store/auth.store'
import 'leaflet/dist/leaflet.css'

import dynamic from 'next/dynamic'
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
import L from 'leaflet'

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
  
  const [editModal, setEditModal] = useState(false)
  const [formData, setFormData] = useState({ finalUtmX: '', finalUtmY: '', finalElevation: '', finalUtmZone: '48S' })

  const { data: measurement, isLoading } = useQuery({
    queryKey: ['measurement', pointCode],
    queryFn: async () => {
      // Find the measurement with this pointCode
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

  useEffect(() => {
    if (measurement) {
      setFormData({
        finalUtmX: measurement.finalUtmX?.toString() || '',
        finalUtmY: measurement.finalUtmY?.toString() || '',
        finalElevation: measurement.finalElevation?.toString() || '',
        finalUtmZone: measurement.finalUtmZone || '48S'
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

  const toDMS = (dd?: number, isLat?: boolean) => {
    if (typeof dd !== 'number') return '-'
    const dir = dd < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E')
    const absDd = Math.abs(dd)
    const d = Math.floor(absDd)
    const m = Math.floor((absDd - d) * 60)
    const s = ((absDd - d - m / 60) * 3600).toFixed(4)
    return `${d}°${m}'${s}"${dir}`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 print:p-0 print:m-0 print:max-w-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 uppercase">DESKRIPSI {measurement.targetPoint?.pointType || 'GCP'}</h1>
          <p className="text-slate-500 font-medium">Ground Control Point Reference #{pointCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handlePrint} className="bg-white">
            <Printer className="w-4 h-4 mr-2" /> Print Report
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
            </div>
          </Card>

          {/* Alat Survey */}
          <Card className="p-6 border border-slate-200 shadow-sm rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-sm">ALAT SURVEY</h3>
            </div>
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
                  {measurement.startTime ? new Date(measurement.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} - {measurement.endTime ? new Date(measurement.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Durasi Pengamatan</p>
                <p className="text-sm font-semibold text-slate-800 uppercase">
                  {measurement.startTime && measurement.endTime 
                    ? (() => {
                        const mins = Math.round((new Date(measurement.endTime).getTime() - new Date(measurement.startTime).getTime()) / 60000)
                        return mins >= 60 ? `${Math.floor(mins/60)} jam ${mins%60} mnt` : `${mins} menit`
                      })()
                    : '-'}
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

      {/* Edit Metadata Modal */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Koordinat Final (Processed)</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => {
            e.preventDefault()
            updateMutation.mutate(formData)
          }} className="space-y-4">
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
                  <option value="47N">47N</option>
                  <option value="47S">47S</option>
                  <option value="48N">48N</option>
                  <option value="48S">48S</option>
                  <option value="49N">49N</option>
                  <option value="49S">49S</option>
                  <option value="50N">50N</option>
                  <option value="50S">50S</option>
                  <option value="51N">51N</option>
                  <option value="51S">51S</option>
                </select>
              </div>
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
    </div>
  )
}
