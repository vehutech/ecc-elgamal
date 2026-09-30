'use client'

import { useEffect, useState } from 'react'
import type { BenchmarkAlgorithm, BenchmarkEvent, BenchmarkOp } from '@/lib/api'
import { formatMs, formatKB } from '@/lib/utils'

// Live view of a running benchmark. Every number shown comes from a progress
// event streamed by POST /benchmark/stream; the formulas are the operations
// the backend is executing at that moment.

type StagePhase = 'pending' | 'timing' | 'memory' | 'done'

interface StageState {
  algorithm: BenchmarkAlgorithm
  op: BenchmarkOp
  phase: StagePhase
  iterations: number
  done: number
  totalMs: number
  lastMs: number | null
  peakKb: number | null
}

interface BlockState {
  block: number
  blocks: number
  value: string
}

export interface ProgressState {
  stages: StageState[]
  block: BlockState | null
  log: string[]
}

const STAGE_ORDER: ReadonlyArray<readonly [BenchmarkAlgorithm, BenchmarkOp]> = [
  ['ecc', 'keygen'], ['ecc', 'encrypt'], ['ecc', 'decrypt'],
  ['elgamal', 'keygen'], ['elgamal', 'encrypt'], ['elgamal', 'decrypt'],
]

const ALGO_LABEL: Record<BenchmarkAlgorithm, string> = { ecc: 'ECC P-256', elgamal: 'ElGamal 3072' }

const FORMULAS: Record<BenchmarkAlgorithm, Record<BenchmarkOp, string[]>> = {
  ecc: {
    keygen: ['d ←$ [1, n−1]', 'Q = d·G   (point multiplication on P-256)'],
    encrypt: ['k ←$ [1, n−1],  R = k·G,  S = k·Q', 'K = HKDF-SHA256(S),  C = AES-256-GCM_K(m)'],
    decrypt: ['S = d·R,  K = HKDF-SHA256(S)', 'm = AES-256-GCM⁻¹_K(C)'],
  },
  elgamal: {
    keygen: ['x ←$ [2, q−1]', 'h = gˣ mod p   (p: 3072-bit safe prime)'],
    encrypt: ['y ←$ [2, q−1]   (fresh per 383-byte block)', 'c₁ = gʸ mod p,  c₂ = m·hʸ mod p'],
    decrypt: ['s = c₁ˣ mod p', 'm = c₂·s⁻¹ mod p'],
  },
}

const LOG_LINES = 6

export function initialProgress(): ProgressState {
  return {
    stages: STAGE_ORDER.map(([algorithm, op]) => ({
      algorithm, op, phase: 'pending', iterations: 0, done: 0, totalMs: 0, lastMs: null, peakKb: null,
    })),
    block: null,
    log: [],
  }
}

export function progressReducer(state: ProgressState, event: BenchmarkEvent): ProgressState {
  const index = STAGE_ORDER.findIndex(([a, o]) => a === event.algorithm && o === event.op)
  if (index === -1) return state
  const stage = state.stages[index]
  const tag = `${event.algorithm === 'ecc' ? 'ECC' : 'ELG'} ${event.op.padEnd(7)}`
  let next: StageState = stage
  let { block, log } = state

  switch (event.type) {
    case 'stage':
      next = { ...stage, phase: 'timing', iterations: event.iterations }
      block = null
      break
    case 'iteration':
      next = { ...stage, done: event.i, totalMs: stage.totalMs + event.ms, lastMs: event.ms }
      log = [...log, `${tag} #${event.i}/${event.n}  ${formatMs(event.ms)}`].slice(-LOG_LINES)
      break
    case 'block':
      block = { block: event.block, blocks: event.blocks, value: event.value }
      break
    case 'memory_start':
      next = { ...stage, phase: 'memory' }
      block = null
      break
    case 'memory':
      next = { ...stage, phase: 'done', peakKb: event.peak_kb }
      log = [...log, `${tag} tracemalloc peak ${formatKB(event.peak_kb)}`].slice(-LOG_LINES)
      break
  }

  const stages = next === stage ? state.stages : state.stages.map((s, i) => (i === index ? next : s))
  return { stages, block, log }
}

