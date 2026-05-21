/**
 * lib/api.ts
 * CipherDuel — typed API client
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ECCKeyPair {
  private_key_pem: string
  public_key_pem: string
  curve: string
  key_size_bits: number
  security_level_bits: number
}

export interface ElGamalKeyPair {
  private_key: string
  public_key: string
  p: string
  g: string
  key_size_bits: number
  security_level_bits: number
  group: string
}

export interface ECCCiphertext {
  ephemeral_public_key: string
  nonce: string
  ciphertext: string
  algorithm: string
  original_length: number
}

export interface ElGamalCiphertext {
  blocks: Array<{ c1: string; c2: string }>
  block_count: number
  original_length: number
  algorithm: string
}

export interface OperationStats {
  mean_ms: number
  median_ms: number
  std_ms: number
  min_ms: number
  max_ms: number
  peak_mem_kb: number
  iterations: number
  outliers_removed: number
}

export interface AlgorithmBenchmark {
  algorithm: string
  payload_size_bytes: number
  payload_size_label: string
  keygen: OperationStats
  encrypt: OperationStats
  decrypt: OperationStats
  ciphertext_size_bytes: number
  key_size_bits: number
  security_level_bits: number
}

export interface BenchmarkComparison {
  ecc: AlgorithmBenchmark
  elgamal: AlgorithmBenchmark
  ratios: {
    keygen_speedup: number
    encrypt_speedup: number
    decrypt_speedup: number
    memory_reduction_pct: number
    ciphertext_size_ratio: number
  }
  payload_size_bytes: number
  payload_size_label: string
  iterations: number
}

export interface TransmissionResult {
  algorithm: string
  sender: {
    port: number
    message: string
    message_length: number
    encryption_time_ms: number
    memory_kb: number
  }
  channel: {
    ciphertext_size_bytes: number
    expansion_ratio: number
  }
  receiver: {
    port: number
    recovered_message: string
    decryption_time_ms: number
    memory_kb: number
  }
  integrity: {
    status: 'VERIFIED' | 'FAILED'
    original_sha256: string
    recovered_sha256: string
    match: boolean
  }
  total_time_ms: number
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  health: () => get<{ status: string }>('/health'),

  ecc: {
    keygen: () => post<ECCKeyPair>('/ecc/keygen', {}),
    encrypt: (plaintext: string, public_key_pem: string) =>
      post<ECCCiphertext>('/ecc/encrypt', { plaintext, public_key_pem }),
    decrypt: (
      ciphertext: string,
      nonce: string,
      ephemeral_public_key: string,
      private_key_pem: string,
    ) =>
      post<{ plaintext: string; length: number }>('/ecc/decrypt', {
        ciphertext, nonce, ephemeral_public_key, private_key_pem,
      }),
  },

  elgamal: {
    keygen: () => post<ElGamalKeyPair>('/elgamal/keygen', {}),
    encrypt: (plaintext: string, public_key: string) =>
      post<ElGamalCiphertext>('/elgamal/encrypt', { plaintext, public_key }),
    decrypt: (encrypted_data: ElGamalCiphertext, private_key: string) =>
      post<{ plaintext: string; length: number }>('/elgamal/decrypt', {
        encrypted_data, private_key,
      }),
  },

  transmit: (message: string, algorithm: 'ecc' | 'elgamal') =>
    post<TransmissionResult>('/transmit', { message, algorithm }),

  benchmark: {
    compare: (payload_size_bytes: number, iterations: number) =>
      post<BenchmarkComparison>('/benchmark', { payload_size_bytes, iterations }),
    ecc: (payload_size_bytes: number, iterations: number) =>
      post<AlgorithmBenchmark>('/benchmark/ecc', { payload_size_bytes, iterations }),
    elgamal: (payload_size_bytes: number, iterations: number) =>
      post<AlgorithmBenchmark>('/benchmark/elgamal', { payload_size_bytes, iterations }),
  },
}
