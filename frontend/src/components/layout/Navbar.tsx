'use client'

import { useTheme } from '@/lib/theme'
import { Moon, Sun, Github, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export function Navbar() {
  const { theme, toggle } = useTheme()

  return (
    <nav
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
      className="sticky top-0 z-50 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <Zap size={14} className="text-white" />
          </div>
          <span
            className="font-display font-700 text-base tracking-tight"
            style={{ color: 'var(--fg)' }}
          >
            Cipher<span style={{ color: 'var(--accent)' }}>Duel</span>
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/vehutech/ecc-elgamal"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs px-3 py-1.5 hidden sm:inline-flex"
          >
            <Github size={13} />
            <span>Source</span>
          </a>

          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.9 }}
            className="btn-ghost px-3 py-1.5"
            aria-label="Toggle theme"
          >
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </motion.div>
          </motion.button>
        </div>
      </div>
    </nav>
  )
}
