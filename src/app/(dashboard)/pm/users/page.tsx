'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Search, Shield, UserCog, UserCheck, UserX } from 'lucide-react'
import apiClient from '@/lib/utils/api-client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'

type UserData = {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'surveyor' | 'client'
  isActive: boolean
  lastLogin: string | null
}

export default function UsersManagementPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then(r => r.data.data as UserData[]),
  })

  const { register, handleSubmit, reset } = useForm()

  const createMutation = useMutation({
    mutationFn: (newUser: any) => apiClient.post('/users', newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDialogOpen(false)
      reset()
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string, isActive: boolean }) => 
      apiClient.patch(`/users/${id}`, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })

  const onSubmit = (d: any) => createMutation.mutate(d)

  const filtered = data?.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pengguna</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola akun surveyor, PM, dan klien</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Tambah Akun
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <Input {...register('name', { required: true })} placeholder="Contoh: Budi Santoso" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <Input type="email" {...register('email', { required: true })} placeholder="budi@geotrack.com" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <Input type="password" {...register('password', { required: true })} placeholder="Minimal 6 karakter" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Role Akses</label>
                <select {...register('role')} className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                  <option value="surveyor">Surveyor</option>
                  <option value="client">Client</option>
                  <option value="super_admin">Project Manager</option>
                </select>
              </div>
              <DialogFooter className="mt-6">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Batal</Button>
                </DialogClose>
                <Button type="submit" loading={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  Buat Akun
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Cari nama atau email..." 
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login Terakhir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {u.role === 'super_admin' ? <Shield className="w-4 h-4 text-purple-600" /> : 
                           u.role === 'surveyor' ? <UserCog className="w-4 h-4 text-blue-600" /> : 
                           <Users className="w-4 h-4 text-slate-600" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        u.role === 'super_admin' ? 'purple' : 
                        u.role === 'surveyor' ? 'primary' : 'gray'
                      }>
                        {u.role === 'super_admin' ? 'PM' : u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {u.lastLogin ? format(new Date(u.lastLogin), 'dd MMM yyyy, HH:mm') : 'Belum pernah login'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => toggleStatusMutation.mutate({ id: u.id, isActive: u.isActive })}
                        className={u.isActive ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                      >
                        {u.isActive ? <UserX className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
