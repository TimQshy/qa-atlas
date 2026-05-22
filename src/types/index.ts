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

export interface Comment {
  id: string
  entity_type: 'folder' | 'item'
  entity_id: string
  text: string
  attachments: { name: string; url: string }[]
  author_email: string | null
  release_id: string | null
  is_resolved: boolean
  created_at: string
}

export interface SnapshotExport {
  meta: { schemaVersion: number; exportedAt: string }
  folders: Folder[]
  items: Item[]
  releases: Release[]
}

export interface TestRunTest {
  id: string
  run_id: string
  test_file: string
  test_suite?: string | null
  test_name: string
  status: 'passed' | 'failed' | 'flaky' | 'skipped'
  duration_ms?: number | null
  retry_count: number
  error_message?: string | null
  created_at: string
}

export interface TestRun {
  id: string
  build_id: string
  started_at: string
  expected: number
  unexpected: number
  flaky: number
  skipped: number
  total: number
  duration_sec: number
  hard_fail_tests: string[]
  is_infra_failure: boolean
  hard_fail_rate: number
  flaky_rate: number
  report_url?: string | null
  created_at: string
  tests?: TestRunTest[]
}

export interface TestStatsFlaky {
  test_file: string
  test_name: string
  flaky_count: number
  last_seen: string
}

export interface TestStatsSlowest {
  test_file: string
  test_name: string
  median_duration_ms: number
}

export interface TestStatsJourneyMatrix {
  test_file: string
  runs: { run_id: string; started_at: string; status: 'passed' | 'failed' | 'flaky' | 'skipped' | 'not_run' }[]
}
