'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/lib/useRole'

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

// Simple SVG sparkline for pass rate over last N runs
function PassRateChart({ runs }: { runs: TestRun[] }) {
  const W = 560, H = 110
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

  const rates = data.map(passRate)
  const minY = Math.max(0, Math.min(...rates) - 5)
  const maxY = 100

  const xPos = (i: number) => PAD.left + (i / (data.length - 1)) * cw
  const yPos = (r: number) => PAD.top + (1 - (r - minY) / (maxY - minY)) * ch

  const polyline = rates.map((r, i) => `${xPos(i)},${yPos(r)}`).join(' ')

  // Grid lines at 25% intervals
  const gridY = [100, 75, 50, 25].filter(v => v >= minY)

  // Label every ~7 runs to avoid clutter
  const labelStep = Math.max(1, Math.floor(data.length / 7))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid */}
      {gridY.map(v => (
        <g key={v}>
          <line
            x1={PAD.left} y1={yPos(v)} x2={PAD.left + cw} y2={yPos(v)}
            stroke="var(--border-subtle)" strokeWidth={1}
          />
          <text x={PAD.left - 6} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill="var(--text-faint)">{v}%</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon
        points={`${PAD.left},${PAD.top + ch} ${polyline} ${PAD.left + cw},${PAD.top + ch}`}
        fill="rgba(63,185,80,0.06)"
      />

      {/* Line */}
      <polyline points={polyline} fill="none" stroke="var(--green)" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Dots — colored by pass/fail */}
      {data.map((run, i) => (
        <circle
          key={run.id}
          cx={xPos(i)} cy={yPos(rates[i])}
          r={3}
          fill={run.unexpected > 0 ? 'var(--red)' : 'var(--green)'}
          stroke="var(--bg-2)" strokeWidth={1.5}
        />
      ))}

      {/* X-axis time labels */}
      {data.map((run, i) => {
        if (i % labelStep !== 0 && i !== data.length - 1) return null
        const d = new Date(run.started_at)
        const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`
        return (
          <text key={run.id} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text-faint)">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// Top tests by failure frequency across last N runs
function topFailingTests(runs: TestRun[], topN = 8): Array<{ name: string; count: number; rate: number }> {
  const counts: Record<string, number> = {}
  for (const run of runs) {
    for (const t of run.hard_fail_tests ?? []) {
      counts[t] = (counts[t] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, count]) => ({ name, count, rate: runs.length > 0 ? (count / runs.length) * 100 : 0 }))
}

const card: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: '16px 20px',
}

export default function Dashboard() {
  const router = useRouter()
  const { role } = useRole()
  const [runs, setRuns] = useState<TestRun[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const runsRes = await fetch('/api/test-runs?limit=60')
      if (runsRes.ok) setRuns(await runsRes.json())
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const latest = runs[0]
  const last14days = runs.filter(r => Date.now() - new Date(r.started_at).getTime() < 14 * 86400000)
  const allTimeFailing = topFailingTests(runs)
  const avgPassRate14 = last14days.length
    ? last14days.reduce((s, r) => s + passRate(r), 0) / last14days.length
    : null

  const totalRunsFailed = last14days.filter(r => r.unexpected > 0).length

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
          <div style={{ ...card, gridColumn: 'span 1' }}>
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

          {/* 14-day pass rate */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Avg Pass Rate · 14d</div>
            {avgPassRate14 !== null ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: avgPassRate14 >= 90 ? 'var(--green)' : avgPassRate14 >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                  {avgPassRate14.toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {last14days.length} runs · {totalRunsFailed} failed
                </div>
                {/* Mini bar */}
                <div style={{ marginTop: 10, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${avgPassRate14}%`, height: '100%', background: avgPassRate14 >= 90 ? 'var(--green)' : avgPassRate14 >= 70 ? 'var(--yellow)' : 'var(--red)', borderRadius: 2 }} />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No runs yet</div>
            )}
          </div>

          {/* Flaky stats */}
          <div style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Flaky · Last 14d</div>
            {last14days.length > 0 ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: 'var(--yellow)' }}>
                  {last14days.reduce((s, r) => s + r.flaky, 0)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  flaky test instances
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  avg {(last14days.reduce((s, r) => s + r.flaky_rate * 100, 0) / last14days.length).toFixed(1)}% rate/run
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>last {Math.min(runs.length, 60)} runs</span>
            </div>
            <PassRateChart runs={runs.slice(0, 60)} />
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              {[{ color: 'var(--green)', label: 'All passed' }, { color: 'var(--red)', label: 'Had failures' }].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top failing tests */}
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Most Failed Tests</div>
            {allTimeFailing.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allTimeFailing.map(({ name, count, rate }) => (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, lineHeight: 1.4 }} title={name}>
                        {name.split('/').pop()}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{count}×</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', background: `color-mix(in srgb, var(--red) ${Math.round(rate + 30)}%, var(--yellow))`, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No failures recorded</div>
            )}
          </div>
        </div>

        {/* Recent runs */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Recent Runs</div>
          {runs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px 60px 60px', gap: 8, padding: '0 4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                {['Status', 'Build', 'Pass', 'Fail', 'Time'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {runs.slice(0, 12).map(run => (
                <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px 60px 60px', gap: 8, padding: '5px 4px', borderRadius: 5, cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: run.unexpected > 0 ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: run.unexpected > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>{run.unexpected > 0 ? 'FAIL' : 'PASS'}</span>
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
    </div>
  )
}
