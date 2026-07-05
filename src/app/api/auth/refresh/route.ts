import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken, signAccessToken } from '@/lib/auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json()
    if (!refreshToken) return NextResponse.json({ success: false, error: 'Missing refresh token' }, { status: 400 })
    const payload = verifyRefreshToken(refreshToken)
    const accessToken = signAccessToken({ userId: payload.userId, role: payload.role, email: payload.email })
    return NextResponse.json({ success: true, data: { accessToken } })
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 })
  }
}
