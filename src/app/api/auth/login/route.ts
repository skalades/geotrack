import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { generateTokenPair } from '@/lib/auth/jwt'
import { loginSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: 'Email atau password salah' }, { status: 401 })
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Email atau password salah' }, { status: 401 })
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    const tokens = generateTokenPair(user.id, user.role as any, user.email)
    // Audit log
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    await prisma.activityLog.create({
      data: { userId: user.id, action: 'login', ipAddress: ip }
    })
    return NextResponse.json({
      success: true,
      data: {
        ...tokens,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
      }
    })
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
