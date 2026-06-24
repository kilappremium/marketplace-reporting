import type { Metadata } from 'next'
import LayoutClient from '../components/LayoutClient'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kilap Marketplace Reporting',
  description: 'Panel laporan penjualan & marketing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  )
}