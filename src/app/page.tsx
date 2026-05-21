'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Folder, Item, Release, Comment, TreeNode } from '@/types'
import { buildTree, computeHighlightedIds } from '@/lib/buildTree'
import { FolderTree } from '@/components/FolderTree'
import { DetailPanel } from '@/components/DetailPanel'
import { getSupabase } from '@/lib/supabase'
import { I } from '@/components/Icons'
import { IconBtn, Avatar, Kbd } from '@/components/Primitives'

interface NewReleaseState {
  open: boolean
  name: string
  date: string
  tags: string
  sourceReleaseId: string
  selectedFolderIds: Set<string>
  selectedItemIds: Set<string>
  selectedCommentIds: Set<string>
}

const EMPTY_RELEASE: NewReleaseState = {
  open: false, name: '', date: '', tags: '', sourceReleaseId: '',
  selectedFolderIds: new Set(), selectedItemIds: new Set(), selectedCommentIds: new Set(),
}

export default function Home() {
  const router = useRouter()
  const [folders, setFolders] = useState<Folder[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncToast, setSyncToast] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const [collapseKey, setCollapseKey] = useState(0)
  const [expandKey, setExpandKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'folder' | 'item' | null>(null)
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [releaseOpen, setReleaseOpen] = useState(false)
  const releaseRef = useRef<HTMLDivElement>(null)

  // Folder creation
  const [addingFolder, setAddingFolder] = useState<{ parentId: string | null } | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Release creation
  const [newRelease, setNewRelease] = useState<NewReleaseState>(EMPTY_RELEASE)
  const [sourceComments, setSourceComments] = useState<Comment[]>([])
  const [releaseComments, setReleaseComments] = useState<Comment[]>([])

  const load = useCallback(async (releaseId?: string | null) => {
    setLoading(true)
    try {
      const treeUrl = releaseId ? `/api/tree?release_id=${releaseId}` : '/api/tree'
      const fetches: Promise<Response>[] = [fetch(treeUrl), fetch('/api/releases')]
      if (releaseId) fetches.push(fetch(`/api/comments?release_id=${releaseId}`))
      const [treeRes, releasesRes, commentsRes] = await Promise.all(fetches)
      if (!treeRes.ok || !releasesRes.ok) throw new Error('Failed to load')
      const tree = await treeRes.json()
      const rels = await releasesRes.json()
      setFolders(tree.folders ?? [])
      setItems(tree.items ?? [])
      setReleases(rels ?? [])
      setReleaseComments(commentsRes?.ok ? await commentsRes.json() : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(selectedReleaseId)
  }, [selectedReleaseId, load])

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
    const close = (e: MouseEvent) => { if (releaseRef.current && !releaseRef.current.contains(e.target as Node)) setReleaseOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (addingFolder !== null) newFolderInputRef.current?.focus()
  }, [addingFolder])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const handleSeed = async () => { setSeeding(true); await fetch('/api/seed', { method: 'POST' }); await load(selectedReleaseId); setSeeding(false) }

  const handleJiraSync = async () => {
    setSyncing(true)
    setSyncToast(null)
    try {
      const res = await fetch('/api/jira/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncToast(`Sync failed: ${data.error}`)
      } else {
        setSyncToast(`+${data.inserted} added, ${data.skipped} skipped`)
        if (data.inserted > 0) await load(selectedReleaseId)
      }
    } catch {
      setSyncToast('Sync failed')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncToast(null), 4000)
    }
  }
  const handleExport = async () => {
    const res = await fetch('/api/snapshot/export')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `qa-atlas-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
      const text = await file.text()
      await fetch('/api/snapshot/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })
      await load(selectedReleaseId)
    }; input.click()
  }
  const handleLogout = async () => { await getSupabase().auth.signOut(); router.push('/login'); router.refresh() }

  const handleDelete = async (id: string, type: 'folder' | 'item') => {
    const rel = selectedReleaseId ? releases.find(r => r.id === selectedReleaseId) : null
    if (selectedReleaseId && rel) {
      if (type === 'folder') {
        const newExcluded = [...(rel.excluded_folder_ids ?? []).filter(x => x !== id), id]
        await fetch(`/api/releases/${selectedReleaseId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excluded_folder_ids: newExcluded }),
        })
        setReleases(r => r.map(x => x.id === selectedReleaseId ? { ...x, excluded_folder_ids: newExcluded } : x))
      } else {
        const newAffected = (rel.affected_item_ids ?? []).filter(x => x !== id)
        await fetch(`/api/releases/${selectedReleaseId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affected_item_ids: newAffected }),
        })
        setReleases(r => r.map(x => x.id === selectedReleaseId ? { ...x, affected_item_ids: newAffected } : x))
      }
      setSelectedId(null)
      return
    }
    await fetch(`/api/${type === 'folder' ? 'folders' : 'items'}/${id}`, { method: 'DELETE' })
    if (type === 'folder') setFolders(f => f.filter(x => x.id !== id))
    else setItems(i => i.filter(x => x.id !== id))
    setSelectedId(null)
  }

  const handleUpdate = async (id: string, type: 'folder' | 'item', patch: Partial<Folder | Item>) => {
    const body = (selectedReleaseId && type === 'item') ? { ...patch, release_id: selectedReleaseId } : patch
    const res = await fetch(`/api/${type === 'folder' ? 'folders' : 'items'}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    if (!res.ok) return
    if (type === 'folder') setFolders(f => f.map(x => x.id === id ? { ...x, ...patch } : x))
    else setItems(i => i.map(x => x.id === id ? { ...x, ...patch } : x))
  }

  const handleDeleteRelease = async (id: string) => {
    await fetch(`/api/releases/${id}`, { method: 'DELETE' })
    setReleases(r => r.filter(x => x.id !== id))
    if (selectedReleaseId === id) setSelectedReleaseId(null)
  }

  // ── Folder creation ──────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: addingFolder?.parentId ?? null }),
    })
    if (!res.ok) return
    const created = await res.json()
    setFolders(f => [...f, created])
    setAddingFolder(null)
    setNewFolderName('')
  }

  // ── Item creation ────────────────────────────────────────────────────────
  const handleCreateItem = async (folderId: string, data: Partial<Item>) => {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId, ...data }),
    })
    if (!res.ok) return
    const created = await res.json()
    setItems(prev => [...prev, created])
    setSelectedId(created.id)
    setSelectedType('item')
    const rel = selectedReleaseId ? releases.find(r => r.id === selectedReleaseId) : null
    if (selectedReleaseId && rel) {
      const newAffected = [...rel.affected_item_ids, created.id]
      await fetch(`/api/releases/${selectedReleaseId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affected_item_ids: newAffected }),
      })
      setReleases(r => r.map(x => x.id === selectedReleaseId ? { ...x, affected_item_ids: newAffected } : x))
    }
  }

  // ── Release creation with duplicate ─────────────────────────────────────
  const handleSourceReleaseChange = async (releaseId: string) => {
    const source = releases.find(r => r.id === releaseId)
    if (!source) {
      setNewRelease(f => ({ ...f, sourceReleaseId: releaseId, selectedFolderIds: new Set(), selectedItemIds: new Set(), selectedCommentIds: new Set() }))
      setSourceComments([])
      return
    }
    const selFolders = new Set(source.affected_folder_ids.filter(id => folders.find(f => f.id === id)))
    const selItems = new Set(source.affected_item_ids.filter(id => items.find(i => i.id === id)?.is_duplicatable))
    const commentsRes = await fetch(`/api/comments?release_id=${releaseId}`)
    const comments: Comment[] = commentsRes.ok ? await commentsRes.json() : []
    setSourceComments(comments)
    setNewRelease(f => ({ ...f, sourceReleaseId: releaseId, selectedFolderIds: selFolders, selectedItemIds: selItems, selectedCommentIds: new Set() }))
  }

  const toggleDupFolder = (id: string) => {
    setNewRelease(f => {
      const next = new Set(f.selectedFolderIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...f, selectedFolderIds: next }
    })
  }
  const toggleDupItem = (id: string) => {
    setNewRelease(f => {
      const next = new Set(f.selectedItemIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...f, selectedItemIds: next }
    })
  }
  const toggleDupComment = (id: string) => {
    setNewRelease(f => {
      const next = new Set(f.selectedCommentIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...f, selectedCommentIds: next }
    })
  }

  const handleCreateRelease = async () => {
    if (!newRelease.name.trim() || !newRelease.date) return
    const res = await fetch('/api/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newRelease.name.trim(),
        date: newRelease.date,
        tags: newRelease.tags.split(',').map(t => t.trim()).filter(Boolean),
        affected_folder_ids: [...newRelease.selectedFolderIds],
        source_item_ids: [...newRelease.selectedItemIds],
        source_comment_ids: [...newRelease.selectedCommentIds],
      }),
    })
    if (!res.ok) return
    const created = await res.json()
    setReleases(r => [created, ...r])
    setNewRelease(EMPTY_RELEASE)
    setSourceComments([])
  }

  const handleAddFolderToRelease = async (folderId: string) => {
    if (!selectedReleaseId) return
    const rel = releases.find(r => r.id === selectedReleaseId)
    if (!rel) return
    const newAffected = rel.affected_folder_ids.includes(folderId)
      ? rel.affected_folder_ids
      : [...rel.affected_folder_ids, folderId]
    const newExcluded = (rel.excluded_folder_ids ?? []).filter(x => x !== folderId)
    await fetch(`/api/releases/${selectedReleaseId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affected_folder_ids: newAffected, excluded_folder_ids: newExcluded }),
    })
    setReleases(r => r.map(x => x.id === selectedReleaseId
      ? { ...x, affected_folder_ids: newAffected, excluded_folder_ids: newExcluded }
      : x
    ))
  }

  const nodes: TreeNode[] = buildTree(folders, items)
  const selectedRelease = releases.find(r => r.id === selectedReleaseId) ?? null
  const highlightedIds = computeHighlightedIds(selectedRelease, folders, items, releaseComments)
  const affectedFolderIds = new Set(selectedRelease?.affected_folder_ids ?? [])
  const excludedIds = new Set(selectedRelease?.excluded_folder_ids ?? [])
  const selectedData = selectedId && selectedType === 'folder'
    ? { type: 'folder' as const, data: folders.find(f => f.id === selectedId)! }
    : selectedId && selectedType === 'item'
    ? { type: 'item' as const, data: items.find(i => i.id === selectedId)! }
    : null

  // Source release items for the duplicate picker
  const sourceRelease = releases.find(r => r.id === newRelease.sourceReleaseId) ?? null
  const dupFolders = sourceRelease ? folders.filter(f => sourceRelease.affected_folder_ids.includes(f.id)) : []
  const dupItems = sourceRelease ? items.filter(i => sourceRelease.affected_item_ids.includes(i.id) && i.is_duplicatable) : []
  const dupComments = sourceComments

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', color: 'var(--text-primary)', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', padding: '0 10px 0 12px', gap: 8, flexShrink: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <I.Logo size={18} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>QA Atlas</span>
        </div>

        {/* ── Release selector ── */}
        <div ref={releaseRef} style={{ position: 'relative', marginLeft: 12 }}>
          <button onClick={() => setReleaseOpen(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 10px 0 8px', borderRadius: 6, border: `1px solid ${selectedRelease ? 'var(--accent-border)' : 'var(--border-default)'}`, background: selectedRelease ? 'var(--accent-soft)' : 'var(--bg-2)', fontSize: 12, transition: 'background .12s', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = selectedRelease ? 'rgba(255,107,26,0.18)' : 'var(--bg-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = selectedRelease ? 'var(--accent-soft)' : 'var(--bg-2)')}>
            <I.GitBranch size={13} stroke={selectedRelease ? 'var(--accent)' : 'var(--text-muted)'} />
            {selectedRelease ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="qa-mono" style={{ fontSize: 12, color: 'var(--accent-text)', fontWeight: 500 }}>{selectedRelease.name}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span className="qa-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedRelease.date}</span>
                {selectedRelease.tags.slice(0, 3).map(t => (
                  <span key={t} className="qa-caps" style={{ color: 'var(--accent-text)', fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,107,26,0.10)' }}>{t}</span>
                ))}
                <span style={{ paddingLeft: 6, borderLeft: '1px solid var(--accent-border)', marginLeft: 2, fontSize: 11, color: 'var(--accent-text)', fontWeight: 500 }}>
                  {highlightedIds.size} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>affected</span>
                </span>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Select release…</span>
            )}
            <I.ChevronDown size={12} stroke="var(--text-muted)" />
          </button>

          {releaseOpen && (
            <div className="qa-fade-in" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 360, maxWidth: 480, zIndex: 60, background: 'var(--bg-2)', border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: 'var(--shadow-pop)', padding: 6, maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="qa-caps" style={{ padding: '8px 10px 6px', color: 'var(--text-muted)' }}>Releases</div>

              {/* None option */}
              <button onClick={() => { setSelectedReleaseId(null); setReleaseOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 5, background: !selectedReleaseId ? 'var(--bg-3)' : 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
                onMouseEnter={e => { if (selectedReleaseId) e.currentTarget.style.background = 'var(--bg-3)' }}
                onMouseLeave={e => { if (selectedReleaseId) e.currentTarget.style.background = 'transparent' }}>
                <I.Close size={13} stroke="var(--text-muted)" /> None
              </button>

              {/* Existing releases */}
              {releases.map(r => {
                const active = r.id === selectedReleaseId
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => { setSelectedReleaseId(r.id); setReleaseOpen(false) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 5, background: active ? 'var(--bg-3)' : 'transparent', textAlign: 'left', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-3)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                      <I.GitBranch size={13} stroke={active ? 'var(--accent)' : 'var(--text-muted)'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="qa-mono" style={{ fontSize: 12, fontWeight: 500, color: active ? 'var(--accent-text)' : 'var(--text-primary)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{r.date} · {r.tags.join(', ') || 'no tags'}</div>
                      </div>
                      {active && <I.Check size={12} stroke="var(--accent)" />}
                    </button>
                    <button onClick={() => handleDeleteRelease(r.id)}
                      style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)'; e.currentTarget.style.color = 'var(--red)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)' }}>
                      <I.Trash size={12} />
                    </button>
                  </div>
                )
              })}

              {/* ── New release form ── */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 6, paddingTop: 6 }}>
                {!newRelease.open ? (
                  <button onClick={() => setNewRelease(f => ({ ...f, open: true }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 5, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', transition: 'all .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <I.Plus size={13} /> New release…
                  </button>
                ) : (
                  <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="qa-caps" style={{ color: 'var(--text-muted)', paddingLeft: 4 }}>New release</div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={newRelease.name} onChange={e => setNewRelease(f => ({ ...f, name: e.target.value }))}
                        placeholder="Release name…" autoFocus
                        style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                      <input type="date" value={newRelease.date} onChange={e => setNewRelease(f => ({ ...f, date: e.target.value }))}
                        style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />
                    </div>

                    <input value={newRelease.tags} onChange={e => setNewRelease(f => ({ ...f, tags: e.target.value }))}
                      placeholder="Tags (comma-separated)…"
                      style={{ background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'} />

                    {/* Duplicate from */}
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Duplicate from release (optional)</label>
                      <select value={newRelease.sourceReleaseId} onChange={e => handleSourceReleaseChange(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border-default)', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                        <option value="">— none —</option>
                        {releases.map(r => <option key={r.id} value={r.id}>{r.name} ({r.date})</option>)}
                      </select>
                    </div>

                    {/* Item picker when source selected */}
                    {sourceRelease && (dupFolders.length > 0 || dupItems.length > 0 || dupComments.length > 0) && (
                      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }} className="qa-scroll">
                        {dupFolders.length > 0 && (
                          <>
                            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              Folders <span style={{ textTransform: 'none', fontSize: 10, color: 'var(--accent-text)', letterSpacing: 0 }}>· always included</span>
                            </div>
                            {dupFolders.map(f => (
                              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 0', opacity: 0.8 }}>
                                <I.Folder size={11} stroke="var(--accent)" />
                                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{f.name}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {dupItems.length > 0 && (
                          <>
                            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              Test Cases <span style={{ textTransform: 'none', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0 }}>· select to include</span>
                            </div>
                            {dupItems.map(i => (
                              <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '2px 0' }}>
                                <input type="checkbox" checked={newRelease.selectedItemIds.has(i.id)} onChange={() => toggleDupItem(i.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                <I.Doc size={11} stroke="var(--text-muted)" />
                                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }} className="qa-truncate">{i.title}</span>
                              </label>
                            ))}
                          </>
                        )}
                        {dupComments.length > 0 && (
                          <>
                            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              Comments <span style={{ textTransform: 'none', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0 }}>· select to include</span>
                            </div>
                            {dupComments.map(c => {
                              const entityName = c.entity_type === 'folder'
                                ? (folders.find(f => f.id === c.entity_id)?.name ?? c.entity_id)
                                : (items.find(i => i.id === c.entity_id)?.title ?? c.entity_id)
                              return (
                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '2px 0' }}>
                                  <input type="checkbox" checked={newRelease.selectedCommentIds.has(c.id)} onChange={() => toggleDupComment(c.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                  <I.Comment size={11} stroke="var(--text-muted)" />
                                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }} className="qa-truncate">
                                    <span style={{ color: 'var(--text-faint)' }}>{entityName}:</span> {c.text?.slice(0, 60)}
                                  </span>
                                </label>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleCreateRelease} disabled={!newRelease.name.trim() || !newRelease.date}
                        style={{ flex: 1, padding: '6px 0', background: 'var(--accent)', color: '#0a0a0b', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: newRelease.name.trim() && newRelease.date ? 'pointer' : 'default', opacity: newRelease.name.trim() && newRelease.date ? 1 : 0.5 }}>
                        Create release
                      </button>
                      <button onClick={() => setNewRelease(EMPTY_RELEASE)}
                        style={{ padding: '6px 12px', border: '1px solid var(--border-default)', borderRadius: 5, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => router.push('/dashboard')}
            title="E2E Pipeline Dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 9px', borderRadius: 5, border: '1px solid var(--border-default)', background: 'var(--bg-2)', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Dashboard
          </button>
          <IconBtn title="Refresh" onClick={() => load(selectedReleaseId)}><I.Refresh size={14} /></IconBtn>
          <IconBtn title="Jira Sync" onClick={syncing ? undefined : handleJiraSync} style={{ opacity: syncing ? 0.5 : 1, cursor: syncing ? 'default' : undefined }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </IconBtn>
          <IconBtn title="Export" onClick={handleExport}><I.Download size={14} /></IconBtn>
          <IconBtn title="Import" onClick={handleImport}><I.Upload size={14} /></IconBtn>
          <IconBtn title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>{theme === 'dark' ? <I.Sun size={14} /> : <I.Moon size={14} />}</IconBtn>
          {userEmail && (
            <>
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
              <Avatar name={userEmail} size={22} />
              <IconBtn title="Sign out" onClick={handleLogout}><I.LogOut size={14} /></IconBtn>
            </>
          )}
        </div>
      </header>

      {syncToast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-3)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--text-primary)', zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {syncToast}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: 'var(--sidebar-w)', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Search + toolbar */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', height: 28, borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--border-subtle)', flex: 1 }}>
              <I.Search size={12} stroke="var(--text-muted)" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter tree…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
              {searchQuery
                ? <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)', display: 'inline-flex', cursor: 'pointer' }}><I.Close size={11} /></button>
                : <Kbd>⌘F</Kbd>}
            </div>
            <IconBtn title="Expand all" onClick={() => setExpandKey(k => k + 1)}><I.ChevronsUp size={14} /></IconBtn>
            <IconBtn title="Collapse all" onClick={() => setCollapseKey(k => k + 1)}><I.ChevronsDown size={14} /></IconBtn>
            <IconBtn title="New root folder" onClick={() => { setAddingFolder({ parentId: null }); setNewFolderName('') }}><I.Plus size={14} /></IconBtn>
          </div>

          {/* Inline folder creation form */}
          {addingFolder !== null && (
            <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                {addingFolder.parentId
                  ? `Subfolder of: ${folders.find(f => f.id === addingFolder.parentId)?.name ?? addingFolder.parentId}`
                  : 'New root folder'}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setAddingFolder(null); setNewFolderName('') } }}
                  placeholder="Folder name…"
                  style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--accent-border)', borderRadius: 4, padding: '5px 8px', fontSize: 12.5, color: 'var(--text-primary)', outline: 'none' }}
                />
                <button onClick={handleCreateFolder}
                  style={{ padding: '5px 12px', background: 'var(--accent)', color: '#0a0a0b', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Add
                </button>
                <button onClick={() => { setAddingFolder(null); setNewFolderName('') }}
                  style={{ padding: '5px 8px', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Release filter strip */}
          {selectedRelease && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'linear-gradient(90deg, var(--accent-softer), transparent 80%)' }}>
              <I.Filter size={11} stroke="var(--accent)" />
              <span className="qa-caps" style={{ color: 'var(--accent-text)' }}>Release filter</span>
              <span className="qa-mono" style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{selectedRelease.name}</span>
              <button onClick={() => setSelectedReleaseId(null)} style={{ fontSize: 10.5, color: 'var(--text-muted)', cursor: 'pointer' }}>clear</button>
            </div>
          )}

          {/* Tree */}
          <div className="qa-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 6px 12px' }}>
            {loading ? (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
            ) : folders.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Database is empty</div>
                <button onClick={handleSeed} disabled={seeding}
                  style={{ padding: '5px 12px', fontSize: 12, background: 'var(--accent)', color: '#0a0a0b', borderRadius: 5, fontWeight: 500, cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.7 : 1 }}>
                  {seeding ? 'Loading…' : 'Load demo data'}
                </button>
              </div>
            ) : (
              <FolderTree
                nodes={nodes} selectedId={selectedId}
                onSelect={(id, type) => { setSelectedId(id); setSelectedType(type) }}
                highlightedIds={highlightedIds} affectedFolderIds={affectedFolderIds} releaseActive={!!selectedRelease} searchQuery={searchQuery}
                collapseKey={collapseKey} expandKey={expandKey}
                onAddFolder={parentId => { setAddingFolder({ parentId }); setNewFolderName('') }}
                onDeleteFolder={id => handleDelete(id, 'folder')}
                excludedIds={excludedIds}
                onAddFolderToRelease={handleAddFolderToRelease}
              />
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span className="qa-mono">{items.length} items</span>
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span className="qa-mono">{folders.length} folders</span>
          </div>
        </aside>

        {/* Detail */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <DetailPanel
            selected={selectedData?.data ? selectedData : null}
            isHighlighted={!!selectedId && highlightedIds.has(selectedId)}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onCreateItem={handleCreateItem}
            releaseId={selectedReleaseId}
          />
        </div>
      </div>
    </div>
  )
}
