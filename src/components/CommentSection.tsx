'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { I } from './Icons'
import { Avatar, IconBtn } from './Primitives'

const URL_RE = /(https?:\/\/[^\s<>"']+)/g

function TextWithLinks({ text, resolved }: { text: string; resolved?: boolean }) {
  const parts = text.split(URL_RE)
  return (
    <span style={{ whiteSpace: 'pre-wrap', textWrap: 'pretty', textDecoration: resolved ? 'line-through' : 'none' } as React.CSSProperties}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--blue)', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        ) : part
      )}
    </span>
  )
}

interface Attachment { url: string; name: string; type: string }
interface Comment {
  id: string; text: string; attachments: Attachment[]
  author_email: string | null; created_at: string; updated_at?: string | null
  is_resolved: boolean
}

function CommentItem({ comment: c, onDelete, onEdit, onResolve }: {
  comment: Comment
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void
  onResolve: (id: string, resolved: boolean) => void
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c.text)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    await onEdit(c.id, draft.trim())
    setSaving(false)
    setEditing(false)
  }

  const name = c.author_email?.split('@')[0] ?? 'unknown'

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-subtle)', opacity: c.is_resolved ? 0.5 : 1, transition: 'opacity .15s' }}>
      <Avatar name={c.author_email} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
          <span className="qa-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {c.updated_at && <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontStyle: 'italic' }}>(edited)</span>}
          {c.is_resolved && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-muted)' }}>
              Resolved
            </span>
          )}
          {hover && !editing && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <IconBtn
                title={c.is_resolved ? 'Reopen' : 'Resolve'}
                style={{ width: 22, height: 22, color: c.is_resolved ? 'var(--text-muted)' : 'var(--accent)' }}
                onClick={() => onResolve(c.id, !c.is_resolved)}
              >
                <I.Check size={12} />
              </IconBtn>
              <IconBtn title="Edit" style={{ width: 22, height: 22 }} onClick={() => { setDraft(c.text); setEditing(true) }}><I.Edit size={12} /></IconBtn>
              <IconBtn title="Delete" style={{ width: 22, height: 22 }} onClick={() => onDelete(c.id)}><I.Trash size={12} /></IconBtn>
            </span>
          )}
        </div>

        {editing ? (
          <div style={{ marginTop: 4 }}>
            <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { save() } else if (e.key === 'Escape') { setEditing(false); setDraft(c.text) } }}
              rows={3}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--accent-border)', borderRadius: 6, outline: 'none', resize: 'none', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 5, background: 'var(--accent)', color: '#0a0a0b', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                <I.Check size={11} /> Save
              </button>
              <button onClick={() => { setEditing(false); setDraft(c.text) }} style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <TextWithLinks text={c.text} resolved={c.is_resolved} />
          </div>
        )}

        {!editing && c.attachments?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: c.attachments.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 8, marginTop: 10, maxWidth: 480 }}>
            {c.attachments.map((a, i) => (
              a.type.startsWith('image/') ? (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                  <img src={a.url} alt={a.name} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                </a>
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-1)', fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>
                  <I.Paperclip size={11} />{a.name}
                </a>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props { entityType: 'folder' | 'item'; entityId: string; releaseId?: string | null; onCommentChange?: () => void }

export function CommentSection({ entityType, entityId, releaseId, onCommentChange }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const url = new URL(`/api/comments`, window.location.origin)
    url.searchParams.set('entity_type', entityType)
    url.searchParams.set('entity_id', entityId)
    if (releaseId) url.searchParams.set('release_id', releaseId)
    const res = await fetch(url.toString())
    if (res.ok) setComments(await res.json())
    setLoading(false)
  }, [entityType, entityId, releaseId])

  useEffect(() => { load() }, [load])

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    return res.ok ? res.json() : null
  }

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true)
    const results = await Promise.all(Array.from(files).map(uploadFile))
    setPending(p => [...p, ...(results.filter(Boolean) as Attachment[])])
    setUploading(false)
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const images = Array.from(e.clipboardData.items).filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (!images.length) return
    e.preventDefault()
    await handleFiles(images.map(i => i.getAsFile()).filter(Boolean) as File[])
  }

  const handleSubmit = async () => {
    if (!text.trim() && pending.length === 0) return
    setSubmitting(true)
    const res = await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, text: text.trim(), attachments: pending, release_id: releaseId ?? undefined }),
    })
    if (res.ok) { setText(''); setPending([]); await load(); onCommentChange?.() }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    setComments(c => c.filter(x => x.id !== id))
    onCommentChange?.()
  }

  const handleEdit = async (id: string, newText: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newText }) })
    if (res.ok) { const u = await res.json(); setComments(c => c.map(x => x.id === id ? { ...x, text: u.text, updated_at: u.updated_at } : x)) }
  }

  const handleResolve = async (id: string, resolved: boolean) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_resolved: resolved }) })
    if (res.ok) {
      setComments(c => c.map(x => x.id === id ? { ...x, is_resolved: resolved } : x))
      onCommentChange?.()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Comments</h2>
        <span className="qa-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comments.length}</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Loading…</div>
      ) : (
        <div>
          {comments.map(c => <CommentItem key={c.id} comment={c} onDelete={handleDelete} onEdit={handleEdit} onResolve={handleResolve} />)}
        </div>
      )}

      {/* Composer */}
      <div style={{ marginTop: 16, border: `1px solid ${focused ? 'var(--accent-border)' : 'var(--border-default)'}`, borderRadius: 8, background: 'var(--bg-1)', transition: 'border-color .15s', overflow: 'hidden' }}>
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-2)' }}>
            {pending.map((a, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {a.type.startsWith('image/') ? (
                  <img src={a.url} alt={a.name} style={{ height: 56, borderRadius: 6, border: '1px solid var(--border-default)', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 5, background: 'var(--bg-3)', border: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <I.Paperclip size={11} />{a.name}
                  </div>
                )}
                <button onClick={() => setPending(p => p.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <I.Close size={8} stroke="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, padding: '10px 12px' }}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onPaste={handlePaste}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            rows={focused || text ? 3 : 1}
            placeholder="Add a comment… paste screenshots, ⌘+Enter to send"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-primary)', padding: '3px 0', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderTop: focused || text ? '1px solid var(--border-subtle)' : 'none', height: focused || text || pending.length > 0 ? 'auto' : 0, overflow: 'hidden' }}>
          <IconBtn title="Attach" onClick={() => fileInputRef.current?.click()} style={{ width: 24, height: 24 }}>
            {uploading ? <span style={{ fontSize: 10 }}>…</span> : <I.Paperclip size={13} />}
          </IconBtn>
          <IconBtn title="Image" onClick={() => fileInputRef.current?.click()} style={{ width: 24, height: 24 }}><I.Image size={13} /></IconBtn>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.json" style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)} />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Markdown</span>
          <button disabled={!text.trim() && pending.length === 0} onClick={handleSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 5, background: text.trim() || pending.length > 0 ? 'var(--accent)' : 'var(--bg-3)', color: text.trim() || pending.length > 0 ? '#0a0a0b' : 'var(--text-muted)', fontSize: 12, fontWeight: 500, opacity: submitting ? 0.7 : 1, cursor: 'pointer', transition: 'all .12s' }}>
            <I.Send size={12} /> Comment
          </button>
        </div>
      </div>
    </div>
  )
}
