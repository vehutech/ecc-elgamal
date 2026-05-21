'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Play, AlertCircle } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement,
  Title, Tooltip, Legend, type ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { api, BenchmarkComparison } from '@/lib/api'
import { Spinner, ChartSkeleton } from '@/components/ui/Skeleton'
import { formatMs, formatKB } from '@/lib/utils'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement,
  Title, Tooltip, Legend
)

const PAYLOAD_OPTIONS = [
  { label: '1 KB',   bytes: 1024 },
  { label: '10 KB',  bytes: 10240 },
  { label: '100 KB', bytes: 102400 },
  { label: '1 MB',   bytes: 1048576 },
]

const ECC_COLOR     = 'rgba(108, 99, 255, 0.85)'
const ECC_BORDER    = 'rgba(108, 99, 255, 1)'
const ELGAMAL_COLOR = 'rgba(160, 160, 180, 0.6)'
const ELGAMAL_BORDER= 'rgba(160, 160, 180, 1)'

export function BenchmarkPanel() {
  const [payloadSize, setPayloadSize] = useState(1024)
  const [iterations, setIterations] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BenchmarkComparison | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api.benchmark.compare(payloadSize, iterations)
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Benchmark failed')
    } finally {
      setLoading(false)
    }
  }

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'var(--fg-muted)' as string,
          font: { family: 'Inter', size: 11 },
          boxWidth: 10,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'var(--bg-raised)' as string,
        titleColor: 'var(--fg)' as string,
        bodyColor: 'var(--fg-muted)' as string,
        borderColor: 'var(--border)' as string,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)} ms`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'var(--fg-subtle)' as string, font: { size: 10 } },
        grid: { color: 'var(--border)' as string },
      },
      y: {
        ticks: { color: 'var(--fg-subtle)' as string, font: { size: 10 } },
        grid: { color: 'var(--border)' as string },
        title: { display: true, text: 'ms', color: 'var(--fg-subtle)' as string, font: { size: 10 } },
      },
    },
  }

  const memChartOptions: ChartOptions<'bar'> = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...(chartOptions.plugins?.tooltip as object),
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} KB`,
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...(chartOptions.scales?.y as object),
        title: { display: true, text: 'KB', color: 'var(--fg-subtle)' as string, font: { size: 10 } },
      },
    },
  }

  return (
    <div className="card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--fg)' }}>
          Performance Benchmark
        </h2>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
            Payload Size
          </label>
          <div className="tab-bar">
            {PAYLOAD_OPTIONS.map(opt => (
              <button
                key={opt.bytes}
                className={`tab-item ${payloadSize === opt.bytes ? 'active' : ''}`}
                onClick={() => setPayloadSize(opt.bytes)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-2xs mb-1 block" style={{ color: 'var(--fg-subtle)' }}>
            Iterations: <strong style={{ color: 'var(--fg)' }}>{iterations}</strong>
          </label>
          <input
            type="range" min={10} max={200} step={10}
            value={iterations}
            onChange={e => setIterations(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>
      </div>

      <button className="btn-primary justify-center" onClick={run} disabled={loading}>
        {loading ? <Spinner size={14} /> : <Play size={14} />}
        {loading ? `Running ${iterations} iterations…` : 'Run Benchmark'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <AnimatePresence>
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-4">
            <ChartSkeleton />
            <ChartSkeleton />
          </motion.div>
        )}

        {result && !loading && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} className="space-y-6">

            {/* Speed-up ratios */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <RatioCard label="Keygen Speedup" value={`${result.ratios.keygen_speedup}×`} sub="ECC faster" />
              <RatioCard label="Encrypt Speedup" value={`${result.ratios.encrypt_speedup}×`} sub="ECC faster" />
              <RatioCard label="Decrypt Speedup" value={`${result.ratios.decrypt_speedup}×`} sub="ECC faster" />
              <RatioCard label="Memory Saved" value={`${result.ratios.memory_reduction_pct}%`} sub="by ECC" />
            </div>

            {/* Key generation bar */}
            <ChartBlock title="Key Generation Speed (ms)">
              <Bar
                data={{
                  labels: ['Key Generation'],
                  datasets: [
                    { label: 'ECC P-256', data: [result.ecc.keygen.mean_ms], backgroundColor: ECC_COLOR, borderColor: ECC_BORDER, borderWidth: 1, borderRadius: 6 },
                    { label: 'ElGamal 3072', data: [result.elgamal.keygen.mean_ms], backgroundColor: ELGAMAL_COLOR, borderColor: ELGAMAL_BORDER, borderWidth: 1, borderRadius: 6 },
                  ],
                }}
                options={chartOptions}
              />
            </ChartBlock>

            {/* Encryption speed bar */}
            <ChartBlock title="Encryption Speed (ms)">
              <Bar
                data={{
                  labels: ['Encryption'],
                  datasets: [
                    { label: 'ECC P-256', data: [result.ecc.encrypt.mean_ms], backgroundColor: ECC_COLOR, borderColor: ECC_BORDER, borderWidth: 1, borderRadius: 6 },
                    { label: 'ElGamal 3072', data: [result.elgamal.encrypt.mean_ms], backgroundColor: ELGAMAL_COLOR, borderColor: ELGAMAL_BORDER, borderWidth: 1, borderRadius: 6 },
                  ],
                }}
                options={chartOptions}
              />
            </ChartBlock>

            {/* Decryption speed bar */}
            <ChartBlock title="Decryption Speed (ms)">
              <Bar
                data={{
                  labels: ['Decryption'],
                  datasets: [
                    { label: 'ECC P-256', data: [result.ecc.decrypt.mean_ms], backgroundColor: ECC_COLOR, borderColor: ECC_BORDER, borderWidth: 1, borderRadius: 6 },
                    { label: 'ElGamal 3072', data: [result.elgamal.decrypt.mean_ms], backgroundColor: ELGAMAL_COLOR, borderColor: ELGAMAL_BORDER, borderWidth: 1, borderRadius: 6 },
                  ],
                }}
                options={chartOptions}
              />
            </ChartBlock>

            {/* Memory bar */}
            <ChartBlock title="Peak Memory Consumption (KB)">
              <Bar
                data={{
                  labels: ['Encrypt Memory', 'Decrypt Memory'],
                  datasets: [
                    { label: 'ECC P-256', data: [result.ecc.encrypt.peak_mem_kb, result.ecc.decrypt.peak_mem_kb], backgroundColor: ECC_COLOR, borderColor: ECC_BORDER, borderWidth: 1, borderRadius: 6 },
                    { label: 'ElGamal 3072', data: [result.elgamal.encrypt.peak_mem_kb, result.elgamal.decrypt.peak_mem_kb], backgroundColor: ELGAMAL_COLOR, borderColor: ELGAMAL_BORDER, borderWidth: 1, borderRadius: 6 },
                  ],
                }}
                options={memChartOptions as ChartOptions<'bar'>}
              />
            </ChartBlock>

            {/* Summary table */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--fg-muted)' }}>
                Detailed Statistics — {result.payload_size_label} payload, {result.iterations} iterations
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ color: 'var(--fg-muted)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="text-left py-2 pr-4 text-2xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>Metric</th>
                      <th className="text-right py-2 px-3 text-2xs uppercase tracking-wider" style={{ color: '#8B83FF' }}>ECC</th>
                      <th className="text-right py-2 pl-3 text-2xs uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>ElGamal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Keygen mean', formatMs(result.ecc.keygen.mean_ms), formatMs(result.elgamal.keygen.mean_ms)],
                      ['Keygen std', formatMs(result.ecc.keygen.std_ms), formatMs(result.elgamal.keygen.std_ms)],
                      ['Encrypt mean', formatMs(result.ecc.encrypt.mean_ms), formatMs(result.elgamal.encrypt.mean_ms)],
                      ['Encrypt memory', formatKB(result.ecc.encrypt.peak_mem_kb), formatKB(result.elgamal.encrypt.peak_mem_kb)],
                      ['Decrypt mean', formatMs(result.ecc.decrypt.mean_ms), formatMs(result.elgamal.decrypt.mean_ms)],
                      ['Decrypt memory', formatKB(result.ecc.decrypt.peak_mem_kb), formatKB(result.elgamal.decrypt.peak_mem_kb)],
                      ['Ciphertext size', formatKB(result.ecc.ciphertext_size_bytes / 1024), formatKB(result.elgamal.ciphertext_size_bytes / 1024)],
                    ].map(([label, ecc, elg]) => (
                      <tr key={label as string} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-1.5 pr-4" style={{ color: 'var(--fg-subtle)' }}>{label}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium" style={{ color: '#8B83FF' }}>{ecc}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums" style={{ color: 'var(--fg-muted)' }}>{elg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>{title}</p>
      <div style={{ height: 200 }}>{children}</div>
    </div>
  )
}

function RatioCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card p-3 text-center"
    >
      <p className="text-2xs mb-1" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
      <p className="text-lg font-bold font-display tabular-nums" style={{ color: 'var(--accent)' }}>{value}</p>
      <p className="text-2xs" style={{ color: 'var(--fg-subtle)' }}>{sub}</p>
    </motion.div>
  )
}
