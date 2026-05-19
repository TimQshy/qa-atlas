'use client'

export interface FlakyItem {
  test_file: string
  test_name: string
  flaky_count: number
  last_seen: string
}

interface Props {
  data: FlakyItem[]
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

function basename(path: string) {
  return path.split('/').pop() ?? path
}

export default function FlakyLeaderboard({ data }: Props) {
  if (data.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No flaky tests in the last 30 days.</div>
  }

  const maxCount = data[0]?.flaky_count ?? 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 48px 80px', gap: 8, padding: '0 4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
        {['Test', 'File', 'Count', 'Last seen'].map(h => (
          <span key={h} style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      {data.map((item, i) => (
        <div
          key={`${item.test_file}::${item.test_name}`}
          style={{ display: 'grid', gridTemplateColumns: '1fr 140px 48px 80px', gap: 8, padding: '5px 4px', borderRadius: 5 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }} title={item.test_name}>
              {item.test_name}
            </div>
            <div style={{ height: 2, background: 'var(--bg-3)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ width: `${(item.flaky_count / maxCount) * 100}%`, height: '100%', background: i === 0 ? 'var(--red)' : 'var(--yellow)', borderRadius: 1 }} />
            </div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }} title={item.test_file}>
            {basename(item.test_file)}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? 'var(--red)' : 'var(--yellow)', fontVariantNumeric: 'tabular-nums', alignSelf: 'center' }}>
            {item.flaky_count}×
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {relativeTime(item.last_seen)}
          </span>
        </div>
      ))}
    </div>
  )
}
