'use client'
import type { CSSProperties, ReactNode } from 'react'

export const Avatar = ({ name, size = 20 }: { name?: string | null; size?: number }) => {
  const initials = name ? name.split('@')[0].slice(0, 2).toUpperCase() : '?'
  const colors = ['#ff6b1a','#3fb950','#58a6ff','#bc8cff','#d29922','#f85149']
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: '#0a0a0b', fontSize: size <= 20 ? 9 : 11, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: 0.2, flexShrink: 0, userSelect: 'none',
    }}>{initials}</div>
  )
}

export const StatusDot = ({ status, size = 8 }: { status: string; size?: number }) => {
  const colors: Record<string, string> = {
    Done: 'var(--green)', 'In Progress': 'var(--blue)', Blocked: 'var(--yellow)',
    'To Do': 'var(--text-faint)', passing: 'var(--green)', failing: 'var(--red)',
  }
  return <span style={{ width: size, height: size, borderRadius: '50%', background: colors[status] ?? 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
}

export const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, { fg: string; bg: string }> = {
    Done:          { fg: 'var(--green)',  bg: 'var(--green-soft)' },
    'In Progress': { fg: 'var(--blue)',   bg: 'var(--blue-soft)' },
    Blocked:       { fg: 'var(--yellow)', bg: 'var(--yellow-soft)' },
    'To Do':       { fg: 'var(--text-muted)', bg: 'var(--bg-3)' },
  }
  const s = map[status] ?? map['To Do']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 500 }}>
      <StatusDot status={status} size={5} />{status}
    </span>
  )
}

export const PriorityPill = ({ priority }: { priority: string }) => {
  const map: Record<string, string> = { critical: 'var(--red)', high: 'var(--yellow)', medium: 'var(--text-secondary)', low: 'var(--text-muted)' }
  const label: Record<string, string> = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4' }
  const color = map[priority] ?? 'var(--text-muted)'
  return <span className="qa-mono" style={{ fontSize: 10, fontWeight: 600, color, padding: '1px 5px', border: '1px solid currentColor', borderRadius: 3, letterSpacing: 0.4, opacity: 0.85 }}>{label[priority] ?? priority}</span>
}

export const Tag = ({ children }: { children: ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', lineHeight: 1.5 }}>{children}</span>
)

export const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="qa-mono" style={{ padding: '1px 5px', borderRadius: 3, background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderBottomWidth: 2, color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.4 }}>{children}</span>
)

export const IconBtn = ({ children, onClick, title, active, style }: { children: ReactNode; onClick?: () => void; title?: string; active?: boolean; style?: CSSProperties }) => {
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' } }}
      style={{ width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', background: active ? 'var(--bg-3)' : 'transparent', transition: 'all .12s', flexShrink: 0, ...style }}>
      {children}
    </button>
  )
}
