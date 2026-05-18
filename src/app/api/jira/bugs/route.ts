import { NextResponse } from 'next/server'

interface JiraIssue {
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory: { key: string } }
    priority: { name: string }
    assignee: { displayName: string } | null
  }
}

export async function GET() {
  const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
  if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return NextResponse.json({ error: 'Jira not configured' }, { status: 503 })
  }

  const jql = 'issuetype = Bug AND priority in (Blocker, Critical) AND statusCategory != Done ORDER BY priority DESC, created DESC'
  const url = `https://${JIRA_HOST}/rest/api/3/search/jql`
  const creds = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, fields: ['summary', 'status', 'priority', 'assignee'], maxResults: 20 }),
      next: { revalidate: 300 },
    })
    if (!res.ok) return NextResponse.json({ error: `Jira returned ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json(
      (data.issues as JiraIssue[]).map(issue => ({
        key: issue.key,
        summary: issue.fields?.summary ?? '',
        status: issue.fields?.status?.name ?? '',
        statusCategory: issue.fields?.status?.statusCategory?.key ?? '',
        priority: issue.fields?.priority?.name ?? '',
        assignee: issue.fields?.assignee?.displayName ?? null,
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Failed to reach Jira' }, { status: 502 })
  }
}
