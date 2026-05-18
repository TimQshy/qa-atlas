import type { Folder, Item, TreeNode } from '@/types'

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
  items: Item[]
): Set<string> {
  if (!release) return new Set()

  const ids = new Set<string>([...release.affected_folder_ids, ...release.affected_item_ids])

  if (release.tags.length > 0) {
    const releaseTags = new Set(release.tags)
    for (const f of folders) {
      if (f.tags.some((t) => releaseTags.has(t))) ids.add(f.id)
    }
    for (const i of items) {
      if (i.tags.some((t) => releaseTags.has(t))) ids.add(i.id)
    }
  }

  return ids
}
