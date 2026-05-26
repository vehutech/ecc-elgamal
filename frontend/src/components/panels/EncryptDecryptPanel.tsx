'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Unlock, Copy, CheckCircle, Info } from 'lucide-react'
import { api, ECCCiphertext, ElGamalCiphertext } from '@/lib/api'
import { Spinner } from '@/components/ui/Skeleton'
import { formatBytes, formatMs } from '@/lib/utils'

type Mode = 'encrypt' | 'decrypt'
type Algo = 'ecc' | 'elgamal'

interface EncryptStats {
  encryption_time_ms: number
  original_size_bytes: number
  ciphertext_size_bytes: number
  expansion_ratio: number
  algorithm: string
  security_level: string
}

interface DecryptStats {
  decryption_time_ms: number
  recovered_size_bytes: number
  integrity: boolean
}

export function EncryptDecryptPanel() {
  const [mode, setMode] = useState<Mode>('encrypt')
  const [algo, setAlgo] = useState<Algo>('ecc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Encrypt state
  const [plaintext, setPlaintext] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [encResult, setEncResult] = useState<ECCCiphertext | ElGamalCiphertext | null>(null)
  const [encStats, setEncStats] = useState<EncryptStats | null>(null)

  // Decrypt state
  const [cipherPayload, setCipherPayload] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [decResult, setDecResult] = useState<string | null>(null)
  const [decStats, setDecStats] = useState<DecryptStats | null>(null)

  // Live size tracking
  const byteSize = new TextEncoder().encode(plaintext).length
  const decByteSize = new TextEncoder().encode(cipherPayload).length

  // Estimated encryption time based on algo and size (rough heuristic from benchmark data)
  const estimatedEncMs = algo === 'ecc'
    ? (2.11 + byteSize / 1024 * 0.019).toFixed(2)
    : (93.44 + byteSize / 1024 * 0.016).toFixed(2)

  const handleEncrypt = async () => {
    if (!plaintext.trim() || !publicKey.trim()) {
      setError('Enter both a message and a public key')
      return
    }
    setLoading(true)
    setError(null)
    setEncResult(null)
    setEncStats(null)

    const t0 = performance.now()
    try {
      let result: ECCCiphertext | ElGamalCiphertext
      if (algo === 'ecc') {
        result = await api.ecc.encrypt(plaintext, publicKey)
      } else {
        result = await api.elgamal.encrypt(plaintext, publicKey)
      }
      const t1 = performance.now()
      const encTime = t1 - t0

      // Calculate ciphertext size
      const ctSize = getCiphertextSize(result, algo)
      const originalSize = new TextEncoder().encode(plaintext).length

      setEncResult(result)
      setEncStats({
        encryption_time_ms: encTime,
        original_size_bytes: originalSize,
        ciphertext_size_bytes: ctSize,
        expansion_ratio: Math.round((ctSize / originalSize) * 100) / 100,
        algorithm: algo === 'ecc' ? 'ECIES / P-256 / AES-256-GCM' : 'ElGamal / MODP-3072',
        security_level: '128-bit classical security',
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Encryption failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async () => {
    if (!cipherPayload.trim() || !privateKey.trim()) {
      setError('Enter both ciphertext JSON and private key')
      return
    }
    setLoading(true)
    setError(null)
    setDecResult(null)
    setDecStats(null)

    const t0 = performance.now()
    try {
      const parsed = JSON.parse(cipherPayload)
      let recovered: string
      if (algo === 'ecc') {
        const r = await api.ecc.decrypt(
          parsed.ciphertext, parsed.nonce, parsed.ephemeral_public_key, privateKey
        )
        recovered = r.plaintext
      } else {
        const r = await api.elgamal.decrypt(parsed, privateKey)
        recovered = r.plaintext
      }
      const t1 = performance.now()

      setDecResult(recovered)
      setDecStats({
        decryption_time_ms: t1 - t0,
        recovered_size_bytes: new TextEncoder().encode(recovered).length,
        integrity: true,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Decryption failed — check your key and ciphertext')
      setDecStats({ decryption_time_ms: 0, recovered_size_bytes: 0, integrity: false })
    } finally {
      setLoading(false)
    }
  }

  const copyResult = () => {
    if (encResult) navigator.clipboard.writeText(JSON.stringify(encResult, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {mode === 'encrypt'
          ? <Lock size={16} style={{ color: 'var(--accent)' }} />
          : <Unlock size={16} style={{ color: 'var(--accent)' }} />}
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--fg)' }}>
          {mode === 'encrypt' ? 'Encrypt Message' : 'Decrypt Message'}
        </h2>
      </div>

      {/* Mode + Algo tabs */}
      <div className="space-y-2">
        <div className="tab-bar">
          <button className={`tab-item ${mode === 'encrypt' ? 'active' : ''}`} onClick={() => { setMode('encrypt'); setError(null) }}>
            Encrypt
          </button>
          <button className={`tab-item ${mode === 'decrypt' ? 'active' : ''}`} onClick={() => { setMode('decrypt'); setError(null) }}>
            Decrypt
          </button>
        </div>
        <div className="tab-bar">
          <button className={`tab-item ${algo === 'ecc' ? 'active' : ''}`} onClick={() => setAlgo('ecc')}>
            ECC
          </button>
          <button className={`tab-item ${algo === 'elgamal' ? 'active' : ''}`} onClick={() => setAlgo('elgamal')}>
            ElGamal
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'encrypt' ? (
          <motion.div
            key="encrypt"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Message input with live size detector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>Message</label>
                <AnimatePresence>
                  {plaintext.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-2xs tabular-nums" style={{ color: 'var(--fg-subtle)' }}>
                        {plaintext.length} chars
                      </span>
                      <span
                        className="badge text-2xs px-2 py-0.5"
                        style={{
                          background: 'var(--accent-muted)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          borderRadius: '99px',
                        }}
                      >
                        {formatBytes(byteSize)}
                      </span>
                      <span className="text-2xs tabular-nums" style={{ color: 'var(--fg-subtle)' }}>
                        ~{estimatedEncMs} ms
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <textarea
                className="input-base resize-none h-24"
                placeholder="Enter message to encrypt…"
                value={plaintext}
                onChange={e => setPlaintext(e.target.value)}
              />
              {/* Size progress bar */}
              {plaintext.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-1.5 space-y-1"
                >
                  <div className="flex justify-between text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                    <span>Payload size</span>
                    <span>{formatBytes(byteSize)} of 10 KB limit</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--bg-raised)', borderRadius: 99 }}>
                    <motion.div
                      animate={{ width: `${Math.min((byteSize / 10240) * 100, 100)}%` }}
                      style={{
                        height: '100%',
                        background: byteSize > 8192 ? '#EF4444' : 'var(--accent)',
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Public key input */}
            <div>
              <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
                {algo === 'ecc' ? 'Recipient Public Key (PEM)' : 'Recipient Public Key (hex)'}
              </label>
              <textarea
                className="input-base resize-none h-20 mono"
                placeholder={algo === 'ecc' ? '-----BEGIN PUBLIC KEY-----\n…' : '0x1a2b3c…'}
                value={publicKey}
                onChange={e => setPublicKey(e.target.value)}
              />
            </div>

            <button
              className="btn-primary w-full justify-center"
              onClick={handleEncrypt}
              disabled={loading}
            >
              {loading ? <Spinner size={14} /> : <Lock size={14} />}
              {loading ? 'Encrypting…' : 'Encrypt'}
            </button>

            {error && <ErrorBox msg={error} />}

            {/* Encryption stats */}
            {encStats && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>
                  Encryption Results
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatItem
                    label="Encryption Time"
                    value={formatMs(encStats.encryption_time_ms)}
                    highlight
                  />
                  <StatItem
                    label="Original Size"
                    value={formatBytes(encStats.original_size_bytes)}
                  />
                  <StatItem
                    label="Ciphertext Size"
                    value={formatBytes(encStats.ciphertext_size_bytes)}
                  />
                  <StatItem
                    label="Expansion Ratio"
                    value={`${encStats.expansion_ratio}×`}
                    sub="ciphertext vs plaintext"
                  />
                  <StatItem
                    label="Algorithm"
                    value={encStats.algorithm}
                  />
                  <StatItem
                    label="Security Level"
                    value={encStats.security_level}
                  />
                </div>

                {/* Ciphertext output */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>Ciphertext JSON</span>
                    <button onClick={copyResult} className="flex items-center gap-1 text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                      {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                      {copied ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <div className="result-block">
                    {JSON.stringify(encResult, null, 2)}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="decrypt"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Ciphertext input with size detector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                  Ciphertext (paste JSON from encryption)
                </label>
                <AnimatePresence>
                  {cipherPayload.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <span
                        className="text-2xs tabular-nums px-2 py-0.5"
                        style={{
                          background: 'var(--accent-muted)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                          borderRadius: '99px',
                        }}
                      >
                        {formatBytes(decByteSize)}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <textarea
                className="input-base resize-none h-28 mono"
                placeholder='{"ciphertext": "…", "nonce": "…", …}'
                value={cipherPayload}
                onChange={e => setCipherPayload(e.target.value)}
              />
            </div>

            {/* Private key */}
            <div>
              <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
                {algo === 'ecc' ? 'Private Key (PEM)' : 'Private Key (hex)'}
              </label>
              <textarea
                className="input-base resize-none h-20 mono"
                placeholder={algo === 'ecc' ? '-----BEGIN PRIVATE KEY-----\n…' : '0x…'}
                value={privateKey}
                onChange={e => setPrivateKey(e.target.value)}
              />
            </div>

            <button
              className="btn-primary w-full justify-center"
              onClick={handleDecrypt}
              disabled={loading}
            >
              {loading ? <Spinner size={14} /> : <Unlock size={14} />}
              {loading ? 'Decrypting…' : 'Decrypt'}
            </button>

            {error && <ErrorBox msg={error} />}

            {/* Decryption stats */}
            {decStats && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>
                  Decryption Results
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <StatItem
                    label="Decryption Time"
                    value={formatMs(decStats.decryption_time_ms)}
                    highlight
                  />
                  <StatItem
                    label="Recovered Size"
                    value={formatBytes(decStats.recovered_size_bytes)}
                  />
                  <StatItem
                    label="Integrity"
                    value={decStats.integrity ? 'Verified ✓' : 'Failed ✗'}
                    success={decStats.integrity}
                    danger={!decStats.integrity}
                  />
                </div>
              </motion.div>
            )}

            {decResult !== null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-2xs mb-1" style={{ color: 'var(--fg-subtle)' }}>
                  Recovered Plaintext
                </p>
                <div
                  className="card p-3 text-sm"
                  style={{ color: 'var(--fg)', background: 'var(--accent-muted)', borderColor: 'var(--accent)' }}
                >
                  {decResult}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatItem({
  label, value, sub, highlight, success, danger,
}: {
  label: string; value: string; sub?: string
  highlight?: boolean; success?: boolean; danger?: boolean
}) {
  const color = success ? '#22C55E' : danger ? '#EF4444' : highlight ? 'var(--accent)' : 'var(--fg)'
  return (
    <div className="card p-2.5">
      <p className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
      <p className="text-xs font-semibold font-display mt-0.5 tabular-nums" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-2xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{sub}</p>}
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-xs rounded-lg px-3 py-2"
      style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      {msg}
    </motion.p>
  )
}

function getCiphertextSize(result: ECCCiphertext | ElGamalCiphertext, algo: Algo): number {
  if (algo === 'ecc') {
    const ct = result as ECCCiphertext
    try {
      return (
        atob(ct.ciphertext).length +
        atob(ct.nonce).length +
        atob(ct.ephemeral_public_key).length
      )
    } catch { return 0 }
  } else {
    const ct = result as ElGamalCiphertext
    try {
      return ct.blocks.reduce((acc, b) => acc + atob(b.c1).length + atob(b.c2).length, 0)
    } catch { return 0 }
  }
}