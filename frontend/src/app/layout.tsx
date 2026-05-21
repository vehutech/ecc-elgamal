import type { Metadata } from 'next'
import { Inter, Syne } from 'next/font/google'
import { ThemeProvider } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'CipherDuel — ECC vs ElGamal',
  description:
    'Live performance and security benchmarking of Elliptic Curve Cryptography vs ElGamal in data transmission. Final year project — Federal University Lokoja.',
  keywords: ['ECC', 'ElGamal', 'cryptography', 'benchmarking', 'data transmission', 'security'],
  authors: [{ name: 'Daniel Vehu Alonge', url: 'https://vehutech.com' }],
  openGraph: {
    title: 'CipherDuel — ECC vs ElGamal Benchmarking',
    description: 'Interactive cryptographic algorithm comparison tool.',
    url: 'https://ecc-elgamal.vercel.app',
    siteName: 'CipherDuel',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('cipherduel-theme');
                  var p = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  if ((t || p) === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })()
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${syne.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
