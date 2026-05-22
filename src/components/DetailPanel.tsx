'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Folder, Item } from '@/types'
import { I } from './Icons'
import { Avatar, StatusPill, PriorityPill, Tag, IconBtn } from './Primitives'
import { CommentSection } from './CommentSection'

interface Props {
  selected: { type: 'folder'; data: Folder } | { type: 'item'; data: Item } | null
  isHighlighted: boolean
  onDelete: (id: string, type: 'folder' | 'item') => void
  onUpdate: (id: string, type: 'folder' | 'item', patch: Partial<Folder | Item>) => void
  onCreateItem?: (folderId: string, data: Partial<Item>) => Promise<void>
  releaseId?: string | null
  onCommentChange?: () => void
}

interface JiraIssue {
  key: string; summary: string; description: string
  status: string; statusCategory: string; type: string; assignee: string | null
}
type JiraCache = Record<string, JiraIssue | 'loading' | 'error'>

const STATUSES = ['To Do', 'In Progress', 'Done', 'Blocked'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

function jiraStatusColor(category: string) {
  if (category === 'done') return 'var(--green)'
  if (category === 'indeterminate') return 'var(--blue)'
  return 'var(--text-muted)'
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 34, height: 20, borderRadius: 10, background: checked ? 'var(--accent)' : 'var(--bg-3)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`, position: 'relative', cursor: 'pointer', transition: 'background .15s, border-color .15s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: checked ? 15 : 3, width: 12, height: 12, borderRadius: '50%', background: checked ? '#0a0a0b' : 'var(--text-faint)', transition: 'left .15s' }} />
    </div>
  )
}

function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onDoubleClick={() => { setDraft(value); setEditing(true) }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: 'var(--text-primary)', margin: 0, lineHeight: 1.25, cursor: 'text' }}>{value}</h1>
      <IconBtn onClick={() => { setDraft(value); setEditing(true) }} title="Rename" style={{ width: 22, height: 22, opacity: 0.5 }}><I.Edit size={12} /></IconBtn>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
        style={{ flex: 1, fontSize: 22, fontWeight: 600, letterSpacing: -0.4, background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', color: 'var(--text-primary)', padding: '2px 0' }} />
      <IconBtn onClick={() => { onSave(draft); setEditing(false) }} style={{ width: 22, height: 22 }}><I.Check size={12} stroke="var(--green)" /></IconBtn>
      <IconBtn onClick={() => setEditing(false)} style={{ width: 22, height: 22 }}><I.Close size={12} /></IconBtn>
    </div>
  )
}

