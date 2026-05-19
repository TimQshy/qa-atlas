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

export default function JourneyDetail({ testFile, runs = 10, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!testFile) { setData(null); return }
    setLoading(true)
    setData(null)
    fetch(`/api/test-stats?type=journey-detail&file=${encodeURIComponent(testFile)}&runs=${runs}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [testFile, runs])

  if (!testFile) return null

  const runCount = data?.runs.length ?? runs
  const colTemplate = `minmax(180px, 1fr) repeat(${runCount}, 26px) 60px`

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
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{basename(testFile)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{testFile}</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
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
                {data.runs.map(r => (
                  <div key={r.run_id} style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', paddingBottom: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28, lineHeight: 1 }}>
                    {shortDate(r.started_at)}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: 'var(--text-faint)', paddingBottom: 4, textAlign: 'right' }}>med.</div>

                {/* Rows */}
                {data.tests.map(test => (
                  <>
                    <div
                      key={`name-${test.test_name}`}
                      style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '22px', paddingRight: 8 }}
                      title={test.test_name}
                    >
                      {test.test_name}
                    </div>
                    {test.runs.map(r => (
                      <div
                        key={`${test.test_name}-${r.run_id}`}
                        title={`${r.status} · ${shortDate(r.started_at)}`}
                        style={{
                          width: 20, height: 20,
                          borderRadius: 3,
                          background: STATUS_COLOR[r.status] ?? 'var(--bg-3)',
                          opacity: r.status === 'not_run' ? 0.3 : 0.85,
                          alignSelf: 'center',
                          justifySelf: 'center',
                        }}
                      />
                    ))}
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
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
