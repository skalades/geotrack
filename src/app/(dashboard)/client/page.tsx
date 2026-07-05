'use client'

import { Card } from '@/components/ui/card'
import { MapPin, Download, LogOut, CheckCircle2, Clock } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/utils/api-client'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function ClientDashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['client-dashboard'],
    queryFn: () => apiClient.get('/dashboard/summary').then(r => r.data.data),
    refetchInterval: 120000,
  })

  // We can fetch points directly if needed, but summary usually has it or we can fetch `/points?status=approved`
  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ['client-points'],
    queryFn: () => apiClient.get('/points').then(r => r.data.data),
  })

  if (isLoading || pointsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white h-16 border-b border-slate-200" />
        <div className="p-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Skeleton className="h-32" />
             <Skeleton className="h-32" />
             <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96 w-full mt-8" />
        </div>
      </div>
    )
  }

  const s = summaryRes
  // In real app, API can filter `points?status=approved`
  const approvedPoints = pointsData?.filter((p: any) => p.measurement?.status === 'approved') || []

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
             <MapPin className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl text-slate-800">GeoTrack <span className="text-blue-600 font-medium">Client</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-500">Client View</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Selamat Datang, {user?.name}</h2>
          <p className="text-sm text-slate-500 mt-1">Pantau progress pengukuran titik GCP/ICP proyek Anda secara real-time</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card padding="lg">
            <div className="flex items-center gap-4 mb-2">
               <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                 <MapPin className="w-5 h-5 text-slate-600" />
               </div>
               <div>
                  <h3 className="text-slate-500 font-medium text-sm">Total Titik</h3>
                  <p className="text-3xl font-bold text-slate-800">{s?.total || 0}</p>
               </div>
            </div>
          </Card>
          <Card padding="lg">
            <div className="flex items-center gap-4 mb-2">
               <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                 <CheckCircle2 className="w-5 h-5 text-green-600" />
               </div>
               <div>
                  <h3 className="text-slate-500 font-medium text-sm">Disetujui</h3>
                  <p className="text-3xl font-bold text-green-600">{s?.approved || 0}</p>
               </div>
            </div>
          </Card>
          <Card padding="lg" className="bg-gradient-to-r from-blue-700 to-blue-900 text-white border-0 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-blue-200 font-medium text-sm mb-1">Progress Proyek</h3>
              <div className="flex items-end gap-2 mb-4">
                 <p className="text-4xl font-bold">{s?.progressPercent || 0}%</p>
                 <span className="text-sm text-blue-200 pb-1">Selesai</span>
              </div>
            </div>
            <button 
              disabled={s?.progressPercent < 100}
              className="relative z-10 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-2 rounded-lg text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Download Final Report
            </button>
            <Clock className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
          </Card>
        </div>

        <Card className="mt-8 border-0 shadow-sm">
           <div className="p-4 border-b border-slate-200 bg-white rounded-t-xl flex items-center justify-between">
              <div>
                 <h2 className="text-lg font-semibold text-slate-800">Daftar Titik Disetujui</h2>
                 <p className="text-xs text-slate-500">Hanya menampilkan titik yang sudah melalui proses validasi PM.</p>
              </div>
              <Badge variant="success" className="px-3 py-1 text-sm">{approvedPoints.length} Titik</Badge>
           </div>
           <div className="overflow-x-auto">
             <Table>
                <TableHeader>
                   <TableRow>
                      <TableHead>Kode Titik</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Koordinat GPS</TableHead>
                      <TableHead>Tinggi Antena</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {approvedPoints.map((p: any) => (
                      <TableRow key={p.id}>
                         <TableCell className="font-semibold text-slate-800">{p.pointCode}</TableCell>
                         <TableCell><Badge variant="primary">{p.pointType}</Badge></TableCell>
                         <TableCell>
                            <span className="font-mono text-xs text-slate-600">
                               {p.targetLat}, {p.targetLng}
                            </span>
                         </TableCell>
                         <TableCell>
                            {p.measurement?.antennaHeight ? `${p.measurement.antennaHeight} m` : '-'}
                         </TableCell>
                         <TableCell className="text-right">
                            <Link href={`/points/${p.pointCode}`}>
                              <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                Lihat Laporan
                              </Button>
                            </Link>
                         </TableCell>
                      </TableRow>
                   ))}
                   {approvedPoints.length === 0 && (
                      <TableRow>
                         <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                            Belum ada titik yang disetujui.
                         </TableCell>
                      </TableRow>
                   )}
                </TableBody>
             </Table>
           </div>
        </Card>
      </main>
    </div>
  )
}
