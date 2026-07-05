import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.mapLayer.delete({
      where: { id: parseInt(id) }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete layer:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete layer' }, { status: 500 })
  }
}
