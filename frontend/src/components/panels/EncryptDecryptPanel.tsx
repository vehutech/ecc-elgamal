'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Unlock, Copy, CheckCircle } from 'lucide-react'
import { api, ECCCiphertext, ElGamalCiphertext } from '@/lib/api'
import { Spinner } from '@/components/ui/Skeleton'
import { formatBytes } from '@/lib/utils'

type Mode = 'encrypt' | 'decrypt'
type Algo = 'ecc' | 'elgamal'

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

  // Decrypt state
  const [cipherPayload, setCipherPayload] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [decResult, setDecResult] = useState<string | null>(null)

  const handleEncrypt = async () => {
    if (!plaintext.trim() || !publicKey.trim()) {
      setError('Enter both a message and a public key')
      return
    }
    setLoading(true)
    setError(null)
    setEncResult(null)
    try {
      if (algo === 'ecc') {
        const r = await api.ecc.encrypt(plaintext, publicKey)
        setEncResult(r)
      } else {
        const r = await api.elgamal.encrypt(plaintext, publicKey)
        setEncResult(r)
      }
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
    try {
      const parsed = JSON.parse(cipherPayload)
      if (algo === 'ecc') {
        const r = await api.ecc.decrypt(
          parsed.ciphertext, parsed.nonce, parsed.ephemeral_public_key, privateKey
        )
        setDecResult(r.plaintext)
      } else {
        const r = await api.elgamal.decrypt(parsed, privateKey)
        setDecResult(r.plaintext)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Decryption failed — check your key and ciphertext')
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
          <button className={`tab-item ${mode === 'encrypt' ? 'active' : ''}`} onClick={() => setMode('encrypt')}>
            Encrypt
          </button>
          <button className={`tab-item ${mode === 'decrypt' ? 'active' : ''}`} onClick={() => setMode('decrypt')}>
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
            <div>
              <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
                Message
              </label>
              <textarea
                className="input-base resize-none h-20"
                placeholder="Enter message to encrypt…"
                value={plaintext}
                onChange={e => setPlaintext(e.target.value)}
              />
            </div>
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

            {encResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                    Ciphertext JSON
                    {'original_length' in encResult && (
                      <span className="ml-2 badge badge-ecc">
                        {formatBytes(encResult.original_length)} → encrypted
                      </span>
                    )}
                  </span>
                  <button onClick={copyResult} className="flex items-center gap-1 text-2xs" style={{ color: 'var(--fg-subtle)' }}>
                    {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
                    {copied ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <div className="result-block">
                  {JSON.stringify(encResult, null, 2)}
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
            <div>
              <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
                Ciphertext (paste JSON from encryption)
              </label>
              <textarea
                className="input-base resize-none h-24 mono"
                placeholder='{"ciphertext": "…", "nonce": "…", …}'
                value={cipherPayload}
                onChange={e => setCipherPayload(e.target.value)}
              />
            </div>
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
