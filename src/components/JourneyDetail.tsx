'use client'
import { useEffect, useState } from 'react'

interface DetailRun {
  run_id: string
  started_at: string
}

interface DetailTest {
  test_name: string
  median_duration_ms: number | null
  top_error: string | null
  runs: { run_id: string; started_at: string; status: string }[]
}

interface DetailData {
  runs: DetailRun[]
  tests: DetailTest[]
}

interface TimelineEntry {
  run_id: string
  started_at: string
  status: string
  run_type: string | null
  report_url: string | null
}

interface Props {
  testFile: string | null
  runs?: number
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  passed:  'var(--green)',
  failed:  'var(--red)',
  flaky:   'var(--yellow)',
  skipped: 'var(--text-faint)',
  not_run: 'var(--bg-3)',
}

const STATUS_RANK: Record<string, number> = { failed: 0, flaky: 1, skipped: 2, passed: 3, not_run: 4 }

function worstStatusPerRun(data: DetailData): Map<string, string> {
  const map = new Map<string, string>()
  for (const test of data.tests) {
    for (const r of test.runs) {
      const cur = map.get(r.run_id)
      if (!cur || STATUS_RANK[r.status] < STATUS_RANK[cur]) {
        map.set(r.run_id, r.status)
      }
    }
  }
  return map
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtMs(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

function runTypeLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  if (raw === 'post-deploy' || raw === 'smoke') return 'smoke'
  if (raw === 'regression cron' || raw === 'regression') return 'regression'
  if (raw === 'sms-email cron' || raw === 'sms-email') return 'sms-email'
  return raw
}

// ─── Inline test timeline ─────────────────────────────────────────────────────

function TestTimeline({ testName, testFile, onBack }: {
  testName: string
  testFile: string
  onBack: () => void
}) {
  const [data, setData] = useState<TimelineEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/test-stats?type=test-failure-timeline&testName=${encodeURIComponent(testName)}&days=30`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [testName])

  const STATUS_DOT: Record<string, string> = {
    passed: 'var(--green)', failed: 'var(--red)', flaky: 'var(--yellow)',
    skipped: 'var(--text-faint)',
  }

  const W = 480, H = 80
  const PAD = { top: 10, right: 16, bottom: 20, left: 30 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom
  const entries = data ? [...data].reverse() : []
  const n = entries.length

  const yForStatus = (s: string) => {
    if (s === 'passed') return PAD.top + ch * 0.1
    if (s === 'flaky') return PAD.top + ch * 0.4
    return PAD.top + ch * 0.8
  }

  const badgeStyles: Record<string, React.CSSProperties> = {
    smoke:      { background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' },
    regression: { background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' },
    'sms-email':{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' },
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border-default)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={testName}>
            {testName}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{basename(testFile)} · last 30d</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>}

        {!loading && data && data.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No run data found for this test in the last 30 days.</div>
        )}

        {!loading && data && data.length > 0 && (
          <>
            {/* Timeline chart */}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Failure Timeline</div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '8px 0', marginBottom: 16, overflow: 'hidden' }}>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                {[
                  { label: 'pass', y: yForStatus('passed') },
                  { label: 'flaky', y: yForStatus('flaky') },
                  { label: 'fail', y: yForStatus('failed') },
                ].map(({ label, y }) => (
                  <text key={label} x={PAD.left - 2} y={y + 4} textAnchor="end" fontSize={8} fill="var(--text-faint)">{label}</text>
                ))}
                {entries.map((e, i) => {
                  const x = n > 1 ? PAD.left + (i / (n - 1)) * cw : PAD.left + cw / 2
                  const y = yForStatus(e.status)
                  const c = STATUS_DOT[e.status] ?? 'var(--text-faint)'
                  return (
                    <circle key={e.run_id} cx={x} cy={y} r={4} fill={c} opacity={0.9}>
                      <title>{`${e.status} · ${new Date(e.started_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</title>
                    </circle>
                  )
                })}
                {entries.map((e, i) => {
                  if (i % Math.max(1, Math.floor(n / 5)) !== 0 && i !== n - 1) return null
                  const x = n > 1 ? PAD.left + (i / (n - 1)) * cw : PAD.left + cw / 2
                  const d = new Date(e.started_at)
                  return (
                    <text key={`lbl-${e.run_id}`} x={x} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-faint)">
                      {`${d.getMonth()+1}/${d.getDate()}`}
                    </text>
                  )
                })}
              </svg>
            </div>

            {/* Runs table */}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>All Runs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.map(entry => {
                const c = STATUS_DOT[entry.status] ?? 'var(--text-faint)'
                const d = new Date(entry.started_at)
                const label = runTypeLabel(entry.run_type)
                const badgeStyle: React.CSSProperties = {
                  fontSize: 9, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
                  padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                  ...(badgeStyles[label] ?? {}),
                }
                return (
                  <div key={entry.run_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 5 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: c, fontWeight: 600, width: 50, flexShrink: 0 }}>{entry.status}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {d.toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {label && <span style={badgeStyle}>{label}</span>}
                    {entry.report_url && (
                      <a href={entry.report_url} target="_blank" rel="noopener" style={{ fontSize: 10, color: 'var(--accent-text)', textDecoration: 'none' }}>→</a>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main JourneyDetail panel ─────────────────────────────────────────────────

export default function JourneyDetail({ testFile, runs = 10, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  useEffect(() => {
    if (!testFile) { setData(null); setSelectedTest(null); return }
    setLoading(true)
    setData(null)
    setSelectedTest(null)
    fetch(`/api/test-stats?type=journey-detail&file=${encodeURIComponent(testFile)}&runs=${runs}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [testFile, runs])

  if (!testFile) return null

  const displayRuns = data ? [...data.runs].reverse() : []
  const runCount = data ? displayRuns.length : runs
  const colTemplate = `minmax(180px, 1fr) repeat(${runCount}, 26px) 60px`

  // Last status per test (from most recent run)
  function lastStatus(test: DetailTest): string {
    for (const r of displayRuns.slice().reverse()) {
      const found = test.runs.find(tr => tr.run_id === r.run_id)
      if (found && found.status !== 'not_run') return found.status
    }
    return 'not_run'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(680px, 100vw)',
        background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-subtle)',
        zIndex: 51,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}>

        {/* Panel header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border-default)', background: 'var(--bg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{basename(testFile)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{testFile}</div>
            {data && (() => {
              const worstMap = worstStatusPerRun(data)
              const runOrder = displayRuns
              return (
                <div style={{ display: 'flex', gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
                  {runOrder.map(r => {
                    const status = worstMap.get(r.run_id) ?? 'not_run'
                    return (
                      <div
                        key={r.run_id}
                        title={`${shortDate(r.started_at)} · ${status}`}
                        style={{
                          width: 14, height: 14,
                          borderRadius: 3,
                          background: STATUS_COLOR[status] ?? 'var(--bg-3)',
                          opacity: status === 'not_run' ? 0.3 : 0.88,
                          flexShrink: 0,
                        }}
                      />
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', position: 'relative' }}>
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
          )}

          {!loading && data && data.tests.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No per-test data for this file yet.</div>
          )}

          {!loading && data && data.tests.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 3, minWidth: 0 }}>
                {/* Header */}
                <div style={{ fontSize: 9, color: 'var(--text-faint)', paddingBottom: 4 }}>Test</div>
                {displayRuns.map(r => (
                  <div key={r.run_id} style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', paddingBottom: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28, lineHeight: 1 }}>
                    {shortDate(r.started_at)}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: 'var(--text-faint)', paddingBottom: 4, textAlign: 'right' }}>med.</div>

                {/* Rows */}
                {data.tests.map(test => {
                  const ls = lastStatus(test)
                  const lsColor = STATUS_COLOR[ls] ?? 'var(--text-faint)'
                  return (
                    <>
                      <div
                        key={`name-${test.test_name}`}
                        onClick={() => setSelectedTest(test.test_name)}
                        style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '22px', paddingRight: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        title={`${test.test_name} — click to see timeline`}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: lsColor, flexShrink: 0, opacity: ls === 'not_run' ? 0.3 : 0.88 }} />
                        {test.test_name}
                      </div>
                      {(() => {
                        const runMap = Object.fromEntries(test.runs.map(r => [r.run_id, r.status]))
                        return displayRuns.map(r => {
                          const status = runMap[r.run_id] ?? 'not_run'
                          return (
                            <div
                              key={`${test.test_name}-${r.run_id}`}
                              title={`${status} · ${shortDate(r.started_at)}`}
                              style={{
                                width: 20, height: 20,
                                borderRadius: 3,
                                background: STATUS_COLOR[status] ?? 'var(--bg-3)',
                                opacity: status === 'not_run' ? 0.3 : 0.85,
                                alignSelf: 'center',
                                justifySelf: 'center',
                              }}
                            />
                          )
                        })
                      })()}
                      <div
                        key={`dur-${test.test_name}`}
                        style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmtMs(test.median_duration_ms)}
                      </div>

                      {/* Error row */}
                      {test.top_error && (
                        <div
                          key={`err-${test.test_name}`}
                          style={{ gridColumn: `1 / -1`, fontSize: 10, color: 'var(--red)', background: 'rgba(255,80,80,0.06)', borderRadius: 4, padding: '3px 6px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={test.top_error}
                        >
                          {test.top_error}
                        </div>
                      )}
                    </>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Inline test timeline — slides in on top */}
        {selectedTest && testFile && (
          <TestTimeline
            testName={selectedTest}
            testFile={testFile}
            onBack={() => setSelectedTest(null)}
          />
        )}
      </div>
    </>
  )
}
