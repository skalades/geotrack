import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth/middleware'
import * as xlsx from 'xlsx'
import { format } from 'date-fns'

export const GET = withAuth(async (req, { user }) => {
  try {
    const measurements = await prisma.measurement.findMany({
      where: { status: 'approved' },
      include: { surveyor: true, targetPoint: true },
      orderBy: { updatedAt: 'desc' }
    })

    const data = measurements.map((m, i) => ({
      'No': i + 1,
      'Kode Titik': m.pointCode,
      'Tipe': m.targetPoint?.pointType || '-',
      'Surveyor': m.surveyor?.name || '-',
      'Tanggal Mulai': m.startTime ? format(new Date(m.startTime), 'dd-MM-yyyy HH:mm') : '-',
      'Tanggal Selesai': m.endTime ? format(new Date(m.endTime), 'dd-MM-yyyy HH:mm') : '-',
      'Tinggi Antena (m)': m.antennaHeight || '-',
      'Cuaca': m.weather || '-',
      'Kondisi Sekitar': m.conditionSekitar || '-',
      'Receiver': m.receiverType || '-',
      'Catatan Lapangan': m.fieldNotes || '-',
      'RINEX Terlampir': m.rinexFileUrl ? 'Ya' : 'Tidak'
    }))

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(data)

    // Adjust column widths
    const colWidths = [
      { wch: 5 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, 
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
      { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }
    ]
    ws['!cols'] = colWidths

    xlsx.utils.book_append_sheet(wb, ws, 'Rekapitulasi')

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Rekapitulasi-Pengukuran.xlsx"'
      }
    })
  } catch (e: any) {
    console.error('Excel export error:', e)
    return NextResponse.json({ success: false, error: 'Gagal mengekspor data Excel' }, { status: 500 })
  }
}, ['super_admin', 'client'])
