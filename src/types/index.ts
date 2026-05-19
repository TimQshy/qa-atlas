export interface Folder {
  id: string
  name: string
  parent_id: string | null
  tags: string[]
  sort_order: number
  is_duplicatable: boolean
}

export interface Item {
  id: string
  title: string
  folder_id: string
  description: string
  tags: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked'
  tickets: { key: string; url?: string }[]
  bugs: { key: string; url?: string }[]
  is_stable: boolean
  is_duplicatable: boolean
  duplicate_note: string
  jira_synced: boolean
}

export interface Release {
  id: string
  name: string
  date: string
  affected_folder_ids: string[]
  affected_item_ids: string[]
  excluded_folder_ids: string[]
  tags: string[]
}

export interface TreeNode {
  type: 'folder'
  folder: Folder
  children: TreeNode[]
  items: Item[]
}

export interface SnapshotExport {
  meta: { schemaVersion: number; exportedAt: string }
  folders: Folder[]
  items: Item[]
  releases: Release[]
}
