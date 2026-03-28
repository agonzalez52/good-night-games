import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Good Night Games',
  description: 'Family Feud-style party games for game night',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
