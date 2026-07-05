// src/app/layout.tsx — Root Layout

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'GeoTrack Cikelet — GCP/ICP Monitoring System',
  description:
    'Sistem monitoring dan dokumentasi pengukuran 200 titik GCP/ICP menggunakan metode GNSS Statis di wilayah Cikelet, Garut Selatan.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GeoTrack',
  },
  formatDetection: { telephone: false },
  keywords: ['GCP', 'ICP', 'GNSS', 'surveyor', 'geotrack', 'cikelet', 'monitoring'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1d4ed8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-slate-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
