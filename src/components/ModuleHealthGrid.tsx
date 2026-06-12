'use client'

import type { ModuleStat } from '@/types'
import { toGroup } from '@/lib/moduleGroup'

interface Props {
  data: ModuleStat[]
  selectedModule?: string | null
  onModuleClick?: (module: string) => void
}

function groupStats(data: ModuleStat[]): ModuleStat[] {
  const map = new Map<string, ModuleStat>()
  for (const stat of data) {
    const group = toGroup(stat.module)
    const existing = map.get(group)
    if (!existing) {
      map.set(group, { ...stat, module: group })
      continue
    }
    // Merge runs: combine by run_id, sum pass/fail/flaky/total
    const runMap = new Map(existing.runs.map(r => [r.run_id, { ...r }]))
    for (const r of stat.runs) {
      const ex = runMap.get(r.run_id)
      if (ex) {
        ex.pass += r.pass; ex.fail += r.fail; ex.flaky += r.flaky; ex.total += r.total
        ex.pass_rate = ex.total > 0 ? (ex.pass / ex.total) * 100 : 100
      } else {
        runMap.set(r.run_id, { ...r })
      }
    }
    const merged = [...runMap.values()].sort((a, b) => a.started_at < b.started_at ? -1 : 1)
    const lastRun = merged[merged.length - 1]
    const avg = merged.reduce((s, r) => s + r.pass_rate, 0) / merged.length
    map.set(group, {
      module: group,
      avg_pass_rate: Math.round(avg * 10) / 10,
      last_pass_rate: lastRun ? Math.round(lastRun.pass_rate * 10) / 10 : null,
      last_fail: lastRun?.fail ?? 0,
      last_flaky: lastRun?.flaky ?? 0,
      runs: merged,
    })
  }
  return [...map.values()].sort((a, b) => a.module.localeCompare(b.module))
}

function rateColor(rate: number) {
  if (rate >= 90) return 'var(--green)'
  if (rate >= 70) return 'var(--yellow)'
  return 'var(--red)'
}

function Sparkline({ runs }: { runs: ModuleStat['runs'] }) {
  if (runs.length === 0) return null
  const W = 80, H = 24
  const last = Math.min(runs.length, 15)
  const slice = runs.slice(-last)
  const barW = Math.floor((W - (last - 1)) / last)

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      {slice.map((r, i) => {
        const h = Math.max(2, Math.round((r.pass_rate / 100) * H))
        const color = rateColor(r.pass_rate)
        return (
          <rect
            key={r.run_id}
            x={i * (barW + 1)}
            y={H - h}
            width={barW}
            height={h}
            rx={1}
            fill={color}
            opacity={0.7}
          >
            <title>{`${r.pass_rate.toFixed(1)}% · ${new Date(r.started_at).toLocaleDateString()}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function ModuleCard({ stat, active, onClick }: { stat: ModuleStat; active: boolean; onClick: () => void }) {
  const rate = stat.last_pass_rate ?? stat.avg_pass_rate
  const color = rateColor(rate)
  const label = stat.module

  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'var(--bg-3)' : 'var(--bg-2)',
        border: active ? `1px solid ${color}` : '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
        cursor: 'pointer',
        transition: 'border-color .12s, background .12s',
        outline: active ? `2px solid ${color}` : 'none',
        outlineOffset: -1,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)' }}
    >
      {/* Module name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stat.module}>
          {label}
        </span>
      </div>

      {/* Pass rate */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color, lineHeight: 1 }}>
          {rate.toFixed(1)}%
        </span>
      </div>

      {/* Fail / flaky chips */}
      <div style={{ display: 'flex', gap: 6, minHeight: 16 }}>
        {stat.last_fail > 0 && (
          <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>
            {stat.last_fail} failed
          </span>
        )}
        {stat.last_flaky > 0 && (
          <span style={{ fontSize: 10, color: 'var(--yellow)', fontWeight: 600 }}>
            {stat.last_flaky} flaky
          </span>
        )}
        {stat.last_fail === 0 && stat.last_flaky === 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>clean</span>
        )}
      </div>

      {/* Sparkline */}
      <div style={{ marginTop: 2 }}>
        <Sparkline runs={stat.runs} />
      </div>

      {/* Runs count */}
      <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>
        {stat.runs.length} run{stat.runs.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

export default function ModuleHealthGrid({ data, selectedModule, onModuleClick }: Props) {
  const grouped = groupStats(data)

  if (grouped.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        No module data yet — tag your tests with a <code style={{ fontSize: 11, background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 3 }}>module</code> field when posting to <code style={{ fontSize: 11, background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 3 }}>/api/test-runs</code>.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
      gap: 10,
    }}>
      {grouped.map(stat => (
        <ModuleCard
          key={stat.module}
          stat={stat}
          active={selectedModule === stat.module}
          onClick={() => onModuleClick?.(stat.module)}
        />
      ))}
    </div>
  )
}
