import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

interface TestPayload {
  testFile: string
  testSuite?: string
  testName: string
  status: 'passed' | 'failed' | 'flaky' | 'skipped'
  durationMs?: number
  retryCount?: number
  errorMessage?: string
}

interface TestRunPayload {
  date: string
  startedAt?: string
  buildId: string
  expected: number
  unexpected: number
  flaky: number
  skipped: number
  total: number
  durationSec: number
  hardFailTests: string[]
  isInfraFailure: boolean
  hardFailRate: number
  flakyRate: number
  reportUrl?: string
  tests?: TestPayload[]
}

function authorized(request: Request): boolean {
  const key = process.env.TEST_RUN_API_KEY
  if (!key) return false
  return request.headers.get('authorization') === `Bearer ${key}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: TestRunPayload = await request.json()
  const { date, startedAt, buildId, expected = 0, unexpected = 0, flaky = 0, skipped = 0,
    total = 0, durationSec = 0, hardFailTests = [], isInfraFailure = false,
    hardFailRate = 0, flakyRate = 0, reportUrl, tests } = body

  if (!buildId || (!date && !startedAt)) {
    return NextResponse.json({ error: 'buildId and date/startedAt are required' }, { status: 400 })
  }

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('test_runs')
    .insert({
      build_id: buildId,
      started_at: startedAt || date,
      expected, unexpected, flaky, skipped, total,
      duration_sec: durationSec,
      hard_fail_tests: hardFailTests,
      is_infra_failure: isInfraFailure,
      hard_fail_rate: hardFailRate,
      flaky_rate: flakyRate,
      report_url: reportUrl ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (tests && tests.length > 0) {
    const rows = tests.map(t => ({
      run_id: data.id,
      test_file: t.testFile,
      test_suite: t.testSuite ?? null,
      test_name: t.testName,
      status: t.status,
      duration_ms: t.durationMs ?? null,
      retry_count: t.retryCount ?? 0,
      error_message: t.errorMessage ?? null,
    }))

    const { error: testsError } = await supabase.from('test_run_tests').insert(rows)
    if (testsError) return NextResponse.json({ error: testsError.message }, { status: 500 })
  }

  if (unexpected > 0) {
    await notifySlack({ buildId, expected, unexpected, flaky, skipped, total, durationSec, hardFailTests, reportUrl })
  }

  return NextResponse.json(data, { status: 201 })
}

async function notifySlack(run: Omit<TestRunPayload, 'date' | 'isInfraFailure' | 'hardFailRate' | 'flakyRate' | 'tests'>) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const passRate = run.total > 0 ? ((run.expected / run.total) * 100).toFixed(1) : '0'
  const mins = Math.round(run.durationSec / 60)
  const lines: string[] = [
    `*:red_circle: E2E Tests Failed* — Build \`${run.buildId}\``,
    `✅ ${run.expected} passed  ❌ ${run.unexpected} failed  🔁 ${run.flaky} flaky  ⏭️ ${run.skipped} skipped`,
    `Pass rate: *${passRate}%*  ·  Duration: ${mins}m`,
  ]
  if (run.hardFailTests.length) {
    lines.push(`*Failed:*\n${run.hardFailTests.slice(0, 10).map(t => `• ${t}`).join('\n')}`)
  }
  if (run.reportUrl) lines.push(`<${run.reportUrl}|View full report>`)

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  }).catch(() => {})
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 500)
  const includeTests = searchParams.get('include') === 'tests'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = getAdminClient()

  let query = supabase
    .from('test_runs')
    .select(includeTests ? '*, test_run_tests(*)' : '*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
