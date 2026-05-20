'use client'

import { useState } from 'react'
import { type MatrixRow } from './JourneyMatrix'

const SECTIONS: { name: string; patterns: string[] }[] = [
  // UI Journeys
  { name: 'Event Booking',         patterns: ['event-booking', 'appointment-rsvp', 'appointment-booking-student', 'appointment.journey'] },
  { name: 'Signup & Webforms',     patterns: ['webform-public', 'webform-mailosaur', 'webform-sms'] },
  { name: 'Contact Management',    patterns: ['contact-management', 'merge-records', 'merge-students'] },
  { name: 'Admin & Auth',          patterns: ['admin.journey', 'auth.journey', 'multi-role'] },
  { name: 'Activity & Forms',      patterns: ['activity-log', 'form-locking'] },
  // API Tests
  { name: 'Applications API',      patterns: ['applications-api', 'students-api'] },
  { name: 'Events API',            patterns: ['events-api'] },
  { name: 'Forms API',             patterns: ['form-templates-api', 'webforms-api'] },
  { name: 'Contacts API',          patterns: ['contacts-api', 'communications-api', 'entities-api'] },
  { name: 'System API',            patterns: ['school-settings-api', 'tasks-api', 'file-uploads-api', 'analytics-api', 'dashboard-api', 'cross-cutting-api'] },
]

const STATUS_RANK: Record<string, number> = { failed: 0, flaky: 1, skipped: 2, passed: 3, not_run: 4 }

function worstStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'not_run'
  return statuses.reduce((worst, s) => (STATUS_RANK[s] ?? 4) < (STATUS_RANK[worst] ?? 4) ? s : worst, 'not_run')
}

const BLOCK_COLOR: Record<string, string> = {
  passed:  'var(--green)',
  failed:  'var(--red)',
  flaky:   'var(--yellow)',
  skipped: 'var(--text-faint)',
  not_run: 'var(--bg-3)',
}

const STATUS_TEXT: Record<string, string> = {
  passed:  'Operational',
  flaky:   'Flaky',
  failed:  'Down',
  skipped: 'Skipped',
  not_run: 'No data',
}

const STATUS_COLOR: Record<string, string> = {
  passed:  'var(--green)',
  flaky:   'var(--yellow)',
  failed:  'var(--red)',
  skipped: 'var(--text-muted)',
  not_run: 'var(--text-faint)',
}

const FILE_STATUS_DOT: Record<string, string> = {
  passed: 'var(--green)',
  failed: 'var(--red)',
  flaky:  'var(--yellow)',
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

interface SectionRow {
  name: string
  matchingRows: MatrixRow[]
  runs: { run_id: string; started_at: string; status: string }[]
  currentStatus: string
}

interface Props {
  matrix: MatrixRow[]
  onFileClick: (file: string) => void
}

export default function SectionHealthGrid({ matrix, onFileClick }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sections: SectionRow[] = SECTIONS.map(({ name, patterns }) => {
    const matchingRows = matrix.filter(row => {
      const base = row.test_file.split('/').pop() ?? row.test_file
      return patterns.some(p => base.includes(p) || row.test_file.includes(p))
    })

    if (matchingRows.length === 0) return null

    const runSlots = matchingRows[0].runs
    const runs = runSlots.map(slot => {
      const statuses = matchingRows.map(row => {
        const r = row.runs.find(rr => rr.run_id === slot.run_id)
        return r?.status ?? 'not_run'
      })
      return { run_id: slot.run_id, started_at: slot.started_at, status: worstStatus(statuses) }
    })

    // Oldest left → newest right
    const ordered = [...runs].reverse()
    const currentStatus = ordered[ordered.length - 1]?.status ?? 'not_run'

    return { name, matchingRows, runs: ordered, currentStatus }
  }).filter((s): s is SectionRow => s !== null)

  if (sections.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        No section data yet — appears once CI sends per-test data.
      </div>
    )
  }

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {sections.map((section, idx) => {
        const isOpen = expanded.has(section.name)
        return (
          <div key={section.name} style={{ borderBottom: idx < sections.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
              {/* Section name + expand toggle */}
              <div
                onClick={() => toggle(section.name)}
                style={{ width: 160, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                title={isOpen ? 'Collapse' : `Show ${section.matchingRows.length} file(s)`}
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  style={{ flexShrink: 0, transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-faint)' }}
                >
                  <path d="M3 2l4 3-4 3V2z" fill="currentColor" />
                </svg>
                <span
                  style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  {section.name}
                </span>
              </div>

              {/* Status blocks — oldest left, newest right */}
              <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'center', overflow: 'hidden' }}>
                {section.runs.map(run => (
                  <div
                    key={run.run_id}
                    title={`${section.name} · ${shortDate(run.started_at)} · ${STATUS_TEXT[run.status] ?? run.status}`}
                    style={{
                      width: 10, height: 24, borderRadius: 2, flexShrink: 0,
                      background: run.status === 'not_run' ? 'var(--bg-3)' : BLOCK_COLOR[run.status] ?? 'var(--bg-3)',
                      opacity: run.status === 'not_run' ? 0.3 : 0.85,
                      cursor: 'default',
                      transition: 'opacity 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = run.status === 'not_run' ? '0.3' : '0.85' }}
                  />
                ))}
              </div>

              {/* Current status */}
              <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: STATUS_COLOR[section.currentStatus] ?? 'var(--text-muted)', minWidth: 90, textAlign: 'right' }}>
                {STATUS_TEXT[section.currentStatus] ?? section.currentStatus}
              </div>
            </div>

            {/* Expanded file list */}
            {isOpen && (
              <div style={{ paddingLeft: 24, paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.matchingRows.map(row => {
                  const lastRun = [...row.runs].find(r => r.status !== 'not_run')
                  const dotColor = lastRun ? (FILE_STATUS_DOT[lastRun.status] ?? 'var(--text-faint)') : 'var(--bg-3)'
                  return (
                    <div
                      key={row.test_file}
                      onClick={() => onFileClick(row.test_file)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 6px', borderRadius: 5, cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none' }}>
                        {basename(row.test_file)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', paddingTop: 8, fontSize: 10, color: 'var(--text-faint)' }}>
        <div style={{ width: 160, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>Older</div>
        <div>Now</div>
      </div>
    </div>
  )
}
