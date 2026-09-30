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

export type BenchmarkAlgorithm = 'ecc' | 'elgamal'
export type BenchmarkOp = 'keygen' | 'encrypt' | 'decrypt'

interface BenchmarkEventBase {
  algorithm: BenchmarkAlgorithm
  op: BenchmarkOp
}

/** Progress events streamed by POST /benchmark/stream (see backend/main.py). */
export type BenchmarkEvent = BenchmarkEventBase & (
  | { type: 'stage'; iterations: number }
  | { type: 'iteration'; i: number; n: number; ms: number }
  /** ElGamal only: one plaintext block done; value = first 16 hex digits of c1 (encrypt) or m (decrypt). */
  | { type: 'block'; block: number; blocks: number; value: string }
  | { type: 'memory_start' }
  | { type: 'memory'; peak_kb: number }
)

type BenchmarkStreamLine =
  | BenchmarkEvent
  | { type: 'result'; data: BenchmarkComparison }
  | { type: 'error'; detail: string }

/**
 * ElGamal encrypt/decrypt iteration caps by payload size, mirroring
 * ELGAMAL_ITERATION_CAPS in backend/benchmark_module.py.
 */
const ELGAMAL_ITERATION_CAPS: ReadonlyArray<readonly [number, number]> = [
  [1048576, 1],
  [102400, 5],
  [10240, 20],
]

export function elgamalIterations(payloadBytes: number, requested: number): number {
  for (const [minBytes, cap] of ELGAMAL_ITERATION_CAPS) {
    if (payloadBytes >= minBytes) return Math.min(requested, cap)
  }
  return requested
}

async function streamBenchmark(
  payload_size_bytes: number,
  iterations: number,
  onEvent: (event: BenchmarkEvent) => void,
  signal?: AbortSignal,
): Promise<BenchmarkComparison> {
  const res = await fetch(`${BASE}/benchmark/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload_size_bytes, iterations }),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line) continue
      const event = JSON.parse(line) as BenchmarkStreamLine
      if (event.type === 'result') return event.data
      if (event.type === 'error') throw new Error(event.detail)
      onEvent(event)
    }
  }
  throw new Error('The benchmark stopped before it finished. Check that the backend is still running, then run it again.')
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
  health: () => get<{ status: string; commit: string }>('/health'),

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
    stream: streamBenchmark,
    compare: (payload_size_bytes: number, iterations: number) =>
      post<BenchmarkComparison>('/benchmark', { payload_size_bytes, iterations }),
    ecc: (payload_size_bytes: number, iterations: number) =>
      post<AlgorithmBenchmark>('/benchmark/ecc', { payload_size_bytes, iterations }),
    elgamal: (payload_size_bytes: number, iterations: number) =>
      post<AlgorithmBenchmark>('/benchmark/elgamal', { payload_size_bytes, iterations }),
  },
}