/** Fraction of one stage complete: timed iterations plus one traced memory run. */
function stageFraction(stage: StageState, block: BlockState | null): number {
  const runs = stage.iterations + 1
  switch (stage.phase) {
    case 'pending': return 0
    case 'done': return 1
    case 'memory': return stage.iterations / runs
    case 'timing': {
      const partial = block ? block.block / block.blocks : 0
      return Math.min(stage.done + partial, stage.iterations) / runs
    }
  }
}

export function BenchmarkProgress({ progress }: { progress: ProgressState }) {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const { stages, block, log } = progress
  const activeIndex = stages.findIndex(s => s.phase === 'timing' || s.phase === 'memory')
  const active = activeIndex === -1 ? null : stages[activeIndex]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* No overall percentage: stages differ in cost by orders of magnitude
          (ElGamal encrypt/decrypt dominate), so an average would mislead. */}
      <div>
        <div className="flex justify-between text-2xs tabular-nums" style={{ color: 'var(--fg-subtle)' }}>
          <span>
            {active
              ? `Stage ${activeIndex + 1} of ${stages.length} · ${ALGO_LABEL[active.algorithm]} · ${active.op}`
              : 'Connecting to benchmark…'}
          </span>
          <span>elapsed {formatMs(now - startedAt)}</span>
        </div>
      </div>

      {/* Live computation */}
      <div className="rounded-lg p-4 mono text-xs space-y-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
        {active ? (
          <>
            <div className="space-y-1" style={{ color: 'var(--fg)' }}>
              {FORMULAS[active.algorithm][active.op].map(line => <div key={line}>{line}</div>)}
            </div>
            {active.phase === 'memory' ? (
              <div style={{ color: 'var(--fg-subtle)' }}>
                Timing done. Tracing heap allocations for one untimed run (tracemalloc)…
              </div>
            ) : (
              <div className="space-y-2 tabular-nums">
                <div>
                  iteration {Math.min(active.done + 1, active.iterations)}/{active.iterations}
                  {active.lastMs !== null && <> · last {formatMs(active.lastMs)} · mean {formatMs(active.totalMs / active.done)}</>}
                </div>
                {block && (
                  <>
                    <div>
                      block {block.block}/{block.blocks} ·{' '}
                      <span style={{ color: 'var(--accent)' }}>
                        {active.op === 'decrypt' ? 'm' : 'c₁'} = 0x{block.value}…
                      </span>
                    </div>
                    <Bar fraction={block.block / block.blocks} thin />
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--fg-subtle)' }}>Waiting for the first result from the server…</div>
        )}
      </div>

      {/* Stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {stages.map(s => (
          <div key={`${s.algorithm}-${s.op}`} className="text-2xs">
            <div className="flex justify-between mb-1 tabular-nums"
              style={{ color: s.phase === 'pending' ? 'var(--fg-subtle)' : 'var(--fg-muted)' }}>
              <span>{ALGO_LABEL[s.algorithm]} · {s.op}</span>
              <span>{stageStatus(s)}</span>
            </div>
            <Bar fraction={stageFraction(s, s === active ? block : null)} thin />
          </div>
        ))}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="mono text-2xs tabular-nums space-y-0.5" style={{ color: 'var(--fg-subtle)' }}>
          {log.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)}
        </div>
      )}
    </div>
  )
}

function stageStatus(s: StageState): string {
  switch (s.phase) {
    case 'pending': return 'pending'
    case 'memory': return 'measuring memory'
    case 'timing': return `${s.done}/${s.iterations}`
    case 'done': return `mean ${formatMs(s.totalMs / Math.max(s.done, 1))}`
  }
}

function Bar({ fraction, thin = false }: { fraction: number; thin?: boolean }) {
  return (
    <div className={`w-full rounded-full overflow-hidden ${thin ? 'h-1' : 'h-1.5'}`}
      style={{ background: 'var(--bg-raised)' }}>
      <div className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${Math.min(fraction, 1) * 100}%`, background: 'var(--accent)' }} />
    </div>
  )
}
