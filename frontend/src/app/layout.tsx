import type { Metadata } from 'next'
import Link from 'next/link'
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
        <Providers>
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1 }}>{children}</div>
            <footer
              role="contentinfo"
              style={{
                borderTop: '1px solid var(--border)',
                padding: '16px 20px 24px',
                marginTop: 'auto',
                background: 'var(--surface)',
              }}
            >
              <nav
                aria-label="Legal"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <Link
                  href="/privacy"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  Privacy Policy
                </Link>
              </nav>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  )
}
