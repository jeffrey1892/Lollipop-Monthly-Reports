import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lollipop Monthly Reports',
  description: 'Reusable workforce intelligence report generator for Lollipop customers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
