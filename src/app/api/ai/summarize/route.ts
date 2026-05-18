import { NextRequest, NextResponse } from 'next/server'

interface JiraTicket {
  key: string
  summary: string
  description: string
}

export async function POST(req: NextRequest) {
  const { DEEPSEEK_API_KEY } = process.env
  if (!DEEPSEEK_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const { title, jiraTickets }: { title: string; jiraTickets?: JiraTicket[] } = await req.json()

  let prompt: string
  if (jiraTickets && jiraTickets.length > 0) {
    const ticketsBlock = jiraTickets.map(t => {
      const lines = [`[${t.key}] ${t.summary}`]
      if (t.description) lines.push(t.description)
      return lines.join('\n')
    }).join('\n\n---\n\n')

    prompt = `You are a QA engineer. Based on the Jira ticket(s) below, write a concise test case description for the test titled "${title}".

Focus on:
- What exactly needs to be tested
- Key scenarios and edge cases
- Expected behavior / acceptance criteria

Use Markdown. Be specific, not generic.

---
${ticketsBlock}`
  } else {
    prompt = `You are a QA engineer. Write a concise test case description for: "${title}". Include test steps and expected result. Use Markdown.`
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return NextResponse.json({ error: `DeepSeek error ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json({ result: data.choices[0].message.content })
  } catch {
    return NextResponse.json({ error: 'Failed to reach AI' }, { status: 502 })
  }
}
