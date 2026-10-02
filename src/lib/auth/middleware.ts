// src/lib/auth/middleware.ts — API Route Auth Middleware

import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from './jwt'
import { JWTPayload, UserRole } from '@/types'

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload
}

export function withAuth(
  handler: (req: NextRequest, context: { params: Record<string, string>; user: JWTPayload }) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> | Record<string, string> }) => {
    try {
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const token = authHeader.slice(7)
      const user = verifyAccessToken(token)

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 })
      }

      // Next.js 15+: params is a Promise — await it before passing to handler
      const resolvedParams = await Promise.resolve(context.params) as Record<string, string>
      return handler(req, { params: resolvedParams, user })
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }
  }
}

export function getTokenFromRequest(req: NextRequest): JWTPayload | null {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    return verifyAccessToken(token)
  } catch {
    return null
  }
}
