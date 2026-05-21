'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Copy, CheckCircle, RefreshCw } from 'lucide-react'
import { api, ECCKeyPair, ElGamalKeyPair } from '@/lib/api'
import { KeySkeleton, Spinner } from '@/components/ui/Skeleton'
import { truncate } from '@/lib/utils'

type AlgoTab = 'ecc' | 'elgamal'

export function KeyGenPanel() {
  const [tab, setTab] = useState<AlgoTab>('ecc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eccKeys, setEccKeys] = useState<ECCKeyPair | null>(null)
  const [elgamalKeys, setElgamalKeys] = useState<ElGamalKeyPair | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'ecc') {
        const keys = await api.ecc.keygen()
        setEccKeys(keys)
      } else {
        const keys = await api.elgamal.keygen()
        setElgamalKeys(keys)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate keys')
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const currentKeys = tab === 'ecc' ? eccKeys : elgamalKeys

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Key size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--fg)' }}>
          Key Generation
        </h2>
      </div>

      {/* Algorithm tabs */}
      <div className="tab-bar">
        <button className={`tab-item ${tab === 'ecc' ? 'active' : ''}`} onClick={() => setTab('ecc')}>
          ECC P-256
        </button>
        <button className={`tab-item ${tab === 'elgamal' ? 'active' : ''}`} onClick={() => setTab('elgamal')}>
          ElGamal 3072
        </button>
      </div>

      {/* Info strip */}
      <div className="flex gap-3 text-2xs" style={{ color: 'var(--fg-subtle)' }}>
        {tab === 'ecc' ? (
          <>
            <span className="badge badge-ecc">NIST P-256</span>
            <span>256-bit key &middot; 128-bit security &middot; ECDH + AES-256-GCM</span>
          </>
        ) : (
          <>
            <span className="badge badge-elgamal">RFC 3526</span>
            <span>3072-bit key &middot; 128-bit security &middot; MODP Group 14</span>
          </>
        )}
      </div>

      {/* Generate button */}
      <button
        className="btn-primary w-full justify-center"
        onClick={generate}
        disabled={loading}
      >
        {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
        {loading ? 'Generating…' : 'Generate Key Pair'}
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Keys output */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <KeySkeleton />
          </motion.div>
        ) : currentKeys ? (
          <motion.div
            key={`keys-${tab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {tab === 'ecc' && eccKeys ? (
              <>
                <KeyField
                  label="Public Key (PEM)"
                  value={eccKeys.public_key_pem}
                  id="ecc-pub"
                  copied={copied}
                  onCopy={copy}
                />
                <KeyField
                  label="Private Key (PEM) — keep secret"
                  value={eccKeys.private_key_pem}
                  id="ecc-priv"
                  copied={copied}
                  onCopy={copy}
                  sensitive
                />
                <div className="grid grid-cols-3 gap-2 text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                  <Info label="Curve" value={eccKeys.curve.split(' ')[0] + ' ' + eccKeys.curve.split(' ')[1]} />
                  <Info label="Key Size" value={`${eccKeys.key_size_bits} bits`} />
                  <Info label="Security" value={`${eccKeys.security_level_bits}-bit`} />
                </div>
              </>
            ) : elgamalKeys ? (
              <>
                <KeyField
                  label="Public Key (hex)"
                  value={elgamalKeys.public_key}
                  id="elg-pub"
                  copied={copied}
                  onCopy={copy}
                />
                <KeyField
                  label="Private Key (hex) — keep secret"
                  value={elgamalKeys.private_key}
                  id="elg-priv"
                  copied={copied}
                  onCopy={copy}
                  sensitive
                />
                <div className="grid grid-cols-3 gap-2 text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                  <Info label="Group" value="RFC 3526 G14" />
                  <Info label="Key Size" value={`${elgamalKeys.key_size_bits} bits`} />
                  <Info label="Security" value={`${elgamalKeys.security_level_bits}-bit`} />
                </div>
              </>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className="text-center py-8 text-xs"
            style={{ color: 'var(--fg-subtle)' }}
          >
            Click <strong>Generate Key Pair</strong> to begin
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KeyField({
  label, value, id, copied, onCopy, sensitive = false,
}: {
  label: string; value: string; id: string
  copied: string | null; onCopy: (v: string, id: string) => void; sensitive?: boolean
}) {
  const [revealed, setRevealed] = useState(!sensitive)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
        <div className="flex gap-1">
          {sensitive && (
            <button
              className="text-2xs px-2 py-0.5 rounded"
              style={{ color: 'var(--fg-subtle)', background: 'var(--bg-raised)' }}
              onClick={() => setRevealed(r => !r)}
            >
              {revealed ? 'Hide' : 'Show'}
            </button>
          )}
          <button
            onClick={() => onCopy(value, id)}
            className="flex items-center gap-1 text-2xs px-2 py-0.5 rounded transition-colors"
            style={{
              color: copied === id ? '#22C55E' : 'var(--fg-subtle)',
              background: 'var(--bg-raised)',
            }}
          >
            {copied === id ? <CheckCircle size={10} /> : <Copy size={10} />}
            {copied === id ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="result-block">
        {revealed ? value : '•'.repeat(64)}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-2 text-center">
      <p className="text-2xs opacity-60">{label}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--fg)' }}>{value}</p>
    </div>
  )
}
