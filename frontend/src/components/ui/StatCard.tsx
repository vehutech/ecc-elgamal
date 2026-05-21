'use client'

import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  color?: 'ecc' | 'elgamal' | 'neutral'
}

export function StatCard({ label, value, sub, highlight, color = 'neutral' }: StatCardProps) {
  const accentMap = {
    ecc: 'var(--accent)',
    elgamal: 'var(--fg-muted)',
    neutral: 'var(--fg)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card p-4"
      style={
        highlight
          ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent-muted)' }
          : undefined
      }
    >
      <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: 'var(--fg-subtle)' }}>
        {label}
      </p>
      <p
        className="text-xl font-semibold font-display tabular-nums"
        style={{ color: accentMap[color] }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
          {sub}
        </p>
      )}
    </motion.div>
  )
}
