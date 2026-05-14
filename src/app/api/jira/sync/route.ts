import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'
import type { Folder } from '@/types'

// Recursively extract plain text from Atlassian Document Format
function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  if (n.type === 'text' && typeof n.text === 'string') return n.text
  if (Array.isArray(n.content)) {
    return (n.content as unknown[]).map(adfToText).filter(Boolean).join('\n')
  }
  return ''
}

interface JiraIssue {
  key: string
  fields: {
    summary: string
    status?: { name: string; statusCategory?: { key: string } }
    issuetype?: { name: string }
    assignee?: { displayName: string } | null
    description?: unknown
  }
}

async function searchJira(jql: string, host: string, creds: string): Promise<JiraIssue[]> {
  const url = `https://${host}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,issuetype,assignee,description&maxResults=100`
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${creds}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`)
  const data = await res.json()
  return (data.issues ?? []) as JiraIssue[]
}

interface DeepSeekResult {
  folder_id: string | null
  summary: string
}

async function classifyTicket(
  ticket: { key: string; summary: string; description: string },
  folders: Folder[],
  apiKey: string,
): Promise<DeepSeekResult> {
  const folderList = folders.map(f => `id="${f.id}" name="${f.name}"`).join('\n')

  const prompt = `You are a QA test management assistant. Given a Jira ticket, do two things:
1. Write a concise 2-3 sentence QA summary describing what needs to be tested.
2. Pick the best matching folder from the list below (or null if none fits).

Folders:
${folderList}

Ticket [${ticket.key}]: ${ticket.summary}${ticket.description ? `\n\n${ticket.description}` : ''}

Respond ONLY with valid JSON, no markdown, no code fences:
{"folder_id":"<id or null>","summary":"<2-3 sentences>"}`

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`)
  const data = await res.json()
  const content: string = data.choices[0].message.content.trim()
  // Strip markdown code fences and extract the first {...} object
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in DeepSeek response: ${stripped.slice(0, 80)}`)
  return JSON.parse(match[0]) as DeepSeekResult
}

const UNSORTABLE_FOLDER_NAME = 'Unsortable'

export async function GET(req: NextRequest) {
  // Security: require Bearer token matching CRON_SECRET when set
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_JQL, DEEPSEEK_API_KEY } = process.env
  if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return NextResponse.json({ error: 'Jira not configured' }, { status: 503 })
  }
  if (!DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: 'DeepSeek not configured' }, { status: 503 })
  }

  const jql = JIRA_JQL ?? 'project = ET AND status = QA ORDER BY created DESC'
  const creds = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
  const db = getAdminClient()

  // 1. Fetch Jira tickets
  let issues: JiraIssue[]
  try {
    issues = await searchJira(jql, JIRA_HOST, creds)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // 2. Collect all ticket keys already stored in items
  const { data: existingItems } = await db.from('items').select('tickets')
  const existingKeys = new Set<string>()
  for (const item of existingItems ?? []) {
    const tickets = (item.tickets as { key: string }[]) ?? []
    for (const t of tickets) if (t.key) existingKeys.add(t.key)
  }

  // 3. Load folders
  const { data: foldersRaw } = await db
    .from('folders')
    .select('id, name, parent_id, tags, sort_order')
    .order('sort_order')
  const folders = (foldersRaw ?? []) as Folder[]

  // 4. Ensure the Unsortable folder exists
  let unsortableId = folders.find(f => f.name === UNSORTABLE_FOLDER_NAME)?.id ?? null
  if (!unsortableId) {
    unsortableId = uuidv4()
    await db.from('folders').insert({
      id: unsortableId,
      name: UNSORTABLE_FOLDER_NAME,
      parent_id: null,
      tags: [],
      sort_order: 9999,
    })
    folders.push({ id: unsortableId, name: UNSORTABLE_FOLDER_NAME, parent_id: null, tags: [], sort_order: 9999, is_duplicatable: false })
  }

  // 5. Fetch the latest release to attach new items to it
  const { data: latestReleaseRow } = await db
    .from('releases')
    .select('id, affected_item_ids')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 6. Process only new tickets
  const results = { inserted: 0, skipped: 0, errors: [] as string[] }
  const folderIds = new Set(folders.map(f => f.id))
  const newItemIds: string[] = []

  for (const issue of issues) {
    if (existingKeys.has(issue.key)) {
      results.skipped++
      continue
    }

    const summary = issue.fields?.summary ?? issue.key
    const description = adfToText(issue.fields?.description).trim()

    try {
      const classified = await classifyTicket(
        { key: issue.key, summary, description },
        folders,
        DEEPSEEK_API_KEY,
      )

      // Validate folder_id returned by AI — fall back to Unsortable
      const targetFolderId =
        classified.folder_id && folderIds.has(classified.folder_id)
          ? classified.folder_id
          : unsortableId

      const newId = uuidv4()
      await db.from('items').insert({
        id: newId,
        title: summary,
        folder_id: targetFolderId,
        description: classified.summary,
        tags: [],
        priority: 'medium',
        status: 'To Do',
        tickets: [{ key: issue.key, url: `https://${JIRA_HOST}/browse/${issue.key}` }],
        bugs: [],
        is_stable: false,
      })

      newItemIds.push(newId)
      results.inserted++
    } catch (err) {
      results.errors.push(`${issue.key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 7. Add new items to the latest release
  if (latestReleaseRow && newItemIds.length > 0) {
    const existing = (latestReleaseRow.affected_item_ids as string[]) ?? []
    const merged = [...new Set([...existing, ...newItemIds])]
    await db
      .from('releases')
      .update({ affected_item_ids: merged })
      .eq('id', latestReleaseRow.id)
  }

  return NextResponse.json({
    ok: true,
    jql,
    total: issues.length,
    ...results,
    release_updated: latestReleaseRow?.id ?? null,
  })
}
