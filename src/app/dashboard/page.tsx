'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/lib/useRole'
import JourneyMatrix, { type MatrixRow } from '@/components/JourneyMatrix'
import FlakyLeaderboard, { type FlakyItem } from '@/components/FlakyLeaderboard'
import JourneyDetail from '@/components/JourneyDetail'
import ModuleHealthGrid from '@/components/ModuleHealthGrid'
import type { ModuleStat } from '@/types'

interface TestRun {
  id: string
  build_id: string
  started_at: string
  expected: number
  unexpected: number
  flaky: number
  skipped: number
  total: number
  duration_sec: number
  hard_fail_tests: string[]
  is_infra_failure: boolean
  hard_fail_rate: number
  flaky_rate: number
  report_url: string | null
  run_type: string | null
}

function passRate(run: TestRun) {
  return run.total > 0 ? (run.expected / run.total) * 100 : 100
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

type RunTypeKey = 'smoke' | 'regression' | 'sms-email' | string

function runTypeLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  if (raw === 'post-deploy' || raw === 'smoke') return 'smoke'
  if (raw === 'regression cron' || raw === 'regression') return 'regression'
  if (raw === 'sms-email cron' || raw === 'sms-email') return 'sms-email'
  return raw
}

function RunTypeBadge({ runType }: { runType: string | null | undefined }) {
  const label = runTypeLabel(runType)
  if (!label) return null
  const styles: Record<string, React.CSSProperties> = {
    smoke:      { background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' },
    regression: { background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' },
    'sms-email':{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' },
  }
  const s: React.CSSProperties = {
    fontSize: 9, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
    padding: '1px 5px', borderRadius: 4, flexShrink: 0,
    ...(styles[label] ?? { background: 'var(--bg-3)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }),
  }
  return <span style={s}>{label}</span>
}

// Multi-line chart: each status as % of total per run
function PassRateChart({ runs }: { runs: TestRun[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedIdx === null) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelectedIdx(null) }
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSelectedIdx(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [selectedIdx])

  const W = 560, H = 120
  const PAD = { top: 12, right: 16, bottom: 28, left: 40 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom

  const data = [...runs].reverse() // oldest → newest
  if (data.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Not enough data yet
      </div>
    )
  }

  const n = data.length
  const xPos = (i: number) => PAD.left + (i / (n - 1)) * cw
  const yPos = (pct: number) => PAD.top + (1 - pct / 100) * ch
  const hitW = Math.max(8, cw / Math.max(n - 1, 1))

  const pct = (count: number, total: number) => total > 0 ? (count / total) * 100 : 0

  const series = [
    { key: 'passed', vals: data.map(r => pct(r.expected, r.total)),   stroke: 'rgba(63,185,80,0.9)',   dot: 'var(--green)',      width: 1.5 },
    { key: 'failed', vals: data.map(r => pct(r.unexpected, r.total)), stroke: 'rgba(248,81,73,0.85)',  dot: 'var(--red)',        width: 1.2 },
    { key: 'flaky',  vals: data.map(r => pct(r.flaky, r.total)),      stroke: 'rgba(210,153,34,0.85)', dot: 'var(--yellow)',     width: 1.2 },
    { key: 'skipped',vals: data.map(r => pct(r.skipped, r.total)),    stroke: 'rgba(139,148,158,0.7)', dot: 'var(--text-muted)', width: 1   },
    { key: 'dnr',    vals: data.map(r => pct(Math.max(0, r.total - r.expected - r.unexpected - r.flaky - r.skipped), r.total)), stroke: 'rgba(100,110,125,0.5)', dot: 'var(--text-faint)', width: 1 },
  ]

  const labelStep = Math.max(1, Math.floor(n / 7))
  const selectedRun = selectedIdx !== null ? data[selectedIdx] : null
  const popupXPct = selectedIdx !== null ? (xPos(selectedIdx) / W) * 100 : 0

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* Grid lines */}
        {[100, 75, 50, 25, 0].map(v => (
          <g key={v}>
            <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + cw} y2={yPos(v)} stroke="var(--border-subtle)" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? undefined : '3 3'} />
            <text x={PAD.left - 6} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill="var(--text-faint)">{v}%</text>
          </g>
        ))}

        {/* Lines — render passed last so it's on top */}
        {[...series].reverse().map(s => (
          <polyline
            key={s.key}
            points={s.vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.width}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots on each line */}
        {series.flatMap(s => s.vals.map((v, i) => (
          <circle
            key={`${s.key}-${i}`}
            cx={xPos(i)} cy={yPos(v)}
            r={selectedIdx === i ? 3.5 : 2.5}
            fill={s.dot}
            stroke={selectedIdx === i ? 'var(--text-primary)' : 'var(--bg-2)'}
            strokeWidth={selectedIdx === i ? 1 : 1.5}
          />
        )))}

        {/* Selected run vertical line */}
        {selectedIdx !== null && (
          <line
            x1={xPos(selectedIdx)} y1={PAD.top}
            x2={xPos(selectedIdx)} y2={PAD.top + ch}
            stroke="var(--text-muted)" strokeWidth={0.5} strokeDasharray="3 3"
          />
        )}

        {/* X-axis time labels */}
        {data.map((run, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null
          const d = new Date(run.started_at)
          const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`
          return (
            <text key={run.id} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-faint)">
              {label}
            </text>
          )
        })}

        {/* Click hit strips — transparent rects, one per run */}
        {data.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={xPos(i) - hitW / 2}
            y={PAD.top}
            width={hitW}
            height={ch}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
          />
        ))}
      </svg>

      {/* Run detail popup */}
      {selectedRun && (
        <div style={{
          position: 'absolute',
          bottom: 32,
          left: `${Math.min(Math.max(popupXPct, 5), 72)}%`,
          transform: 'translateX(-50%)',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 11,
          zIndex: 50,
          minWidth: 210,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedRun.unexpected > 0 ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 12, color: selectedRun.unexpected > 0 ? 'var(--red)' : 'var(--green)' }}>
              {selectedRun.unexpected > 0 ? 'FAILED' : 'PASSED'}
            </span>
            <RunTypeBadge runType={selectedRun.run_type} />
          </div>
          {/* Counts */}
          {[
            { label: 'Passed',  val: selectedRun.expected,   color: 'var(--green)' },
            { label: 'Failed',  val: selectedRun.unexpected, color: 'var(--red)' },
            { label: 'Flaky',   val: selectedRun.flaky,      color: 'var(--yellow)' },
            { label: 'Skipped', val: selectedRun.skipped,    color: 'var(--text-muted)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
            </div>
          ))}
          {/* Meta */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>{fmtDuration(selectedRun.duration_sec)}</span>
            <span>{new Date(selectedRun.started_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {selectedRun.report_url && (
            <div style={{ marginTop: 6, pointerEvents: 'auto' }}>
              <a href={selectedRun.report_url} target="_blank" rel="noopener" style={{ fontSize: 10, color: 'var(--accent-text)', textDecoration: 'none' }}>
                View report →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Top tests by failure frequency across last N runs

const card: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '16px 20px',
}

interface SlowestItem {
  test_file: string
  test_name: string
  median_duration_ms: number
}

export default function Dashboard() {
  const router = useRouter()
  const { role } = useRole()
  const [runs, setRuns] = useState<TestRun[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [flaky, setFlaky] = useState<FlakyItem[]>([])
  const [slowest, setSlowest] = useState<SlowestItem[]>([])
  const [moduleStats, setModuleStats] = useState<ModuleStat[]>([])
  const [failedTests, setFailedTests] = useState<FlakyItem[]>([])
  const [detailFile, setDetailFile] = useState<string | null>(null)
  const [preset, setPreset] = useState<'today' | '7d' | '14d' | '30d' | 'all'>('30d')

  const PRESETS: { value: typeof preset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d',   label: '7d' },
    { value: '14d',  label: '14d' },
    { value: '30d',  label: '30d' },
    { value: 'all',  label: 'All' },
  ]

  function presetFrom(p: typeof preset): string | null {
    if (p === 'all') return null
    const d = new Date()
    if (p === 'today') { d.setHours(0, 0, 0, 0); return d.toISOString() }
    d.setDate(d.getDate() - parseInt(p))
    return d.toISOString()
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = presetFrom(preset)
      const fromParam = from ? `&from=${encodeURIComponent(from)}` : ''
      const presetDays: Record<typeof preset, number> = { today: 1, '7d': 7, '14d': 14, '30d': 30, all: 365 }
      const flakyDays = presetDays[preset]

      const runsUrl = `/api/test-runs?limit=500${fromParam}`
      const matrixUrl = from
        ? `/api/test-stats?type=journey-matrix&from=${encodeURIComponent(from)}`
        : `/api/test-stats?type=journey-matrix`
      const moduleUrl = from
        ? `/api/test-stats?type=module-stats&from=${encodeURIComponent(from)}`
        : `/api/test-stats?type=module-stats`
      const flakyUrl = `/api/test-stats?type=flaky&days=${flakyDays}${fromParam}`
      const failedUrl = `/api/test-stats?type=failed-tests&days=${flakyDays}${fromParam}`

      const [runsRes, matrixRes, flakyRes, failedRes, slowestRes, moduleRes] = await Promise.all([
        fetch(runsUrl),
        fetch(matrixUrl),
        fetch(flakyUrl),
        fetch(failedUrl),
        fetch('/api/test-stats?type=slowest'),
        fetch(moduleUrl),
      ])
      if (runsRes.ok) setRuns(await runsRes.json())
      if (matrixRes.ok) setMatrix(await matrixRes.json())
      if (flakyRes.ok) setFlaky(await flakyRes.json())
      if (failedRes.ok) setFailedTests(await failedRes.json())
      if (slowestRes.ok) setSlowest(await slowestRes.json())
      if (moduleRes.ok) setModuleStats(await moduleRes.json())
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  useEffect(() => { load() }, [load])

  const latest = runs[0]
  const avgPassRate = runs.length
    ? runs.reduce((s, r) => s + passRate(r), 0) / runs.length
    : null
  const totalRunsFailed = runs.filter(r => r.unexpected > 0).length
  const periodLabel = PRESETS.find(p => p.value === preset)!.label

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
        {role === 'qa' && (
          <>
            <button
              onClick={() => router.push('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-2)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              QA Atlas
            </button>
            <span style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>E2E Pipeline Dashboard</span>

        {/* Preset filter strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 12, background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: 2 }}>
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              style={{
                height: 22, padding: '0 9px', borderRadius: 5, fontSize: 11,
                fontWeight: preset === p.value ? 600 : 400,
                background: preset === p.value ? 'var(--accent)' : 'transparent',
                color: preset === p.value ? '#0a0a0b' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all .12s',
              }}
              onMouseEnter={e => { if (preset !== p.value) e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { if (preset !== p.value) e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', background: role === 'dev' ? 'rgba(59,130,246,0.12)' : 'var(--accent-soft)', border: `1px solid ${role === 'dev' ? 'rgba(59,130,246,0.3)' : 'var(--accent-border)'}`, color: role === 'dev' ? 'var(--blue)' : 'var(--accent-text)' }}>
          {role}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Updated {relativeTime(lastRefresh.toISOString())}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-2)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </header>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {/* Last run */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Last Run</div>
            {loading && !latest ? (
              <div style={{ height: 40, background: 'var(--bg-3)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ) : latest ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: latest.unexpected > 0 ? 'var(--red)' : 'var(--green)',
                    boxShadow: latest.unexpected > 0 ? '0 0 6px var(--red)' : '0 0 6px var(--green)',
                  }} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: latest.unexpected > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {latest.unexpected > 0 ? 'FAILED' : 'PASSED'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(latest.started_at)}</div>
                {latest.report_url && (
                  <a href={latest.report_url} target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>
                    View report →
                  </a>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No runs yet</div>
            )}
          </div>

          {/* Test counts */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Last Run Counts</div>
            {latest ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: 'Passed', val: latest.expected, color: 'var(--green)' },
                  { label: 'Failed', val: latest.unexpected, color: 'var(--red)' },
                  { label: 'Flaky',  val: latest.flaky,      color: 'var(--yellow)' },
                  { label: 'Skipped', val: latest.skipped,   color: 'var(--text-muted)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(latest.duration_sec)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
            )}
          </div>

          {/* Pass rate for selected period */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Avg Pass Rate · {periodLabel}</div>
            {avgPassRate !== null ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: avgPassRate >= 90 ? 'var(--green)' : avgPassRate >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                  {avgPassRate.toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {runs.length} runs · {totalRunsFailed} failed
                </div>
                {/* Mini bar */}
                <div style={{ marginTop: 10, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${avgPassRate}%`, height: '100%', background: avgPassRate >= 90 ? 'var(--green)' : avgPassRate >= 70 ? 'var(--yellow)' : 'var(--red)', borderRadius: 2 }} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No runs yet</div>
            )}
          </div>

          {/* Flaky stats */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Flaky · {periodLabel}</div>
            {runs.length > 0 ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: 'var(--yellow)' }}>
                  {runs.reduce((s, r) => s + r.flaky, 0)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  flaky test instances
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  avg {(runs.reduce((s, r) => s + r.flaky_rate * 100, 0) / runs.length).toFixed(1)}% rate/run
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No runs yet</div>
            )}
          </div>

        </div>

        {/* Chart + failing tests row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
          {/* Pass rate chart */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Pass Rate Trend</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{runs.length} runs · {periodLabel}</span>
            </div>
            <PassRateChart runs={runs.slice(0, 60)} />
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              {[
                { color: 'var(--green)',     label: 'Passed' },
                { color: 'var(--red)',       label: 'Failed' },
                { color: 'var(--yellow)',    label: 'Flaky' },
                { color: 'var(--text-muted)', label: 'Skipped' },
                { color: 'var(--text-faint)', label: 'Did not run' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 16, height: 2, borderRadius: 1, background: color, opacity: 0.85, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top failing tests */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Most Failed Tests · {periodLabel}</div>
            {failedTests.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {failedTests.map(item => {
                  const maxCount = failedTests[0]?.flaky_count ?? 1
                  const barPct = (item.flaky_count / maxCount) * 100
                  return (
                    <div key={`${item.test_file}::${item.test_name}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, lineHeight: 1.4 }} title={item.test_name}>
                          {item.test_name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{item.flaky_count}×</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--red)', opacity: 0.7, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No failures recorded</div>
            )}
          </div>
        </div>

        {/* Module Health */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>Module Health · {periodLabel}</div>
          <ModuleHealthGrid data={moduleStats} />
        </div>

        {/* Journey Health Matrix */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>Journey Health Matrix · {periodLabel}</div>
          {(() => {
            const journeyRows = matrix.filter(r => r.test_file.includes('/journeys/') || r.test_file.includes('journey.spec'))
            const apiRows = matrix.filter(r => r.test_file.includes('/api/') || r.test_file.includes('-api.spec'))
            const otherRows = matrix.filter(r => !journeyRows.includes(r) && !apiRows.includes(r))
            const hasJourneys = journeyRows.length > 0
            const hasApi = apiRows.length > 0
            if (!hasJourneys && !hasApi) {
              return <JourneyMatrix title="All Tests" rows={matrix} onRowClick={setDetailFile} />
            }
            return (
              <>
                {hasJourneys && <JourneyMatrix title="UI Journeys" rows={journeyRows} onRowClick={setDetailFile} />}
                {hasApi && (
                  <div style={{ marginTop: 20 }}>
                    <JourneyMatrix title="API Tests" rows={apiRows} onRowClick={setDetailFile} />
                  </div>
                )}
                {otherRows.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <JourneyMatrix title="Other" rows={otherRows} onRowClick={setDetailFile} />
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Flaky leaderboard + Slowest tests */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Flaky Leaderboard · {periodLabel}</div>
            <FlakyLeaderboard data={flaky} />
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Slowest Tests · Median</div>
            {slowest.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No duration data yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {slowest.map((item, i) => (
                  <div key={`${item.test_file}::${item.test_name}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.test_name}>
                        {item.test_name}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.test_file.split('/').pop()}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: item.median_duration_ms > 30000 ? 'var(--red)' : item.median_duration_ms > 15000 ? 'var(--yellow)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {item.median_duration_ms >= 60000
                        ? `${Math.floor(item.median_duration_ms / 60000)}m${Math.round((item.median_duration_ms % 60000) / 1000)}s`
                        : `${(item.median_duration_ms / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent runs */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Recent Runs</div>
          {runs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 60px 60px 60px', gap: 8, padding: '0 4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                {['Status', 'Type', 'Build', 'Pass', 'Fail', 'Time'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {runs.slice(0, 12).map(run => (
                <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 60px 60px 60px', gap: 8, padding: '5px 4px', borderRadius: 5, cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: run.unexpected > 0 ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: run.unexpected > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>{run.unexpected > 0 ? 'FAIL' : 'PASS'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <RunTypeBadge runType={run.run_type} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={run.build_id}>
                    {run.report_url
                      ? <a href={run.report_url} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>{relativeTime(run.started_at)}</a>
                      : relativeTime(run.started_at)
                    }
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{run.expected}</span>
                  <span style={{ fontSize: 11, color: run.unexpected > 0 ? 'var(--red)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{run.unexpected}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(run.duration_sec)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No runs recorded yet</div>
          )}
        </div>
      </div>

      <JourneyDetail testFile={detailFile} onClose={() => setDetailFile(null)} />
    </div>
  )
}
