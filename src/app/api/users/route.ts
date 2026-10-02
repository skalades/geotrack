import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import { createUserSchema } from '@/lib/validations'

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') ?? undefined
  const users = await prisma.user.findMany({
    where: role ? { role: role as any } : undefined,
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json({ success: true, data: users })
}, ['super_admin'])

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  const { name, email, password, role } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ success: false, error: 'Email sudah terdaftar' }, { status: 409 })
  const passwordHash = await bcrypt.hash(password, 12)
  const newUser = await prisma.user.create({ data: { name, email, passwordHash, role } })
  await prisma.activityLog.create({ 
    data: { 
      userId: user.userId, 
      action: 'create_user', 
      entityType: 'user', 
      notes: `Created user with ID: ${newUser.id}`
    } 
  })
  return NextResponse.json({ success: true, data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } }, { status: 201 })
}, ['super_admin'])
