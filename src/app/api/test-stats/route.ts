import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const days = parseInt(searchParams.get('days') ?? '30')
  const runsParam = searchParams.get('runs')
  const runs = runsParam ? parseInt(runsParam) : null
  const from = searchParams.get('from')

  const supabase = getAdminClient()

  if (type === 'flaky' || type === 'failed-tests') {
    const since = from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const statuses = type === 'failed-tests' ? ['failed'] : ['flaky', 'failed']

    const { data, error } = await supabase
      .from('test_run_tests')
      .select('test_file, test_name, status, created_at')
      .in('status', statuses)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const map = new Map<string, { test_file: string; test_name: string; flaky_count: number; last_seen: string }>()
    for (const row of data ?? []) {
      const key = `${row.test_file}::${row.test_name}`
      const existing = map.get(key)
      if (existing) {
        existing.flaky_count++
        if (row.created_at > existing.last_seen) existing.last_seen = row.created_at
      } else {
        map.set(key, { test_file: row.test_file, test_name: row.test_name, flaky_count: 1, last_seen: row.created_at })
      }
    }

    const result = [...map.values()].sort((a, b) => b.flaky_count - a.flaky_count).slice(0, 20)
    return NextResponse.json(result)
  }

  if (type === 'slowest') {
    const { data, error } = await supabase
      .from('test_run_tests')
      .select('test_file, test_name, duration_ms')
      .not('duration_ms', 'is', null)
      .order('duration_ms', { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Compute median per test
    const map = new Map<string, { test_file: string; test_name: string; durations: number[] }>()
    for (const row of data ?? []) {
      if (row.duration_ms == null) continue
      const key = `${row.test_file}::${row.test_name}`
      const existing = map.get(key)
      if (existing) {
        existing.durations.push(row.duration_ms)
      } else {
        map.set(key, { test_file: row.test_file, test_name: row.test_name, durations: [row.duration_ms] })
      }
    }

    const result = [...map.values()]
      .map(({ test_file, test_name, durations }) => {
        const sorted = [...durations].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
        return { test_file, test_name, median_duration_ms: Math.round(median) }
      })
      .sort((a, b) => b.median_duration_ms - a.median_duration_ms)
      .slice(0, 10)

    return NextResponse.json(result)
  }

  if (type === 'journey-matrix') {
    let runQuery = supabase
      .from('test_runs')
      .select('id, started_at')
      .order('started_at', { ascending: false })
    if (from) runQuery = runQuery.gte('started_at', from)
    else if (runs) runQuery = runQuery.limit(runs)
    const { data: runRows, error: runError } = await runQuery

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })

    const runIds = (runRows ?? []).map(r => r.id)
    if (runIds.length === 0) return NextResponse.json([])

    const { data: testRows, error: testError } = await supabase
      .from('test_run_tests')
      .select('run_id, test_file, status')
      .in('run_id', runIds)

    if (testError) return NextResponse.json({ error: testError.message }, { status: 500 })

    if ((testRows ?? []).length === 0) return NextResponse.json([])

    // Build matrix: per test_file, per run_id → worst status
    const statusRank: Record<string, number> = { failed: 0, flaky: 1, skipped: 2, passed: 3 }
    const matrix = new Map<string, Map<string, string>>()

    for (const row of testRows ?? []) {
      if (!matrix.has(row.test_file)) matrix.set(row.test_file, new Map())
      const fileMap = matrix.get(row.test_file)!
      const current = fileMap.get(row.run_id)
      if (!current || statusRank[row.status] < statusRank[current]) {
        fileMap.set(row.run_id, row.status)
      }
    }

    const runMeta = Object.fromEntries((runRows ?? []).map(r => [r.id, r.started_at]))

    const result = [...matrix.entries()].map(([test_file, runMap]) => ({
      test_file,
      runs: runIds.map(rid => ({
        run_id: rid,
        started_at: runMeta[rid],
        status: (runMap.get(rid) ?? 'not_run') as string,
      })),
    }))

    return NextResponse.json(result)
  }

  if (type === 'journey-detail') {
    const file = searchParams.get('file')
    if (!file) return NextResponse.json({ error: 'file param required' }, { status: 400 })

    const { data: runRows, error: runError } = await supabase
      .from('test_runs')
      .select('id, started_at')
      .order('started_at', { ascending: false })
      .limit(runs ?? 10)

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })

    const runIds = (runRows ?? []).map(r => r.id)
    if (runIds.length === 0) return NextResponse.json({ runs: [], tests: [] })

    const { data: testRows, error: testError } = await supabase
      .from('test_run_tests')
      .select('run_id, test_name, status, duration_ms, error_message')
      .in('run_id', runIds)
      .eq('test_file', file)

    if (testError) return NextResponse.json({ error: testError.message }, { status: 500 })

    const testNames: string[] = []
    const seen = new Set<string>()
    for (const row of testRows ?? []) {
      if (!seen.has(row.test_name)) { seen.add(row.test_name); testNames.push(row.test_name) }
    }

    const testMeta: Record<string, { durations: number[]; errors: Record<string, number> }> = {}
    for (const row of testRows ?? []) {
      if (!testMeta[row.test_name]) testMeta[row.test_name] = { durations: [], errors: {} }
      if (row.duration_ms != null) testMeta[row.test_name].durations.push(row.duration_ms)
      if (row.error_message) {
        const e = testMeta[row.test_name].errors
        e[row.error_message] = (e[row.error_message] ?? 0) + 1
      }
    }

    const statusRank: Record<string, number> = { failed: 0, flaky: 1, skipped: 2, passed: 3 }
    const matrix: Record<string, Record<string, string>> = {}
    for (const row of testRows ?? []) {
      if (!matrix[row.test_name]) matrix[row.test_name] = {}
      const cur = matrix[row.test_name][row.run_id]
      if (!cur || statusRank[row.status] < statusRank[cur]) matrix[row.test_name][row.run_id] = row.status
    }

    const runMeta = Object.fromEntries((runRows ?? []).map(r => [r.id, r.started_at]))

    const tests = testNames.map(name => {
      const meta = testMeta[name] ?? { durations: [], errors: {} }
      const sorted = [...meta.durations].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const medianMs = sorted.length === 0 ? null :
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      const topError = Object.entries(meta.errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      return {
        test_name: name,
        median_duration_ms: medianMs != null ? Math.round(medianMs) : null,
        top_error: topError,
        runs: runIds.map(rid => ({
          run_id: rid,
          started_at: runMeta[rid],
          status: matrix[name]?.[rid] ?? 'not_run',
        })),
      }
    })

    return NextResponse.json({
      runs: runIds.map(rid => ({ run_id: rid, started_at: runMeta[rid] })),
      tests,
    })
  }

  if (type === 'module-stats') {
    let runQuery = supabase
      .from('test_runs')
      .select('id, started_at')
      .order('started_at', { ascending: false })
    if (from) runQuery = runQuery.gte('started_at', from)
    else runQuery = runQuery.limit(runs ?? 500)
    const { data: runRows, error: runError } = await runQuery

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })

    const runIds = (runRows ?? []).map(r => r.id)
    if (runIds.length === 0) return NextResponse.json([])

    const { data: testRows, error: testError } = await supabase
      .from('test_run_tests')
      .select('run_id, module, status')
      .in('run_id', runIds)
      .not('module', 'is', null)
      .limit(200000)

    if (testError) return NextResponse.json({ error: testError.message }, { status: 500 })

    const moduleMap = new Map<string, Map<string, { pass: number; fail: number; flaky: number; skip: number }>>()

    for (const row of testRows ?? []) {
      if (!row.module) continue
      if (!moduleMap.has(row.module)) moduleMap.set(row.module, new Map())
      const runMap = moduleMap.get(row.module)!
      if (!runMap.has(row.run_id)) runMap.set(row.run_id, { pass: 0, fail: 0, flaky: 0, skip: 0 })
      const c = runMap.get(row.run_id)!
      if (row.status === 'passed') c.pass++
      else if (row.status === 'failed') c.fail++
      else if (row.status === 'flaky') c.flaky++
      else if (row.status === 'skipped') c.skip++
    }

    const runMeta = Object.fromEntries((runRows ?? []).map(r => [r.id, r.started_at]))

    const result = [...moduleMap.entries()].map(([module, runMap]) => {
      // runIds is newest-first; build per-run stats in that order
      const runsData = runIds
        .filter(rid => runMap.has(rid))
        .map(rid => {
          const c = runMap.get(rid)!
          const total = c.pass + c.fail + c.flaky + c.skip
          return {
            run_id: rid,
            started_at: runMeta[rid],
            pass: c.pass, fail: c.fail, flaky: c.flaky, total,
            pass_rate: total > 0 ? (c.pass / total) * 100 : 100,
          }
        })

      const lastRun = runsData[0]
      const avgPassRate = runsData.length > 0
        ? runsData.reduce((s, r) => s + r.pass_rate, 0) / runsData.length
        : 100

      return {
        module,
        avg_pass_rate: Math.round(avgPassRate * 10) / 10,
        last_pass_rate: lastRun ? Math.round(lastRun.pass_rate * 10) / 10 : null,
        last_fail: lastRun?.fail ?? 0,
        last_flaky: lastRun?.flaky ?? 0,
        runs: [...runsData].reverse(), // oldest → newest for sparkline
      }
    }).sort((a, b) => a.module.localeCompare(b.module))

    return NextResponse.json(result)
  }

  if (type === 'module-files') {
    const { data, error } = await supabase
      .from('test_run_tests')
      .select('module, test_file')
      .not('module', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const seen = new Set<string>()
    const result: { module: string; test_file: string }[] = []
    for (const row of data ?? []) {
      if (!row.module) continue
      const key = `${row.module}::${row.test_file}`
      if (!seen.has(key)) { seen.add(key); result.push({ module: row.module, test_file: row.test_file }) }
    }
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'type must be flaky | failed-tests | slowest | journey-matrix | journey-detail | module-stats | module-files' }, { status: 400 })
}
