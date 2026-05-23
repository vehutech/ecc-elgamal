'use client'
import Link from "next/link";

export function Footer() {
  return (
    <footer
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        color: 'var(--fg-subtle)',
      }}
      className="mt-16 py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-center sm:text-left space-y-0.5">
            <p style={{ color: 'var(--fg-muted)' }} className="font-medium">
              Daniel Vehu Alonge &middot; SCI21CSC229
            </p>
            <p>Supervisor:
              <Link href="https://scholar.google.com/citations?user=Q1973xUAAAAJ&hl=en" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
                Dr. Malik Adeiza Rufai, PhD&middot;
              </Link>
            </p>
            <p>Department of Computer Science &middot; B.Sc. Final Year Project, 2026</p>
            <Link 
              href="https://www.fulokoja.edu.ng/"
              target="_blank" rel="noopener noreferrer" 
              style={{ color: 'var(--fg-subtle)' }}
              className="hover:underline"
            >
              Federal University Lokoja
            </Link>
          </div>

          <div className="text-center sm:text-right space-y-0.5">
            <p>
              Built by{' '}
              <a
                href="https://vehutech.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
                className="hover:underline font-medium"
              >
                D. Vehu Alonge
              </a>
            </p>
            <p>
              <a
                href="https://github.com/vehutech/ecc-elgamal"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--fg-subtle)' }}
                className="hover:underline"
              >
                github.com/vehutech/ecc-elgamal
              </a>
            </p>
            <p>MIT License &middot; Open Source</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
