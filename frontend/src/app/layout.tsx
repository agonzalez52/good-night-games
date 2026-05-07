import type { Metadata } from 'next'
import Script from 'next/script'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Good Night Games',
  description: 'Party games for game night',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isAdSenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  const adSenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  const shouldLoadAdSenseScript = isAdSenseEnabled && Boolean(adSenseClient)

  return (
    <html lang="en">
      <body>
        {shouldLoadAdSenseScript && (
          <Script
            id="google-adsense-script"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseClient}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
