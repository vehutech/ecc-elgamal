'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Send, ShieldCheck, ShieldX, Radio } from 'lucide-react'
import { api, TransmissionResult } from '@/lib/api'
import { Spinner } from '@/components/ui/Skeleton'
import { formatMs, formatBytes } from '@/lib/utils'

export function TransmissionPanel() {
  const [algo, setAlgo] = useState<'ecc' | 'elgamal'>('ecc')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransmissionResult | null>(null)

  const transmit = async () => {
    if (!message.trim()) { setError('Enter a message to transmit'); return }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api.transmit(message, algo)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transmission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--fg)' }}>
          Data Transmission Simulation
        </h2>
      </div>

      {/* Port diagram */}
      <div
        className="flex items-center justify-between rounded-xl p-3 text-xs"
        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <div className="text-center">
          <div className="badge badge-ecc mb-1">PORT 5000</div>
          <p style={{ color: 'var(--fg-muted)' }} className="font-medium">Sender</p>
          <p style={{ color: 'var(--fg-subtle)' }} className="text-2xs">Encrypts &amp; sends</p>
        </div>
        <div className="flex flex-col items-center gap-1" style={{ color: 'var(--accent)' }}>
          <ArrowRight size={18} />
          <span className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>encrypted channel</span>
        </div>
        <div className="text-center">
          <div className="badge badge-elgamal mb-1">PORT 5001</div>
          <p style={{ color: 'var(--fg-muted)' }} className="font-medium">Receiver</p>
          <p style={{ color: 'var(--fg-subtle)' }} className="text-2xs">Decrypts &amp; verifies</p>
        </div>
      </div>

      {/* Algo selector */}
      <div className="tab-bar">
        <button className={`tab-item ${algo === 'ecc' ? 'active' : ''}`} onClick={() => setAlgo('ecc')}>
          ECC
        </button>
        <button className={`tab-item ${algo === 'elgamal' ? 'active' : ''}`} onClick={() => setAlgo('elgamal')}>
          ElGamal
        </button>
      </div>

      {/* Message input */}
      <div>
        <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
          Message to transmit
        </label>
        <textarea
          className="input-base resize-none h-20"
          placeholder="Enter the message to send securely from port 5000 to port 5001…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      <button
        className="btn-primary w-full justify-center"
        onClick={transmit}
        disabled={loading}
      >
        {loading ? <Spinner size={14} /> : <Send size={14} />}
        {loading ? 'Transmitting…' : 'Transmit Encrypted'}
      </button>

      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            {/* Integrity badge */}
            <div className="flex items-center gap-2">
              {result.integrity.match ? (
                <>
                  <ShieldCheck size={16} style={{ color: '#22C55E' }} />
                  <span className="badge badge-success">Integrity Verified</span>
                </>
              ) : (
                <>
                  <ShieldX size={16} style={{ color: '#EF4444' }} />
                  <span className="badge badge-danger">Integrity Failed</span>
                </>
              )}
              <span className="text-2xs ml-auto" style={{ color: 'var(--fg-subtle)' }}>
                Total: {formatMs(result.total_time_ms)}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatItem label="Encryption time" value={formatMs(result.sender.encryption_time_ms)} />
              <StatItem label="Decryption time" value={formatMs(result.receiver.decryption_time_ms)} />
              <StatItem label="Ciphertext size" value={formatBytes(result.channel.ciphertext_size_bytes)} />
              <StatItem label="Expansion ratio" value={`${result.channel.expansion_ratio}×`} />
              <StatItem label="Sender memory" value={`${result.sender.memory_kb.toFixed(1)} KB`} />
              <StatItem label="Receiver memory" value={`${result.receiver.memory_kb.toFixed(1)} KB`} />
            </div>

            {/* Recovered message */}
            <div>
              <p className="text-2xs mb-1" style={{ color: 'var(--fg-subtle)' }}>
                Recovered message (port 5001)
              </p>
              <div
                className="card p-3 text-sm"
                style={{
                  color: 'var(--fg)',
                  background: result.integrity.match ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  borderColor: result.integrity.match ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                }}
              >
                {result.receiver.recovered_message}
              </div>
            </div>

            {/* Hash comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-2xs mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Original SHA-256</p>
                <code className="text-2xs mono" style={{ color: 'var(--fg-muted)' }}>
                  {result.integrity.original_sha256}
                </code>
              </div>
              <div>
                <p className="text-2xs mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Recovered SHA-256</p>
                <code className="text-2xs mono" style={{ color: result.integrity.match ? '#22C55E' : '#EF4444' }}>
                  {result.integrity.recovered_sha256}
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-2.5">
      <p className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
      <p className="text-xs font-semibold font-display mt-0.5 tabular-nums" style={{ color: 'var(--fg)' }}>{value}</p>
    </div>
  )
}
