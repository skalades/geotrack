import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

export const GET = withAuth(async (req, { user }) => {
  try {
    const measurements = await prisma.measurement.findMany({
      where: { status: 'approved', rinexFileUrl: { not: null } },
      select: { pointCode: true, rinexFileUrl: true }
    })

    if (measurements.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada file RINEX pada titik yang disetujui' }, { status: 404 })
    }

    const publicDir = path.join(process.cwd(), 'public')
    
    // Create an archiver instance
    const archive = archiver('zip', {
      zlib: { level: 5 }
    })

    // Create a pass-through stream to pipe archive data
    const stream = new Readable({
      read() {}
    })

    archive.on('data', chunk => {
      stream.push(chunk)
    })
    
    archive.on('end', () => {
      stream.push(null)
    })

    archive.on('error', err => {
      console.error('Archiver error:', err)
      stream.emit('error', err)
    })

    // Start archiving process in background
    (async () => {
      for (const m of measurements) {
        if (m.rinexFileUrl) {
          // rinexFileUrl looks like "/uploads/rinex/uuid.zip"
          const filePath = path.join(publicDir, m.rinexFileUrl)
          if (fs.existsSync(filePath)) {
            const ext = m.rinexFileUrl.split('.').pop()?.toUpperCase() || 'ZIP'
            const filename = `${m.pointCode}.${ext}`
            archive.file(filePath, { name: filename })
          }
        }
      }
      await archive.finalize()
    })()

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="RINEX-Data-Approved.zip"'
      }
    })
  } catch (e: any) {
    console.error('Rinex export error:', e)
    return NextResponse.json({ success: false, error: 'Gagal membuat file ZIP' }, { status: 500 })
  }
}, ['super_admin', 'client'])
