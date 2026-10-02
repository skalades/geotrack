'use client'
// src/app/(surveyor)/input/page.tsx — Form Input Pengukuran (3-step stepper) + Simpan Draft

import { useState, useRef, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Check, Upload, Camera, X,
  AlertTriangle, CheckCircle2, Loader2, MapPin, Send, Save, FileText
} from 'lucide-react'
import { measurementFormSchema, MeasurementFormInput } from '@/lib/validations'
import { DIRECTION_LABELS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import apiClient from '@/lib/utils/api-client'

const STEPS = ['Data Titik', 'Kondisi Teknis', 'Upload Dokumen']
const DRAFT_KEY_PREFIX = 'geotrack_draft_'

type PhotoDirection = 'north' | 'south' | 'east' | 'west'
type Photos = Record<PhotoDirection, { file?: File; url?: string; preview?: string; exif?: { lat?: number; lng?: number } }>

interface DraftData {
  formData: Partial<MeasurementFormInput>
  photoUrls: Record<PhotoDirection, string | undefined>
  rinexUrl?: string
  savedAt: string
  step: number
}

function InputPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const defaultCode = searchParams.get('code') ?? ''
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<Photos>({ north: {}, south: {}, east: {}, west: {} })
  const [rinex, setRinex] = useState<{ file?: File; url?: string }>({})
  const [uploadingPhoto, setUploadingPhoto] = useState<PhotoDirection | null>(null)
  const [uploadingRinex, setUploadingRinex] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [hasDraft, setHasDraft] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: pointsRes } = useQuery({
    queryKey: ['my-tasks-points'],
    queryFn: () => apiClient.get('/measurements/my?status=progress&limit=100').then(r => r.data.data),
  })
  const myPoints: any[] = pointsRes ?? []

  const { register, handleSubmit, watch, setValue, trigger, reset, formState: { errors } } = useForm<MeasurementFormInput>({
    resolver: zodResolver(measurementFormSchema),
    defaultValues: { pointCode: defaultCode },
  })

  const currentPointCode = watch('pointCode')

  // ── Load draft on mount / point code change ──
  useEffect(() => {
    const code = currentPointCode || defaultCode
    if (!code) return
    const key = DRAFT_KEY_PREFIX + code
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const draft: DraftData = JSON.parse(raw)
        setHasDraft(true)
        setShowDraftBanner(true)
      } catch {}
    } else {
      setHasDraft(false)
      setShowDraftBanner(false)
    }
  }, [currentPointCode, defaultCode])

  const loadDraft = () => {
    const code = currentPointCode || defaultCode
    if (!code) return
    const key = DRAFT_KEY_PREFIX + code
    const raw = localStorage.getItem(key)
    if (!raw) return
    try {
      const draft: DraftData = JSON.parse(raw)
      // Restore form values
      Object.entries(draft.formData).forEach(([k, v]) => {
        if (v !== undefined && v !== null) setValue(k as keyof MeasurementFormInput, v as any)
      })
      // Restore photo previews (URLs only, no File objects)
      const restoredPhotos: Photos = { north: {}, south: {}, east: {}, west: {} }
      ;(['north', 'south', 'east', 'west'] as PhotoDirection[]).forEach(dir => {
        if (draft.photoUrls[dir]) {
          restoredPhotos[dir] = { url: draft.photoUrls[dir], preview: draft.photoUrls[dir] }
        }
      })
      setPhotos(restoredPhotos)
      if (draft.rinexUrl) setRinex({ url: draft.rinexUrl })
      setStep(draft.step || 0)
      setShowDraftBanner(false)
    } catch {}
  }

  const saveDraft = () => {
    const code = currentPointCode || defaultCode
    if (!code) return
    const formData = watch()
    const photoUrls: Record<PhotoDirection, string | undefined> = {
      north: photos.north.url,
      south: photos.south.url,
      east: photos.east.url,
      west: photos.west.url,
    }
    const draft: DraftData = {
      formData,
      photoUrls,
      rinexUrl: rinex.url,
      savedAt: new Date().toISOString(),
      step,
    }
    localStorage.setItem(DRAFT_KEY_PREFIX + code, JSON.stringify(draft))
    setHasDraft(true)
    alert(`Draft tersimpan untuk ${code}`)
  }

  const deleteDraft = (code?: string) => {
    const c = code || currentPointCode || defaultCode
    if (c) {
      localStorage.removeItem(DRAFT_KEY_PREFIX + c)
      setHasDraft(false)
      setShowDraftBanner(false)
    }
  }

  // Save mutation (step 2)
  const saveMutation = useMutation({
    mutationFn: (data: MeasurementFormInput) => apiClient.post('/measurements', data),
    onError: (e: any) => {
      alert('Gagal menyimpan data teknis: ' + (e?.response?.data?.error || 'Kesalahan server'))
    }
  })

  // Submit mutation (step 3)
  const submitMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: any }) =>
      apiClient.post(`/measurements/${id}/submit`, payload),
    onSuccess: () => {
      // Delete draft on successful submit
      deleteDraft()
      qc.invalidateQueries({ queryKey: ['my-tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      router.push('/tasks')
    },
    onError: (e: any) => setSubmitError(e?.response?.data?.error ?? 'Terjadi kesalahan saat submit'),
  })

  const uploadPhoto = async (direction: PhotoDirection, file: File) => {
    setUploadingPhoto(direction)
    try {
      const preview = URL.createObjectURL(file)
      let exif: { lat?: number; lng?: number } = {}
      try {
        const exifr = (await import('exifr')).default
        const exifData = await exifr.parse(file, { gps: true })
        if (exifData?.latitude && exifData?.longitude) {
          exif = { lat: exifData.latitude, lng: exifData.longitude }
        }
      } catch {}

      const formData = new FormData()
      formData.append('file', file)
      formData.append('direction', direction)
      const res = await apiClient.post('/uploads/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPhotos(prev => ({ ...prev, [direction]: { file, url: res.data.data.url, preview, exif } }))
    } catch (e) {
      console.error('Upload photo error:', e)
    } finally {
      setUploadingPhoto(null)
    }
  }

  const uploadRinex = async (file: File) => {
    setUploadingRinex(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiClient.post('/uploads/rinex', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRinex({ file, url: res.data.data.url })
    } catch (e: any) {
      alert('Gagal upload RINEX: ' + (e.response?.data?.error || 'Kesalahan server'))
    } finally {
      setUploadingRinex(false)
    }
  }

  const allPhotosUploaded = Object.values(photos).every(p => !!p.url)
  const allReady = allPhotosUploaded

  const onStepNext = async () => {
    if (step === 0) {
      const isValid = await trigger(['pointCode'])
      if (isValid) setStep(1)
    } else if (step === 1) {
      const isValid = await trigger(['antennaHeight', 'conditionSekitar', 'weather', 'receiverType', 'fieldNotes', 'horizontalAccuracy', 'verticalAccuracy'])
      if (isValid) {
        await saveMutation.mutateAsync(watch() as MeasurementFormInput)
        setStep(2)
      }
    }
  }

  const handleFinalSubmit = async () => {
    const measurement = await apiClient.get(`/measurements/my?search=${watch('pointCode')}&limit=1`)
    const m = measurement.data.data?.[0]
    if (!m) { setSubmitError('Pengukuran tidak ditemukan'); return }

    const payload = {
      photoNorthUrl: photos.north.url,
      photoSouthUrl: photos.south.url,
      photoEastUrl: photos.east.url,
      photoWestUrl: photos.west.url,
      rinexFileUrl: rinex.url,
      horizontalAccuracy: watch('horizontalAccuracy') ?? null,
      verticalAccuracy: watch('verticalAccuracy') ?? null,
    }

    submitMutation.mutate({ id: m.id, payload })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-10 pb-4 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-800">Input Pengukuran</h1>
            <p className="text-xs text-slate-500">Langkah {step + 1} dari 3</p>
          </div>
          {/* Save Draft button */}
          {currentPointCode && (
            <button
              onClick={saveDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Draft
            </button>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-4 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map((s, i) => (
            <span key={s} className={`text-[10px] font-medium ${i === step ? 'text-blue-600' : 'text-slate-400'}`}>{s}</span>
          ))}
        </div>
      </div>

      {/* Draft Banner */}
      {showDraftBanner && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Ada draft tersimpan</p>
            <p className="text-xs text-amber-600">Lanjutkan dari data yang sudah diisi sebelumnya?</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadDraft}
              className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold"
            >
              Lanjutkan
            </button>
            <button
              onClick={() => { setShowDraftBanner(false); deleteDraft() }}
              className="px-2.5 py-1 bg-white border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold"
            >
              Hapus
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4">
        {/* ===== STEP 0: Data Titik ===== */}
        <div className={step === 0 ? 'block' : 'hidden'}>
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" /> Metadata Titik
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Titik <span className="text-red-500">*</span></label>
                <select
                  {...register('pointCode')}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                >
                  <option value="">-- Pilih Kode Titik --</option>
                  {myPoints.map((p: any) => (
                    <option key={p.pointCode} value={p.pointCode}>
                      {p.pointCode} {p.scheduledDate ? `· ${p.scheduledDate}` : ''}
                    </option>
                  ))}
                </select>
                {errors.pointCode && <p className="text-red-500 text-xs mt-1">{errors.pointCode.message}</p>}
              </div>
            </div>
            <Button type="button" onClick={onStepNext} fullWidth size="lg" className="mt-6">
              Lanjut <ChevronRight className="w-4 h-4" />
            </Button>
          </Card>
        </div>

        {/* ===== STEP 1: Kondisi Teknis ===== */}
        <div className={step === 1 ? 'block' : 'hidden'}>
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">📡 Kondisi Teknis</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tinggi Antena (m) <span className="text-red-500">*</span>
                </label>
                <input type="number" step="0.001" min="0.001" max="9.999"
                  placeholder="Contoh: 1.732"
                  {...register('antennaHeight', { valueAsNumber: true })}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" />
                {errors.antennaHeight && <p className="text-red-500 text-xs mt-1">{errors.antennaHeight.message}</p>}
              </div>

              {/* Akurasi Horizontal & Vertikal */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Akurasi Pengukuran
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">(opsional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-slate-500 font-medium">↔ Horizontal (m)</span>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Cth: 0.025"
                      {...register('horizontalAccuracy', { valueAsNumber: true })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {errors.horizontalAccuracy && (
                      <p className="text-red-500 text-xs mt-1">{errors.horizontalAccuracy.message}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-slate-500 font-medium">↕ Vertikal (m)</span>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Cth: 0.045"
                      {...register('verticalAccuracy', { valueAsNumber: true })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {errors.verticalAccuracy && (
                      <p className="text-red-500 text-xs mt-1">{errors.verticalAccuracy.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Nilai HRMS / VRMS dari receiver GPS dalam satuan meter.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kondisi Sekitar <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['terbuka', 'tajuk_ringan', 'tajuk_rapat'].map(c => (
                    <label key={c} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      watch('conditionSekitar') === c ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                    }`}>
                      <input type="radio" value={c} {...register('conditionSekitar')} className="hidden" />
                      <span className="text-xl">{c === 'terbuka' ? '☀️' : c === 'tajuk_ringan' ? '🌿' : '🌳'}</span>
                      <span className="text-xs text-center font-medium text-slate-700">{c.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                {errors.conditionSekitar && <p className="text-red-500 text-xs mt-1">{errors.conditionSekitar.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kondisi Cuaca <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['cerah', 'berawan', 'hujan'].map(w => (
                    <label key={w} className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      watch('weather') === w ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                    }`}>
                      <input type="radio" value={w} {...register('weather')} className="hidden" />
                      <span className="text-xl">{w === 'cerah' ? '☀️' : w === 'berawan' ? '⛅' : '🌧️'}</span>
                      <span className="text-xs font-medium text-slate-700 capitalize">{w}</span>
                    </label>
                  ))}
                </div>
                {errors.weather && <p className="text-red-500 text-xs mt-1">{errors.weather.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Merk & Tipe Receiver</label>
                <input type="text" placeholder="Contoh: Trimble R10" {...register('receiverType')}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Catatan Lapangan</label>
                <textarea rows={3} {...register('fieldNotes')} placeholder="Catatan tambahan (opsional)..."
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button type="button" variant="secondary" onClick={() => setStep(0)} size="lg" className="flex-1">
                <ChevronLeft className="w-4 h-4" /> Kembali
              </Button>
              <Button type="button" onClick={onStepNext} loading={saveMutation.isPending} size="lg" className="flex-1">
                Lanjut <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* ===== STEP 2: Upload Dokumentasi ===== */}
        <div className={step === 2 ? 'block' : 'hidden'}>
          <div className="space-y-4">
            <Card>
              <h2 className="font-semibold text-slate-800 mb-3">📸 Foto 4 Mata Angin <span className="text-red-500">*</span></h2>
              <p className="text-xs text-slate-500 mb-4">Semua 4 foto wajib diisi. Pastikan foto diambil langsung dari kamera dengan GPS aktif.</p>
              <div className="grid grid-cols-2 gap-3">
                {(['north', 'south', 'east', 'west'] as PhotoDirection[]).map(dir => {
                  const photo = photos[dir]
                  const isUploading = uploadingPhoto === dir
                  return (
                    <label key={dir} className={`photo-slot ${photo.url ? 'filled' : ''}`}>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(dir, f) }} />
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      ) : photo.preview ? (
                        <>
                          <img src={photo.preview} alt={dir} className="w-full h-full object-cover rounded-xl" />
                          {photo.exif?.lat && (
                            <div className="absolute bottom-1 left-1 right-1 bg-green-500/90 rounded text-white text-[9px] px-1 py-0.5 text-center">
                              📍 GPS ✓
                            </div>
                          )}
                          {!photo.exif?.lat && photo.url && (
                            <div className="absolute bottom-1 left-1 right-1 bg-amber-500/90 rounded text-white text-[9px] px-1 py-0.5 text-center">
                              ⚠️ No GPS
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">{DIRECTION_LABELS[dir]}</span>
                        </>
                      )}
                    </label>
                  )
                })}
              </div>
              {!allPhotosUploaded && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {4 - Object.values(photos).filter(p => p.url).length} foto belum diupload
                </p>
              )}
            </Card>

            <Card>
              <h2 className="font-semibold text-slate-800 mb-3">📁 File RINEX <span className="text-slate-400 text-xs font-normal">(opsional)</span></h2>
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                rinex.url ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <input type="file" accept=".zip,.obs,.nav,.rnx,.22o,.23o" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadRinex(f) }} />
                {uploadingRinex ? (
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                ) : rinex.url ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {rinex.file?.name ?? 'Upload File RINEX / RAW Data'}
                  </p>
                  <p className="text-xs text-slate-400">.zip, .obs, .nav, .rnx — Maks. 100 MB</p>
                </div>
              </label>
            </Card>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} size="lg" className="flex-1">
                <ChevronLeft className="w-4 h-4" /> Kembali
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={!allReady}
                loading={submitMutation.isPending}
                size="lg"
                className="flex-1"
              >
                <Send className="w-4 h-4" /> Submit
              </Button>
            </div>
            {!allReady && (
              <p className="text-xs text-slate-500 text-center">
                Lengkapi semua foto (4 arah) untuk submit
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InputPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-100px)] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>}>
      <InputPageContent />
    </Suspense>
  )
}
