'use client'

import { useEffect, useRef, useState } from 'react'

export interface MatrixRun {
  run_id: string
  started_at: string
  status: string
}

export interface MatrixRow {
  test_file: string
  runs: MatrixRun[]
}

interface Props {
  title: string
  rows: MatrixRow[]
  onRowClick: (testFile: string) => void
}

const STATUS_COLOR: Record<string, string> = {
  passed:  'var(--green)',
  failed:  'var(--red)',
  flaky:   'var(--yellow)',
  skipped: 'var(--text-faint)',
  not_run: 'var(--bg-3)',
}

const STATUS_LABEL: Record<string, string> = {
  passed: 'passed', failed: 'failed', flaky: 'flaky', skipped: 'skipped', not_run: '—',
}

const CELL = 30 // cell size px

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

export default function JourneyMatrix({ title, rows, onRowClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Auto-scroll to the right (latest runs) on mount and data change
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
    updateScrollState(el)
  }, [rows])

  function updateScrollState(el: HTMLDivElement) {
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        No data — runs will appear here once CI sends per-test data.
      </div>
    )
  }

  // Reverse so oldest is on the left, newest is on the right
  const displayRows = rows.map(row => ({ ...row, runs: [...row.runs].reverse() }))
  const runCount = displayRows[0]?.runs.length ?? 0
  const colTemplate = `minmax(180px, 220px) repeat(${runCount}, ${CELL}px)`

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.2 }}>
        {title}
      </div>

      {/* Scroll container */}
      <div style={{ position: 'relative' }}>
        {/* Left fade */}
        {canScrollLeft && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to right, var(--bg-2), transparent)', zIndex: 2, pointerEvents: 'none' }} />
        )}
        {/* Right fade */}
        {canScrollRight && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(to left, var(--bg-2), transparent)', zIndex: 2, pointerEvents: 'none' }} />
        )}

        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', scrollBehavior: 'smooth' }}
          onScroll={e => updateScrollState(e.currentTarget)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 3, minWidth: 0 }}>
            {/* Header: oldest → newest (left → right) */}
            <div style={{ fontSize: 9, color: 'var(--text-faint)', paddingBottom: 4 }} />
            {displayRows[0].runs.map(r => (
              <div key={r.run_id} style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', paddingBottom: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 32, lineHeight: 1 }}>
                {shortDate(r.started_at)}
              </div>
            ))}

            {/* Rows */}
            {displayRows.map(row => (
              <>
                <div
                  key={`label-${row.test_file}`}
                  onClick={() => onRowClick(row.test_file)}
                  style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, lineHeight: `${CELL}px` }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  title={row.test_file}
                >
                  {basename(row.test_file)}
                </div>
                {row.runs.map(r => (
                  <div
                    key={`${row.test_file}-${r.run_id}`}
                    title={`${basename(row.test_file)} · ${shortDate(r.started_at)} · ${STATUS_LABEL[r.status]}`}
                    style={{
                      width: CELL - 4, height: CELL - 4,
                      borderRadius: 4,
                      background: r.status === 'not_run' ? 'var(--bg-3)' : STATUS_COLOR[r.status] ?? 'var(--bg-3)',
                      opacity: r.status === 'not_run' ? 0.35 : 0.88,
                      alignSelf: 'center',
                      justifySelf: 'center',
                      cursor: 'default',
                    }}
                  />
                ))}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Legend + scroll hint */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { color: 'var(--green)',      label: 'passed' },
            { color: 'var(--red)',        label: 'failed' },
            { color: 'var(--yellow)',     label: 'flaky' },
            { color: 'var(--text-faint)', label: 'skipped' },
            { color: 'var(--bg-3)',       label: 'not run', opacity: 0.35 },
          ].map(({ color, label, opacity }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 11, height: 11, borderRadius: 2, background: color, opacity: opacity ?? 0.88, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-faint)', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => {
            const el = scrollRef.current
            if (!el) return
            const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
            el.scrollLeft = atRight ? 0 : el.scrollWidth
          }}
        >
          <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
            <rect x="0" y="5" width="20" height="4" rx="2" fill="currentColor" opacity="0.3" />
            <rect x="10" y="5" width="10" height="4" rx="2" fill="currentColor" opacity="0.6" />
            <polyline points="22,2 27,7 22,12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          </svg>
          scroll to {canScrollRight ? 'latest →' : '← oldest'}
        </div>
      </div>
    </div>
  )
}
