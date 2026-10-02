import React from 'react'
import { MapPin, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PM_NAME = 'HERDI PEBRYANA'

const toDMS = (dd?: number, isLat?: boolean) => {
  if (typeof dd !== 'number') return '-'
  const dir = dd < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E')
  const absDd = Math.abs(dd)
  const d = Math.floor(absDd)
  const m = Math.floor((absDd - d) * 60)
  const s = ((absDd - d - m / 60) * 3600).toFixed(4)
  return `${d}°${m}'${s}"${dir}`
}

const calcDuration = (startTime: any, endTime: any) => {
  if (!startTime || !endTime) return '-'
  const mins = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
  return mins >= 60 ? `${Math.floor(mins/60)}j ${mins%60}m` : `${mins} mnt`
}

const formatObsDate = (observationDate: any, startTime: any) => {
  const dateStr = observationDate || (startTime ? startTime.split('T')[0] : null)
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface PointReportTemplateProps {
  measurement: any
  id?: string
  /** Pre-rendered map data URL (from generateMapSnapshot utility). If provided,
   *  shown as a static image — avoids cross-origin canvas taint from live tile layers. */
  mapSnapshot?: string
}

export const PointReportTemplate = React.forwardRef<HTMLDivElement, PointReportTemplateProps>(({ measurement, id, mapSnapshot }, ref) => {
  if (!measurement) return null

  const lat = measurement.finalLat || measurement.targetPoint?.targetLat
  const lng = measurement.finalLng || measurement.targetPoint?.targetLng
  const isBM = measurement.targetPoint?.pointType === 'BM'

  return (
    <div 
      ref={ref}
      id={id}
      className="bg-slate-50 text-slate-900" 
      style={{ width: '794px', minHeight: '1123px', padding: '32px', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800 uppercase">DESKRIPSI {measurement.targetPoint?.pointType || 'GCP'}</h1>
        <p className="text-slate-500 font-medium">
          {isBM ? 'Bench Mark Reference' : 'Ground Control Point Reference'} #{measurement.pointCode}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Left Column */}
        <div className="space-y-6 col-span-1">
          {/* Lokasi & Deskripsi */}
          <Card className="p-4 border border-slate-200 shadow-sm rounded-xl bg-white">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-xs">LOKASI & DESKRIPSI</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1">Koordinat Target Awal</p>
                <p className="text-xs font-semibold text-slate-800">
                  {measurement.targetPoint?.targetLat}, {measurement.targetPoint?.targetLng}
                </p>
              </div>
              <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                <p className="text-[10px] text-blue-700 font-medium mb-1">Deskripsi Tambahan</p>
                <p className="text-xs text-slate-700 italic">
                  "{measurement.conditionSekitar || 'Tidak ada catatan lingkungan.'}"
                </p>
              </div>
              {measurement.fieldNotes && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-medium mb-1">Catatan Lapangan</p>
                  <p className="text-xs text-slate-700">{measurement.fieldNotes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Alat Survey — berbeda untuk BM vs GCP/ICP */}
          <Card className="p-4 border border-slate-200 shadow-sm rounded-xl bg-white">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-xs">ALAT SURVEY</h3>
            </div>

            {isBM ? (
              /* ── BM: Tanggal Pengamatan, Durasi, Tinggi Antena, Surveyor = PM ── */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Tipe Unit</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">GNSS</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Alat</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">{measurement.receiverType || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Tanggal Pengamatan</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">
                    {formatObsDate(measurement.observationDate, measurement.startTime)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Surveyor</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">{PM_NAME}</p>
                </div>

              </div>
            ) : (
              /* ── GCP / ICP: layout lama ── */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Tipe Unit</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">GNSS</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Alat</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">{measurement.receiverType || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Waktu Akuisisi</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">
                    {measurement.startTime ? new Date(measurement.startTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Waktu Pengamatan</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">
                    {measurement.startTime ? new Date(measurement.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'} - {measurement.endTime ? new Date(measurement.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Durasi</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">
                    {calcDuration(measurement.startTime, measurement.endTime)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">Surveyor</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">{measurement.surveyor?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium mb-0.5">T. Antena</p>
                  <p className="text-xs font-semibold text-slate-800 uppercase">{measurement.antennaHeight ? `${measurement.antennaHeight}m` : '-'}</p>
                </div>
              </div>
            )}
          </Card>
        </div>


        {/* Right Column (Koordinat & Peta) */}
        <div className="col-span-2 space-y-6">
          <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl bg-white">
            <div className="bg-[#1e293b] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 grid grid-cols-2 gap-0.5 opacity-70"><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/><div className="bg-white rounded-sm"/></div>
                <h3 className="font-semibold text-xs">KOORDINAT GEODETIK & UTM</h3>
              </div>
              <Badge className="bg-blue-500 text-white border-0 text-[10px] py-0 h-4">WGS 84</Badge>
            </div>
            
            <div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2">Sistem</th>
                    <th className="px-4 py-2">East ( X ) / Lng</th>
                    <th className="px-4 py-2">North ( Y ) / Lat</th>
                    <th className="px-4 py-2 text-right">Elevasi ( Z )</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-bold text-blue-600">Geodetic</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{toDMS(measurement.finalLng || measurement.targetPoint?.targetLng, false)}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{toDMS(measurement.finalLat || measurement.targetPoint?.targetLat, true)}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-right">{measurement.finalElevation ? `${measurement.finalElevation.toFixed(3)} m` : '-'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-bold text-blue-600">UTM {measurement.finalUtmZone ? `(${measurement.finalUtmZone})` : ''}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{measurement.finalUtmX ? measurement.finalUtmX.toFixed(3) : '-'}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{measurement.finalUtmY ? measurement.finalUtmY.toFixed(3) : '-'}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-right">{measurement.finalElevation ? `${measurement.finalElevation.toFixed(3)} m` : '-'}</td>
                  </tr>
                  {(measurement.horizontalAccuracy != null || measurement.verticalAccuracy != null) && (
                    <tr style={{ backgroundColor: '#eff6ff' }}>
                      <td className="px-4 py-2 font-bold text-blue-600 text-[10px]">AKURASI</td>
                      <td className="px-4 py-2" colSpan={2}>
                        <span className="text-[10px] text-slate-500">↔ H: </span>
                        <span className="font-mono font-semibold text-xs text-blue-700">{measurement.horizontalAccuracy != null ? `${Number(measurement.horizontalAccuracy).toFixed(3)} m` : '-'}</span>
                        <span className="text-slate-300 mx-2">|</span>
                        <span className="text-[10px] text-slate-500">↕ V: </span>
                        <span className="font-mono font-semibold text-xs text-blue-700">{measurement.verticalAccuracy != null ? `${Number(measurement.verticalAccuracy).toFixed(3)} m` : '-'}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-[9px] text-slate-400 uppercase">HRMS / VRMS</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-100 px-4 py-1.5 text-right text-[10px] text-slate-500 border-t border-slate-200">
              Data Final (Processed from RINEX)
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl bg-white">
            <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-slate-400" />
                <h3 className="font-semibold text-slate-700 text-xs">LOKASI {measurement.targetPoint?.pointType} (VISUAL CONTEXT)</h3>
              </div>
              <span className="text-[9px] text-slate-400">© Esri, Maxar, Earthstar Geographics</span>
            </div>
            <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
              {mapSnapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mapSnapshot}
                  alt="Map lokasi"
                  className="w-full h-full object-cover"
                />
              ) : lat && lng ? (
                /* Fallback: koordinat teks jika snapshot belum tersedia */
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50">
                  <MapPin className="w-5 h-5 text-slate-300" />
                  <p className="text-xs font-mono text-slate-400">
                    {typeof lat === 'number' ? lat.toFixed(6) : lat},{' '}
                    {typeof lng === 'number' ? lng.toFixed(6) : lng}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                  Peta tidak tersedia
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Foto 4 Arah */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-xl bg-white">
        <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
          <div className="w-3 h-3 border-2 border-slate-400 rounded-sm" />
          <h3 className="font-semibold text-slate-700 text-xs">FOTO {measurement.targetPoint?.pointType} (ORIENTATION VIEWS)</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { url: measurement.photoNorthUrl, label: 'UTARA', bearing: '0° N' },
              { url: measurement.photoEastUrl, label: 'TIMUR', bearing: '90° E' },
              { url: measurement.photoSouthUrl, label: 'SELATAN', bearing: '180° S' },
              { url: measurement.photoWestUrl, label: 'BARAT', bearing: '270° W' }
            ].map((photo, i) => (
              <div key={i} className="relative aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden group border border-slate-200 shadow-sm">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <span className="text-[10px]">Tidak ada foto</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                  <p className="font-bold text-xs tracking-wide">{photo.label}</p>
                  <p className="text-[8px] text-slate-300">Bearing: {photo.bearing}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
})

PointReportTemplate.displayName = 'PointReportTemplate'