function InlineDropdown<T extends string>({ options, value, onSelect, renderOption, renderTrigger }: {
  options: readonly T[]; value: T; onSelect: (v: T) => void
  renderOption: (v: T) => React.ReactNode; renderTrigger: () => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>{renderTrigger()}</button>
      {open && (
        <div className="qa-fade-in" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30, background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 6, padding: 4, boxShadow: 'var(--shadow-md)', minWidth: 120 }}>
          {options.map(opt => (
            <button key={opt} onClick={() => { onSelect(opt); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', borderRadius: 4, cursor: 'pointer', background: opt === value ? 'var(--bg-3)' : 'transparent' }}
              onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'var(--bg-3)' }}
              onMouseLeave={e => { if (opt !== value) e.currentTarget.style.background = 'transparent' }}>
              {renderOption(opt)}
              {opt === value && <I.Check size={11} stroke="var(--accent)" style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DetailPanel({ selected, isHighlighted, onDelete, onUpdate, onCreateItem, releaseId, onCommentChange }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [jiraCache, setJiraCache] = useState<JiraCache>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Description editing
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')

  // Tags
  const [addingTag, setAddingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Tickets
  const [addingTicket, setAddingTicket] = useState(false)
  const [ticketDraft, setTicketDraft] = useState({ key: '', url: '' })

  // Bugs
  const [addingBug, setAddingBug] = useState(false)
  const [bugDraft, setBugDraft] = useState({ key: '', url: '' })

  // Duplicate note editing
  const [editingDupNote, setEditingDupNote] = useState(false)
  const [dupNoteDraft, setDupNoteDraft] = useState('')

  // Creating new item (when folder selected)
  const [creatingItem, setCreatingItem] = useState(false)
  const [newItem, setNewItem] = useState({ title: '', status: 'To Do' as string, priority: 'medium' as string, description: '', is_duplicatable: false, duplicate_note: '' })

  // Reset editing states when selected entity changes
  useEffect(() => {
    setEditingDesc(false)
    setAddingTag(false)
    setTagDraft('')
    setAddingTicket(false)
    setTicketDraft({ key: '', url: '' })
    setAddingBug(false)
    setBugDraft({ key: '', url: '' })
    setConfirmDelete(false)
    setEditingDupNote(false)
    setDupNoteDraft('')
    setCreatingItem(false)
    setNewItem({ title: '', status: 'To Do', priority: 'medium', description: '', is_duplicatable: false, duplicate_note: '' })
  }, [selected?.data?.id])

  const fetchJira = useCallback(async (key: string) => {
    setJiraCache(c => ({ ...c, [key]: 'loading' }))
    try {
      const res = await fetch(`/api/jira/issue/${encodeURIComponent(key)}`)
      if (!res.ok) { setJiraCache(c => ({ ...c, [key]: 'error' })); return }
      const data = await res.json()
      setJiraCache(c => ({ ...c, [key]: data }))
    } catch { setJiraCache(c => ({ ...c, [key]: 'error' })) }
  }, [])

  const handleAISummarize = useCallback(async (item: Item) => {
    setAiLoading(true); setAiError(null)
    try {
      const ticketKeys = item.tickets?.map(t => t.key) ?? []
      const resolved = await Promise.all(ticketKeys.map(async (k): Promise<JiraIssue | null> => {
        const cached = jiraCache[k]
        if (cached && cached !== 'loading' && cached !== 'error') return cached
        const r = await fetch(`/api/jira/issue/${encodeURIComponent(k)}`)
        if (!r.ok) return null
        const data: JiraIssue = await r.json()
        setJiraCache(c => ({ ...c, [k]: data }))
        return data
      }))
      const jiraTickets = resolved.filter((v): v is JiraIssue => v !== null && v.description.trim().length > 0)
        .map(v => ({ key: v.key, summary: v.summary, description: v.description }))
      if (jiraTickets.length === 0) { setAiError('No description found in linked Jira tickets'); return }
      const res = await fetch('/api/ai/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: item.title, jiraTickets }) })
      if (!res.ok) { setAiError((await res.json()).error ?? 'AI error'); return }
      onUpdate(item.id, 'item', { description: (await res.json()).result })
    } catch { setAiError('Failed to reach AI') } finally { setAiLoading(false) }
  }, [onUpdate, jiraCache])

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!selected) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <I.Doc size={22} stroke="var(--text-faint)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Select an item from the tree</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click any folder or test case to view details</div>
    </div>
  )

  const entity = selected.data
  const isFolder = selected.type === 'folder'
  const item = !isFolder ? (entity as Item) : null
  const folder = isFolder ? (entity as Folder) : null

  // ── New item creation form ───────────────────────────────────────────────
  if (creatingItem && folder) {
    const handleCreate = async () => {
      if (!newItem.title.trim()) return
      await onCreateItem?.(folder.id, { title: newItem.title, status: newItem.status as Item['status'], priority: newItem.priority as Item['priority'], description: newItem.description, is_duplicatable: newItem.is_duplicatable, duplicate_note: newItem.duplicate_note })
      setCreatingItem(false)
    }
    return (
      <main className="qa-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, padding: '10px var(--detail-px)', borderBottom: '1px solid var(--border-subtle)', background: 'color-mix(in oklab, var(--bg-0) 92%, transparent)', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>New Test Case</span>
          <I.Chevron size={11} stroke="var(--text-faint)" />
          <span className="qa-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{folder.name}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCreatingItem(false)} style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Cancel</button>
        </div>
        <div style={{ maxWidth: 'var(--detail-max)', margin: '0 auto', padding: '28px var(--detail-px) 80px', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Title *</label>
            <input autoFocus value={newItem.title} onChange={e => setNewItem(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreatingItem(false) }}
              placeholder="Test case title…"
              style={{ width: '100%', fontSize: 18, fontWeight: 600, background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '10px 14px', outline: 'none', color: 'var(--text-primary)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</label>
              <select value={newItem.status} onChange={e => setNewItem(f => ({ ...f, status: e.target.value }))}
                style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Priority</label>
              <select value={newItem.priority} onChange={e => setNewItem(f => ({ ...f, priority: e.target.value }))}
                style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</label>
            <textarea value={newItem.description} onChange={e => setNewItem(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description (Markdown supported)…" rows={4}
              style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Toggle checked={newItem.is_duplicatable} onChange={v => setNewItem(f => ({ ...f, is_duplicatable: v }))} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Include in release duplication</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pre-select this case when duplicating a release</div>
              </div>
            </div>
            <input
              value={newItem.duplicate_note}
              onChange={e => setNewItem(f => ({ ...f, duplicate_note: e.target.value }))}
              placeholder="Note (why included / excluded)…"
              style={{ marginLeft: 44, fontSize: 11.5, background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '5px 10px', outline: 'none', color: 'var(--text-secondary)', width: 'calc(100% - 44px)' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={handleCreate} disabled={!newItem.title.trim()}
              style={{ padding: '8px 20px', background: 'var(--accent)', color: '#0a0a0b', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: newItem.title.trim() ? 'pointer' : 'default', opacity: newItem.title.trim() ? 1 : 0.5, transition: 'opacity .1s' }}>
              Create Test Case
            </button>
            <button onClick={() => setCreatingItem(false)}
              style={{ padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Main detail view ─────────────────────────────────────────────────────
  return (
    <main className="qa-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, padding: '10px var(--detail-px)', borderBottom: '1px solid var(--border-subtle)', background: 'color-mix(in oklab, var(--bg-0) 92%, transparent)', backdropFilter: 'blur(8px)' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{isFolder ? 'Folder' : 'Test case'}</span>
        <I.Chevron size={11} stroke="var(--text-faint)" />
        <span className="qa-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{entity.id}</span>
        <div style={{ flex: 1 }} />
        {isHighlighted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent-text)', fontSize: 11, fontWeight: 500 }}>
            <I.GitBranch size={11} /> in release
          </span>
        )}
        {releaseId && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--blue)', fontSize: 11, fontWeight: 500 }}>
            release-scoped
          </span>
        )}
        {isFolder && (
          <button onClick={() => setCreatingItem(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--border-default)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all .1s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent-text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            <I.Plus size={12} /> New Test Case
          </button>
        )}
        <IconBtn title="Share"><I.Link size={13} /></IconBtn>
        <IconBtn title="More"><I.More size={13} /></IconBtn>
        {!confirmDelete ? (
          <IconBtn title="Delete" onClick={() => setConfirmDelete(true)}><I.Trash size={13} /></IconBtn>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--red-soft)', border: '1px solid var(--red)', borderRadius: 6, padding: '3px 8px' }}>
            <span style={{ fontSize: 11.5, color: 'var(--red)' }}>Delete?</span>
            <button onClick={() => { onDelete(entity.id, selected.type); setConfirmDelete(false) }} style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>Yes</button>
            <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>No</button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 'var(--detail-max)', margin: '0 auto', padding: 'var(--detail-py) var(--detail-px) 80px', width: '100%' }}>

        {/* Priority + Status pills (item only) */}
        {item && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <InlineDropdown
              options={PRIORITIES} value={item.priority}
              onSelect={v => onUpdate(item.id, 'item', { priority: v })}
              renderTrigger={() => <PriorityPill priority={item.priority} />}
              renderOption={v => <PriorityPill priority={v} />}
            />
            <InlineDropdown
              options={STATUSES} value={item.status}
              onSelect={v => onUpdate(item.id, 'item', { status: v })}
              renderTrigger={() => <StatusPill status={item.status} />}
              renderOption={v => <StatusPill status={v} />}
            />
            {/* is_stable toggle */}
            <button onClick={() => onUpdate(item.id, 'item', { is_stable: !item.is_stable })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, background: item.is_stable ? 'var(--green-soft)' : 'var(--bg-2)', border: `1px solid ${item.is_stable ? 'var(--green)' : 'var(--border-subtle)'}`, fontSize: 10, color: item.is_stable ? 'var(--green)' : 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', transition: 'all .1s' }}>
              stable
            </button>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <EditableName value={isFolder ? (entity as Folder).name : (entity as Item).title}
            onSave={v => onUpdate(entity.id, selected.type, isFolder ? { name: v } : { title: v })} />
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20, alignItems: 'center' }}>
          {entity.tags.map(t => (
            <button key={t} onClick={() => onUpdate(entity.id, selected.type, { tags: entity.tags.filter(x => x !== t) })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              #{t} <I.Close size={9} />
            </button>
          ))}
          {addingTag ? (
            <input ref={tagInputRef} autoFocus value={tagDraft} onChange={e => setTagDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tagDraft.trim()) {
                  onUpdate(entity.id, selected.type, { tags: [...entity.tags, tagDraft.trim()] })
                  setTagDraft(''); setAddingTag(false)
                }
                if (e.key === 'Escape') { setAddingTag(false); setTagDraft('') }
              }}
              onBlur={() => { setAddingTag(false); setTagDraft('') }}
              placeholder="tag name…"
              style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--accent-border)', outline: 'none', color: 'var(--text-primary)', width: 90 }} />
          ) : (
            <button onClick={() => setAddingTag(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 4, fontSize: 11, color: 'var(--text-faint)', background: 'transparent', border: '1px dashed var(--border-subtle)', cursor: 'pointer', transition: 'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent-text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-faint)' }}>
              <I.Plus size={10} /> tag
            </button>
          )}
        </div>

        {/* is_duplicatable toggle */}
        <div style={{ marginBottom: 24, padding: '10px 14px', background: 'var(--bg-1)', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={entity.is_duplicatable ?? false} onChange={v => onUpdate(entity.id, selected.type, { is_duplicatable: v })} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <I.Copy size={12} stroke="var(--accent)" /> Include in release duplication
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Pre-select when duplicating a release</div>
            </div>
          </div>
          {/* inline note */}
          {editingDupNote ? (
            <div style={{ marginLeft: 44, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={dupNoteDraft}
                onChange={e => setDupNoteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onUpdate(entity.id, selected.type, { duplicate_note: dupNoteDraft }); setEditingDupNote(false) }
                  if (e.key === 'Escape') { setEditingDupNote(false) }
                }}
                placeholder="Note why included / excluded…"
                style={{ flex: 1, fontSize: 11.5, background: 'var(--bg-0)', border: '1px solid var(--accent-border)', borderRadius: 5, padding: '4px 8px', outline: 'none', color: 'var(--text-secondary)' }}
              />
              <IconBtn onClick={() => { onUpdate(entity.id, selected.type, { duplicate_note: dupNoteDraft }); setEditingDupNote(false) }} style={{ width: 22, height: 22 }}><I.Check size={11} stroke="var(--green)" /></IconBtn>
              <IconBtn onClick={() => setEditingDupNote(false)} style={{ width: 22, height: 22 }}><I.Close size={11} /></IconBtn>
            </div>
          ) : (
            <div style={{ marginLeft: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
              {(entity as Item).duplicate_note ? (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', flex: 1 }}>{(entity as Item).duplicate_note}</span>
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontStyle: 'italic', flex: 1 }}>No note</span>
              )}
              <button
                onClick={() => { setDupNoteDraft((entity as Item).duplicate_note ?? ''); setEditingDupNote(true) }}
                style={{ fontSize: 11, color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 6px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)' }}>
                <I.Edit size={10} /> edit
              </button>
            </div>
          )}
        </div>

        {/* Tickets & Bugs (item only) */}
        {item && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Linked tickets</h2>
              <span className="qa-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(item.tickets?.length ?? 0) + (item.bugs?.length ?? 0)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.tickets?.map(t => {
                const jira = jiraCache[t.key]
                const isLoading = jira === 'loading'
                const isError = jira === 'error'
                const data = jira && jira !== 'loading' && jira !== 'error' ? jira : null
                return (
                  <div key={t.key} style={{ borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-1)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <a href={t.url ?? '#'} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'inherit', textDecoration: 'none', minWidth: 0 }}
                        onMouseEnter={e => (e.currentTarget.parentElement!.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.parentElement!.style.background = 'var(--bg-1)')}>
                        <I.Link size={12} stroke="var(--text-muted)" />
                        <span className="qa-mono" style={{ fontSize: 11.5, color: 'var(--blue)', fontWeight: 500, flexShrink: 0 }}>{t.key}</span>
                        {data && (<>
                          <span style={{ fontSize: 10.5, color: jiraStatusColor(data.statusCategory), background: data.statusCategory === 'done' ? 'var(--green-soft)' : data.statusCategory === 'indeterminate' ? 'rgba(59,130,246,0.1)' : 'var(--bg-3)', padding: '1px 6px', borderRadius: 3, fontWeight: 500, flexShrink: 0 }}>{data.status}</span>
                          <span className="qa-truncate" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{data.summary}</span>
                        </>)}
                        {isError && <span style={{ fontSize: 11, color: 'var(--red)' }}>fetch failed</span>}
                        {t.url && <I.ExternalLink size={11} stroke="var(--text-faint)" style={{ flexShrink: 0, marginLeft: 'auto' }} />}
                      </a>
                      <button onClick={() => fetchJira(t.key)} disabled={isLoading} title="Sync from Jira"
                        style={{ width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: isLoading ? 'default' : 'pointer', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-faint)', transition: 'color .1s' }}
                        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.color = 'var(--text-secondary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}>
                        <I.Refresh size={11} stroke="currentColor" style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
                      </button>
                      <button onClick={() => onUpdate(item.id, 'item', { tickets: item.tickets.filter(x => x.key !== t.key) })} title="Remove"
                        style={{ width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-faint)', transition: 'color .1s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}>
                        <I.Close size={11} />
                      </button>
                    </div>
                    {data?.assignee && <div style={{ padding: '4px 10px 6px 32px', fontSize: 11, color: 'var(--text-muted)' }}>Assignee: {data.assignee}</div>}
                  </div>
                )
              })}
              {item.bugs?.map(b => (
                <div key={b.key} style={{ display: 'flex', alignItems: 'center', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-1)', overflow: 'hidden' }}>
                  <a href={b.url ?? '#'} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'inherit', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.parentElement!.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.parentElement!.style.background = 'var(--bg-1)')}>
                    <I.Bug size={12} stroke="var(--red)" />
                    <span className="qa-mono" style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 500 }}>{b.key}</span>
                  </a>
                  <button onClick={() => onUpdate(item.id, 'item', { bugs: item.bugs.filter(x => x.key !== b.key) })} title="Remove"
                    style={{ width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-faint)', transition: 'color .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faint)' }}>
                    <I.Close size={11} />
                  </button>
                </div>
              ))}

              {/* Add ticket */}
              {addingTicket ? (
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--bg-1)' }}>
                  <input autoFocus value={ticketDraft.key} onChange={e => setTicketDraft(d => ({ ...d, key: e.target.value }))}
                    placeholder="JIRA-123" style={{ flex: '0 0 100px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', fontSize: 12, color: 'var(--text-primary)', padding: '2px 0' }}
                    onKeyDown={e => { if (e.key === 'Escape') { setAddingTicket(false); setTicketDraft({ key: '', url: '' }) } }} />
                  <input value={ticketDraft.url} onChange={e => setTicketDraft(d => ({ ...d, url: e.target.value }))}
                    placeholder="URL (optional)" style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', fontSize: 12, color: 'var(--text-primary)', padding: '2px 0' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && ticketDraft.key.trim()) {
                        onUpdate(item.id, 'item', { tickets: [...(item.tickets ?? []), { key: ticketDraft.key.trim(), url: ticketDraft.url.trim() || undefined }] })
                        setTicketDraft({ key: '', url: '' }); setAddingTicket(false)
                      }
                      if (e.key === 'Escape') { setAddingTicket(false); setTicketDraft({ key: '', url: '' }) }
                    }} />
                  <button onClick={() => {
                    if (!ticketDraft.key.trim()) return
                    onUpdate(item.id, 'item', { tickets: [...(item.tickets ?? []), { key: ticketDraft.key.trim(), url: ticketDraft.url.trim() || undefined }] })
                    setTicketDraft({ key: '', url: '' }); setAddingTicket(false)
                  }} style={{ padding: '2px 10px', background: 'var(--accent)', color: '#0a0a0b', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setAddingTicket(false); setTicketDraft({ key: '', url: '' }) }} style={{ padding: '2px 8px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : addingBug ? (
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--red)', background: 'var(--bg-1)' }}>
                  <input autoFocus value={bugDraft.key} onChange={e => setBugDraft(d => ({ ...d, key: e.target.value }))}
                    placeholder="BUG-456" style={{ flex: '0 0 100px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', fontSize: 12, color: 'var(--text-primary)', padding: '2px 0' }}
                    onKeyDown={e => { if (e.key === 'Escape') { setAddingBug(false); setBugDraft({ key: '', url: '' }) } }} />
                  <input value={bugDraft.url} onChange={e => setBugDraft(d => ({ ...d, url: e.target.value }))}
                    placeholder="URL (optional)" style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-default)', outline: 'none', fontSize: 12, color: 'var(--text-primary)', padding: '2px 0' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && bugDraft.key.trim()) {
                        onUpdate(item.id, 'item', { bugs: [...(item.bugs ?? []), { key: bugDraft.key.trim(), url: bugDraft.url.trim() || undefined }] })
                        setBugDraft({ key: '', url: '' }); setAddingBug(false)
                      }
                      if (e.key === 'Escape') { setAddingBug(false); setBugDraft({ key: '', url: '' }) }
                    }} />
                  <button onClick={() => {
                    if (!bugDraft.key.trim()) return
                    onUpdate(item.id, 'item', { bugs: [...(item.bugs ?? []), { key: bugDraft.key.trim(), url: bugDraft.url.trim() || undefined }] })
                    setBugDraft({ key: '', url: '' }); setAddingBug(false)
                  }} style={{ padding: '2px 10px', background: 'var(--red)', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setAddingBug(false); setBugDraft({ key: '', url: '' }) }} style={{ padding: '2px 8px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setAddingTicket(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 5, border: '1px dashed var(--border-default)', fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', transition: 'all .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent-text)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <I.Plus size={11} /> Add ticket
                  </button>
                  <button onClick={() => setAddingBug(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 5, border: '1px dashed var(--border-default)', fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer', transition: 'all .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <I.Bug size={11} stroke="currentColor" /> Add bug
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Description (item only) */}
        {item && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Description</h2>
              {!editingDesc && (
                <button onClick={() => { setDescDraft(item.description ?? ''); setEditingDesc(true) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', transition: 'all .1s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <I.Edit size={10} /> Edit
                </button>
              )}
              {item.tickets?.length > 0 && !editingDesc && (
                <button onClick={() => handleAISummarize(item)} disabled={aiLoading} title="Fetch Jira description → generate with DeepSeek"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', fontSize: 11, color: aiLoading ? 'var(--text-faint)' : 'var(--text-muted)', cursor: aiLoading ? 'default' : 'pointer', transition: 'all .1s' }}
                  onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent-text)' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <I.Sparkles size={11} stroke="currentColor" />
                  {aiLoading ? 'Thinking…' : 'Generate from Jira'}
                </button>
              )}
              {aiError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{aiError}</span>}
            </div>

            {editingDesc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={8}
                  style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--accent-border)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { onUpdate(item.id, 'item', { description: descDraft }); setEditingDesc(false) }}
                    style={{ padding: '5px 14px', background: 'var(--accent)', color: '#0a0a0b', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingDesc(false)}
                    style={{ padding: '5px 12px', border: '1px solid var(--border-default)', borderRadius: 5, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : item.description ? (
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                <ReactMarkdown>{item.description}</ReactMarkdown>
              </div>
            ) : (
              <button onClick={() => { setDescDraft(''); setEditingDesc(true) }}
                style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}>
                No description yet. Click to add…
              </button>
            )}
          </section>
        )}

        {/* Comments */}
        <section style={{ marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 24 }}>
          <CommentSection entityType={selected.type} entityId={entity.id} releaseId={releaseId} onCommentChange={onCommentChange} />
        </section>
      </div>
    </main>
  )
}
