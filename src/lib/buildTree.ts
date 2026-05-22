import type { Folder, Item, TreeNode, Comment } from '@/types'

export function buildTree(folders: Folder[], items: Item[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()

  for (const folder of folders) {
    nodeMap.set(folder.id, { type: 'folder', folder, children: [], items: [] })
  }

  for (const item of items) {
    const node = nodeMap.get(item.folder_id)
    if (node) node.items.push(item)
  }

  const roots: TreeNode[] = []
  for (const folder of folders) {
    const node = nodeMap.get(folder.id)!
    if (folder.parent_id && nodeMap.has(folder.parent_id)) {
      nodeMap.get(folder.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function computeHighlightedIds(
  release: { affected_folder_ids: string[]; affected_item_ids: string[]; tags: string[] } | null,
  folders: Folder[],
  items: Item[],
  comments: Comment[] = []
): Set<string> {
  if (!release) return new Set()

  const ids = new Set<string>([...release.affected_item_ids])

  if (release.tags.length > 0) {
    const releaseTags = new Set(release.tags)
    for (const f of folders) {
      if (f.tags.some((t) => releaseTags.has(t))) ids.add(f.id)
    }
    for (const i of items) {
      if (i.tags.some((t) => releaseTags.has(t))) ids.add(i.id)
    }
  }

  // Only unresolved comments seed highlights
  const itemMap = new Map(items.map(i => [i.id, i]))
  for (const c of comments) {
    if (c.is_resolved) continue
    if (c.entity_type === 'folder') ids.add(c.entity_id)
    else if (c.entity_type === 'item') {
      ids.add(c.entity_id)
      const item = itemMap.get(c.entity_id)
      if (item) ids.add(item.folder_id)
    }
  }

  // Propagate highlights up the folder tree
  const folderMap = new Map(folders.map(f => [f.id, f]))

  for (const id of [...ids]) {
    const item = itemMap.get(id)
    if (item) {
      let folderId: string | null | undefined = item.folder_id
      while (folderId) {
        ids.add(folderId)
        folderId = folderMap.get(folderId)?.parent_id
      }
    }
  }

  for (const id of [...ids]) {
    const folder = folderMap.get(id)
    if (folder) {
      let parentId: string | null | undefined = folder.parent_id
      while (parentId) {
        ids.add(parentId)
        parentId = folderMap.get(parentId)?.parent_id
      }
    }
  }

  return ids
}
