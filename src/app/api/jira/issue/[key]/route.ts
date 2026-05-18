import { NextResponse } from 'next/server'

// Recursively extract plain text from Atlassian Document Format (ADF)
function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  if (n.type === 'text' && typeof n.text === 'string') return n.text
  if (Array.isArray(n.content)) {
    return (n.content as unknown[]).map(adfToText).filter(Boolean).join('\n')
  }
  return ''
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
  if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return NextResponse.json({ error: 'Jira not configured' }, { status: 503 })
  }
  const url = `https://${JIRA_HOST}/rest/api/3/issue/${key}?fields=summary,status,issuetype,assignee,description`
  const creds = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${creds}`, Accept: 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return NextResponse.json({ error: `Jira returned ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({
      key,
      summary: data.fields?.summary ?? '',
      description: adfToText(data.fields?.description).trim(),
      status: data.fields?.status?.name ?? '',
      statusCategory: data.fields?.status?.statusCategory?.key ?? '',
      type: data.fields?.issuetype?.name ?? '',
      assignee: data.fields?.assignee?.displayName ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach Jira' }, { status: 502 })
  }
}
