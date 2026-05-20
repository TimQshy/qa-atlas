'use client'
import { useState, useEffect, useRef } from 'react'
import type { TreeNode, Item } from '@/types'
import { I } from './Icons'
import { StatusDot } from './Primitives'

interface Props {
  nodes: TreeNode[]
  selectedId: string | null
  onSelect: (id: string, type: 'folder' | 'item') => void
  highlightedIds: Set<string>
  affectedFolderIds?: Set<string>
  releaseActive: boolean
  searchQuery: string
  collapseKey?: number
  expandKey?: number
  onAddFolder?: (parentId: string) => void
  onDeleteFolder?: (id: string) => void
  excludedIds?: Set<string>
  onAddFolderToRelease?: (folderId: string) => void
}

function TreeRow({
  id, label, kind, depth, isOpen, isSelected, isHighlighted, hasChildren, item,
  isDuplicatable, releaseActive, onClickFolder, onClickItem, onAddSubfolder, onDeleteNode, onAddFolderToRelease,
}: {
  id: string; label: string; kind: 'folder' | 'item'; depth: number; isOpen?: boolean
  isSelected: boolean; isHighlighted: boolean; hasChildren?: boolean; item?: Item
  isDuplicatable?: boolean; releaseActive?: boolean
  onClickFolder?: () => void; onClickItem?: () => void
  onAddSubfolder?: () => void; onDeleteNode?: () => void
  onAddFolderToRelease?: () => void
}) {
  const [hover, setHover] = useState(false)
  const bg = isSelected ? 'var(--bg-3)' : hover ? 'var(--bg-2)' : isHighlighted ? 'var(--accent-softer)' : 'transparent'

  return (
    <div
      onClick={kind === 'folder' ? onClickFolder : onClickItem}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
        height: 'var(--row-h)', paddingLeft: 8 + depth * 16, paddingRight: 6,
        borderRadius: 5, cursor: 'pointer', background: bg,
        fontSize: 13.5, lineHeight: 1, userSelect: 'none', transition: 'background .08s',
      }}
    >
      {isHighlighted && (
        <span style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, borderRadius: 2, background: 'var(--accent)' }} />
      )}

      {/* Chevron */}
      {kind === 'folder' ? (
        <span style={{ width: 12, display: 'inline-flex', flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
          {hasChildren ? <I.Chevron size={12} stroke="var(--text-muted)" /> : null}
        </span>
      ) : <span style={{ width: 12 }} />}

      {/* Folder / Doc icon */}
      {kind === 'folder'
        ? isOpen
          ? <I.FolderOpen size={15} stroke={isHighlighted ? 'var(--accent)' : 'var(--text-muted)'} />
          : <I.Folder size={15} stroke={isHighlighted ? 'var(--accent)' : 'var(--text-muted)'} />
        : <I.Doc size={14} stroke={isHighlighted ? 'var(--accent)' : 'var(--text-faint)'} />
      }

      {/* Label */}
      <span className="qa-truncate" style={{
        flex: 1, color: isHighlighted ? 'var(--text-primary)' : isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isHighlighted ? 500 : 400,
      }}>
        {label}
      </span>

      {/* is_duplicatable indicator */}
      {isDuplicatable && !hover && (
        <I.Copy size={10} stroke="var(--accent)" style={{ flexShrink: 0, opacity: 0.7 }} />
      )}

      {/* Right-side: folder hover actions */}
      {kind === 'folder' && hover && (
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {releaseActive && kind === 'folder' && hover && (
            <button
              title="Add to release"
              onClick={e => { e.stopPropagation(); onAddFolderToRelease?.() }}
              style={{ width: 20, height: 20, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', transition: 'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <I.Copy size={11} />
            </button>
          )}
          <button
            title="Add subfolder"
            onClick={e => { e.stopPropagation(); onAddSubfolder?.() }}
            style={{ width: 20, height: 20, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all .1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-4)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <I.Plus size={11} />
          </button>
          <button
            title={releaseActive ? 'Remove from release' : 'Delete folder'}
            onClick={e => { e.stopPropagation(); onDeleteNode?.() }}
            style={{ width: 20, height: 20, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all .1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-soft)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <I.Trash size={11} />
          </button>
        </div>
      )}

      {/* Jira badge */}
      {kind === 'item' && item?.jira_synced && (
        <span style={{
          fontSize: 9, fontWeight: 700, lineHeight: 1, letterSpacing: 0.2,
          padding: '1px 3px', borderRadius: 3, flexShrink: 0,
          background: 'var(--blue-soft)', color: 'var(--blue)',
        }}>J</span>
      )}

      {/* Item status dot */}
      {kind === 'item' && item && !hover && <StatusDot status={item.status} size={6} />}

      {/* Folder in-release dot */}
      {kind === 'folder' && isHighlighted && !hover && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
      )}
    </div>
  )
}

function FolderNode({
  node, depth, selectedId, onSelect, highlightedIds, affectedFolderIds, releaseActive, searchQuery, collapseKey, expandKey, onAddFolder, onDeleteFolder, excludedIds, onAddFolderToRelease,
}: {
  node: TreeNode; depth: number; selectedId: string | null
  onSelect: (id: string, type: 'folder' | 'item') => void
  highlightedIds: Set<string>; affectedFolderIds?: Set<string>; releaseActive: boolean; searchQuery: string
  collapseKey?: number; expandKey?: number
  onAddFolder?: (parentId: string) => void
  onDeleteFolder?: (id: string) => void
  excludedIds?: Set<string>
  onAddFolderToRelease?: (folderId: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    setOpen(false)
  }, [collapseKey])

  useEffect(() => {
    if (!mounted.current) return
    setOpen(true)
  }, [expandKey])

  if (releaseActive && excludedIds?.has(node.folder.id)) return null

  const q = searchQuery.toLowerCase()
  const folderVisible = (folderId: string) =>
    affectedFolderIds?.has(folderId) || highlightedIds.has(folderId)

  const visibleItems = node.items.filter(i =>
    (!releaseActive || highlightedIds.has(i.id)) &&
    (!q || i.title.toLowerCase().includes(q))
  )
  const visibleChildren = node.children.filter(c =>
    (!releaseActive || folderVisible(c.folder.id) ||
      c.items.some(i => highlightedIds.has(i.id)) ||
      c.children.some(gc => folderVisible(gc.folder.id))) &&
    (!q || c.folder.name.toLowerCase().includes(q) ||
      c.items.some(i => i.title.toLowerCase().includes(q)))
  )

  if (releaseActive && !folderVisible(node.folder.id) && visibleItems.length === 0 && visibleChildren.length === 0) return null
  if (q && !releaseActive && visibleItems.length === 0 && visibleChildren.length === 0 && !node.folder.name.toLowerCase().includes(q)) return null

  return (
    <div>
      <TreeRow
        id={node.folder.id} label={node.folder.name} kind="folder" depth={depth}
        isOpen={open} hasChildren={node.children.length > 0 || node.items.length > 0}
        isSelected={selectedId === node.folder.id} isHighlighted={highlightedIds.has(node.folder.id)}
        isDuplicatable={node.folder.is_duplicatable}
        releaseActive={releaseActive}
        onClickFolder={() => { setOpen(o => !o); onSelect(node.folder.id, 'folder') }}
        onAddSubfolder={() => onAddFolder?.(node.folder.id)}
        onDeleteNode={() => onDeleteFolder?.(node.folder.id)}
        onAddFolderToRelease={() => onAddFolderToRelease?.(node.folder.id)}
      />
      {open && (
        <>
          {visibleChildren.map(child => (
            <FolderNode key={child.folder.id} node={child} depth={depth + 1}
              selectedId={selectedId} onSelect={onSelect}
              highlightedIds={highlightedIds} affectedFolderIds={affectedFolderIds} releaseActive={releaseActive} searchQuery={searchQuery}
              collapseKey={collapseKey} expandKey={expandKey}
              onAddFolder={onAddFolder} onDeleteFolder={onDeleteFolder}
              excludedIds={excludedIds} onAddFolderToRelease={onAddFolderToRelease} />
          ))}
          {visibleItems.map(item => (
            <TreeRow key={item.id} id={item.id} label={item.title} kind="item" depth={depth + 1}
              isSelected={selectedId === item.id} isHighlighted={highlightedIds.has(item.id)}
              isDuplicatable={item.is_duplicatable}
              item={item} onClickItem={() => onSelect(item.id, 'item')} />
          ))}
        </>
      )}
    </div>
  )
}

export function FolderTree({ nodes, selectedId, onSelect, highlightedIds, affectedFolderIds, releaseActive, searchQuery, collapseKey, expandKey, onAddFolder, onDeleteFolder, excludedIds, onAddFolderToRelease }: Props) {
  if (nodes.length === 0) return <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>No folders yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {nodes.map(node => (
        <FolderNode key={node.folder.id} node={node} depth={0}
          selectedId={selectedId} onSelect={onSelect}
          highlightedIds={highlightedIds} affectedFolderIds={affectedFolderIds} releaseActive={releaseActive} searchQuery={searchQuery}
          collapseKey={collapseKey} expandKey={expandKey}
          onAddFolder={onAddFolder} onDeleteFolder={onDeleteFolder}
          excludedIds={excludedIds} onAddFolderToRelease={onAddFolderToRelease} />
      ))}
    </div>
  )
}
