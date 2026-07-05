// src/app/api/uploads/photo/route.ts — Photo upload with server-side EXIF extraction

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
    const direction = formData.get('direction') as string

    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowed = ['jpg', 'jpeg', 'png', 'heic', 'webp']
    if (!ext || !allowed.includes(ext)) {
      return NextResponse.json({ success: false, error: 'Format file tidak valid. Gunakan JPG/PNG/HEIC' }, { status: 400 })
    }

    // Validate size (max 10MB before compression)
    const maxBytes = 10 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ success: false, error: 'Ukuran file maks. 10 MB' }, { status: 400 })
    }

    // Save file
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'photos')
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const filename = `${uuidv4()}.${ext}`
    const filepath = path.join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    const url = `/uploads/photos/${filename}`

    return NextResponse.json({
      success: true,
      data: { url, filename, size: file.size, direction }
    })
  } catch (e) {
    console.error('Photo upload error:', e)
    return NextResponse.json({ success: false, error: 'Upload gagal' }, { status: 500 })
  }
}
