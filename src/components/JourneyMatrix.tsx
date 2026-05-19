'use client'

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

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

export default function JourneyMatrix({ title, rows, onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        No data — runs will appear here once CI sends per-test data.
      </div>
    )
  }

  const runCount = rows[0]?.runs.length ?? 0
  // column widths: file name col + N run columns
  const colTemplate = `minmax(160px, 1fr) repeat(${runCount}, 28px)`

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.2 }}>
        {title}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 2, minWidth: 0 }}>
          {/* Header */}
          <div style={{ fontSize: 9, color: 'var(--text-faint)', paddingBottom: 4 }} />
          {rows[0].runs.map(r => (
            <div key={r.run_id} style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', paddingBottom: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 28, lineHeight: 1 }}>
              {shortDate(r.started_at)}
            </div>
          ))}

          {/* Rows */}
          {rows.map(row => (
            <>
              <div
                key={`label-${row.test_file}`}
                onClick={() => onRowClick(row.test_file)}
                style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', padding: '3px 4px', borderRadius: 4, lineHeight: '22px' }}
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
                    width: 22, height: 22,
                    borderRadius: 3,
                    background: r.status === 'not_run' ? 'var(--bg-3)' : STATUS_COLOR[r.status] ?? 'var(--bg-3)',
                    opacity: r.status === 'not_run' ? 0.4 : 0.85,
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        {[
          { color: 'var(--green)',     label: 'passed' },
          { color: 'var(--red)',       label: 'failed' },
          { color: 'var(--yellow)',    label: 'flaky' },
          { color: 'var(--text-faint)', label: 'skipped' },
          { color: 'var(--bg-3)',      label: 'not run', opacity: 0.4 },
        ].map(({ color, label, opacity }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: opacity ?? 0.85, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
