// src/app/api/uploads/rinex/route.ts — RINEX file upload

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getTokenFromRequest } from '@/lib/auth/middleware'

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['zip', 'rar', 'obs', 'nav', 'rnx', 'txt']
    const isRinexExt = ext ? /^\d{2}[a-z]$/.test(ext) : false
    if (!ext || (!allowed.includes(ext) && !isRinexExt)) {
      return NextResponse.json({ success: false, error: `Format RINEX tidak valid: .${ext}` }, { status: 400 })
    }

    const maxBytes = 100 * 1024 * 1024 // 100 MB
    if (file.size > maxBytes) {
      return NextResponse.json({ success: false, error: 'Ukuran file RINEX maks. 100 MB' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'rinex')
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const filename = `${uuidv4()}.${ext}`
    const filepath = path.join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    return NextResponse.json({
      success: true,
      data: { url: `/uploads/rinex/${filename}`, filename, size: file.size }
    })
  } catch (e) {
    console.error('RINEX upload error:', e)
    return NextResponse.json({ success: false, error: 'Upload RINEX gagal' }, { status: 500 })
  }
}
