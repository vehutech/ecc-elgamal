'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Key, Lock, Radio, BarChart2, ExternalLink, Github } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { KeyGenPanel } from '@/components/panels/KeyGenPanel'
import { EncryptDecryptPanel } from '@/components/panels/EncryptDecryptPanel'
import { TransmissionPanel } from '@/components/panels/TransmissionPanel'

// Chart.js cannot run server-side — load BenchmarkPanel client-only
const BenchmarkPanel = dynamic(
  () => import('@/components/panels/BenchmarkPanel').then(m => m.BenchmarkPanel),
  {
    ssr: false,
    loading: () => (
      <div className="card p-5 space-y-4">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    ),
  }
)

type Tab = 'keygen' | 'encrypt' | 'transmit' | 'benchmark'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'keygen',    label: 'Key Generation',    icon: <Key size={13} /> },
  { id: 'encrypt',   label: 'Encrypt / Decrypt', icon: <Lock size={13} /> },
  { id: 'transmit',  label: 'Transmission',      icon: <Radio size={13} /> },
  { id: 'benchmark', label: 'Benchmark',          icon: <BarChart2 size={13} /> },
]

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('keygen')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          {/* Title */}
          <h1
            className="font-display font-800 tracking-tight mb-4"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              lineHeight: 1.1,
              color: 'var(--fg)',
            }}
          >
            ECC vs
            <span style={{ color: 'var(--accent)' }}> ElGamal</span>
          </h1>

          {/* Tagline */}
          <p className="text-base mb-3 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            ECC vs ElGamal. One transmission. One winner.
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--fg-subtle)' }}>
            Generate keys, encrypt messages, simulate secure data transmission between
            ports, and benchmark both algorithms live — no installation required.
          </p>

          {/* CTA links */}
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://github.com/vehutech/ecc-elgamal"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
            >
              <Github size={14} />
              View Source
            </a>
            <a
              href="https://ecc-elgamal.onrender.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm"
            >
              <ExternalLink size={14} />
              API Docs
            </a>
          </div>
        </motion.div>

        {/* Algorithm comparison strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 grid grid-cols-2 gap-3 max-w-lg mx-auto"
        >
          <AlgoCard
            name="ECC"
            subtitle="NIST P-256"
            details={['256-bit key', 'ECDH + AES-256-GCM', 'O(log² n) complexity']}
            highlight
          />
          <AlgoCard
            name="ElGamal"
            subtitle="RFC 3526 MODP-3072"
            details={['3072-bit key', 'Probabilistic encryption', 'O(log³ n) complexity']}
          />
        </motion.div>
      </section>

      {/* Tab navigation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="tab-bar max-w-xl mx-auto mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-item flex items-center justify-center gap-1 ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="max-w-2xl mx-auto pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {tab === 'keygen'    && <KeyGenPanel />}
              {tab === 'encrypt'   && <EncryptDecryptPanel />}
              {tab === 'transmit'  && <TransmissionPanel />}
              {tab === 'benchmark' && <BenchmarkPanel />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Security note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs pb-6 max-w-md mx-auto"
          style={{ color: 'var(--fg-subtle)' }}
        >
          All keys are ephemeral and never stored. Operations run on the server
          and results are returned over HTTPS. No data is logged.
        </motion.p>
      </section>

      <Footer />
    </div>
  )
}

function AlgoCard({
  name, subtitle, details, highlight = false,
}: {
  name: string; subtitle: string; details: string[]; highlight?: boolean
}) {
  return (
    <div
      className="card p-4"
      style={
        highlight
          ? { borderColor: 'var(--accent)', background: 'var(--accent-muted)' }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-display font-bold text-sm"
          style={{ color: highlight ? 'var(--accent)' : 'var(--fg)' }}
        >
          {name}
        </span>
        {highlight && <span className="badge badge-ecc text-2xs">Faster</span>}
      </div>
      <p className="text-2xs mb-2" style={{ color: 'var(--fg-subtle)' }}>{subtitle}</p>
      <ul className="space-y-0.5">
        {details.map(d => (
          <li key={d} className="text-2xs flex items-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
            <span style={{ color: 'var(--accent)', opacity: 0.6 }}>›</span>
            {d}
          </li>
        ))}
      </ul>
    </div>
  )
}