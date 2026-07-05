'use client'

import { Download, FileText, FileSpreadsheet, FileArchive, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

import apiClient from '@/lib/utils/api-client'

export default function ExportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (type: string) => {
    setDownloading(type)
    try {
      if (type === 'excel') {
        const res = await apiClient.get('/exports/excel', { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'Rekapitulasi-Pengukuran.xlsx')
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else if (type === 'rinex') {
        const res = await apiClient.get('/exports/rinex', { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'RINEX-Data-Approved.zip')
        document.body.appendChild(link)
        link.click()
        link.remove()
      } else if (type === 'pdf') {
        const res = await apiClient.get('/measurements')
        const json = res.data
        if (!json.success) throw new Error('Gagal memuat data')
        
        const approved = json.data.filter((m: any) => m.status === 'approved')
        if (approved.length === 0) {
          alert('Tidak ada data pengukuran yang disetujui.')
          setDownloading(null)
          return
        }

        const htmlToImage = await import('html-to-image')
        const { jsPDF } = await import('jspdf')
        const { createRoot } = await import('react-dom/client')
        const { PointReportTemplate } = await import('@/components/pdf/PointReportTemplate')
        
        const doc = new jsPDF('p', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()

        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.left = '-9999px'
        container.style.top = '0'
        document.body.appendChild(container)
        const root = createRoot(container)

        for (let i = 0; i < approved.length; i++) {
          const m = approved[i]
          
          setDownloading(`Mengekspor halaman ${i + 1}/${approved.length}...`)
          
          await new Promise<void>((resolve) => {
            root.render(<PointReportTemplate measurement={m} id="pdf-target" />)
            setTimeout(resolve, 2000)
          })

          const element = document.getElementById('pdf-target')
          if (element) {
            const imgData = await htmlToImage.toPng(element, { 
              pixelRatio: 2, 
              cacheBust: true 
            })
            
            if (i > 0) doc.addPage()
            
            const imgProps = doc.getImageProperties(imgData)
            const pdfHeight = (imgProps.height * pageWidth) / imgProps.width
            
            doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pdfHeight)
          }
        }
        
        root.unmount()
        container.remove()
        
        doc.save('Laporan-Lengkap-GeoTrack.pdf')
      }
    } catch (e: any) {
      console.error('Export error:', e)
      alert(e.response?.data?.error || 'Terjadi kesalahan saat membuat file eksport.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Export Laporan</h1>
        <p className="text-sm text-slate-500 mt-1">Unduh hasil rekapitulasi data dan file RINEX</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* PDF Laporan Lengkap */}
        <Card padding="lg" className="border-slate-200 shadow-sm hover:border-red-300 transition-colors">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">PDF Laporan Lengkap</h3>
          <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
            Dokumen resmi berisi foto 4 arah, koordinat target, dan informasi rinci untuk semua titik yang telah di-approve.
          </p>
          <Button 
            className="w-full bg-red-600 hover:bg-red-700" 
            loading={downloading === 'pdf' || downloading?.startsWith('Mengekspor')}
            onClick={() => handleDownload('pdf')}
          >
            {downloading === 'pdf' || downloading?.startsWith('Mengekspor') ? (downloading === 'pdf' ? 'Memproses...' : downloading) : (
              <><Download className="w-4 h-4 mr-2" /> Download PDF</>
            )}
          </Button>
        </Card>

        {/* Excel Tabular */}
        <Card padding="lg" className="border-slate-200 shadow-sm hover:border-green-300 transition-colors">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Excel Rekapitulasi</h3>
          <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
            Data tabular berisi daftar semua titik GCP/ICP beserta status, nama surveyor, waktu pengamatan, dan keterangan cuaca.
          </p>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            loading={downloading === 'excel'}
            onClick={() => handleDownload('excel')}
          >
            {downloading === 'excel' ? 'Memproses...' : (
              <><Download className="w-4 h-4 mr-2" /> Download Excel</>
            )}
          </Button>
        </Card>

        {/* RINEX Batch */}
        <Card padding="lg" className="border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <FileArchive className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">RINEX Data (ZIP)</h3>
          <p className="text-sm text-slate-500 mb-6 min-h-[60px]">
            Arsip ZIP berisi seluruh file RAW RINEX (Observation & Navigation) dari pengukuran yang telah valid.
          </p>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            loading={downloading === 'rinex'}
            onClick={() => handleDownload('rinex')}
          >
            {downloading === 'rinex' ? 'Memproses ZIP...' : (
              <><Download className="w-4 h-4 mr-2" /> Download ZIP</>
            )}
          </Button>
        </Card>
      </div>

      <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-4">
        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-slate-800">Catatan Sistem</h4>
          <p className="text-sm text-slate-600 mt-1">
            Data yang diexport hanya mencakup titik-titik yang memiliki status <strong>APPROVED</strong>. 
            Titik yang masih dalam status <em>Review</em>, <em>Retake</em>, atau <em>In Progress</em> tidak akan disertakan dalam laporan PDF, Excel, maupun bundel ZIP.
          </p>
        </div>
      </div>
    </div>
  )
}
