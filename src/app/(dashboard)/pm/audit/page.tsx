'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Activity, History } from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'

type AuditLog = {
  id: number
  userId: string
  user: { name: string, email: string }
  action: string
  entityType: string | null
  entityId: number | null
  notes: string | null
  ipAddress: string | null
  createdAt: string
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiClient.get('/audit').then(r => r.data.data as AuditLog[]).catch(() => []),
  })

  const filtered = data?.filter(l => 
    l.user?.name?.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.notes?.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">Riwayat aktivitas dan rekam jejak pengguna dalam sistem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 border-0 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Cari user, aksi, atau catatan..." 
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Entitas</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? filtered.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-700">{log.user?.name || 'Sistem'}</p>
                        <p className="text-xs text-slate-400">{log.user?.email || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-medium rounded border border-slate-200">
                          {log.action}
                        </span>
                        {log.notes && (
                          <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]" title={log.notes}>
                            {log.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {log.entityType ? `${log.entityType}#${log.entityId}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 font-mono">
                        {log.ipAddress || '127.0.0.1'}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                        <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        Belum ada aktivitas tercatat
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card padding="lg" className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-blue-400" />
              <h2 className="font-semibold text-lg">Keamanan Sistem</h2>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Semua aksi kritikal seperti approval, retake data, penambahan user, dan login dicatat secara permanen di Audit Log untuk memastikan <strong>akuntabilitas</strong>.
            </p>
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-slate-400">Total Entri Log</p>
              <p className="text-3xl font-bold font-mono mt-1">{data?.length || 0}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
