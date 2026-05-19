# Dashboard Improvement Plan — Per-Test Granularity

## Goal

Show per-journey and per-API-test health in the dashboard: which tests are flaky, which fail, which pass, with mini-reports per journey. Currently the `test_runs` table only stores aggregate counts + `hard_fail_tests: string[]`, which makes journey-level breakdowns impossible.

---

## Phase 1 — Schema + API

### 1. New table `test_run_tests`

One row per test per run.

```sql
CREATE TABLE test_run_tests (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id      text NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_file   text NOT NULL,   -- e.g. "journeys/student-enrollment.journey.spec.ts"
  test_suite  text,            -- e.g. "Student Enrollment Journey"
  test_name   text NOT NULL,   -- e.g. "create student via UI with existing contact"
  status      text NOT NULL,   -- 'passed' | 'failed' | 'flaky' | 'skipped'
  duration_ms int,
  retry_count int DEFAULT 0,
  error_message text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON test_run_tests (run_id);
CREATE INDEX ON test_run_tests (test_file, status);
```

RLS: same as `test_runs` — service_role full access, authenticated read-only.

### 2. Update `POST /api/test-runs`

Accept optional `tests` array alongside existing aggregate fields:

```typescript
interface TestRunPayload {
  // existing fields unchanged
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

  // new
  tests?: {
    testFile: string
    testSuite?: string
    testName: string
    status: 'passed' | 'failed' | 'flaky' | 'skipped'
    durationMs?: number
    retryCount?: number
    errorMessage?: string
  }[]
}
```

After inserting the run row, bulk-insert `tests[]` into `test_run_tests`.

### 3. Update `GET /api/test-runs`

Add optional `?include=tests` param — when present, join `test_run_tests` rows into each run object.

### 4. New endpoint `GET /api/test-runs/[id]/tests`

Returns all `test_run_tests` rows for a single run. Used by per-journey detail view.

### 5. New endpoint `GET /api/test-stats`

Aggregate query for dashboard widgets:

- `?type=flaky&days=30` → top flaky tests ranked by retry/flaky count
- `?type=slowest` → top 10 by median duration_ms
- `?type=journey-matrix&runs=10` → last N run statuses per test_file (for heatmap)

### 6. Update TypeScript types in `src/types/index.ts`

Add `TestRunTest` interface and updated `TestRun` with optional `tests` field.

---

## Phase 2 — CI Integration (Cloud Build)

Playwright already outputs JSON in CI via `--reporter=json` (or JUnit XML via `--reporter=junit`). The JSON report (`test-results.json`) contains full per-test data: suite, title, file, status, duration, errors, retry count.

### Steps

1. In the Cloud Build step that currently sends the webhook, also:
   - Read `test-results/test-results.json` (Playwright JSON reporter output)
   - Parse each `suite.specs[]` → extract `file`, `title`, `ok`, `tests[].results[].status`, `tests[].results[].duration`, retry count
2. Map Playwright statuses to our schema:
   - `expected` → `passed`
   - `unexpected` → `failed`
   - `flaky` → `flaky` (test has both passed and failed results across retries)
   - `skipped` → `skipped`
3. Include `tests[]` array in the webhook POST body

**Playwright JSON shape (relevant fields):**
```json
{
  "suites": [{
    "title": "journeys",
    "suites": [{
      "title": "student-enrollment.journey.spec.ts",
      "file": "journeys/student-enrollment.journey.spec.ts",
      "suites": [{
        "title": "Student Enrollment Journey",
        "specs": [{
          "title": "create student via UI with existing contact",
          "ok": true,
          "tests": [{
            "status": "expected",
            "results": [{ "status": "passed", "duration": 12400, "retry": 0 }]
          }]
        }]
      }]
    }]
  }]
}
```

---

## Phase 3 — Dashboard UI

### New sections to add to `/dashboard`

#### A. Journey Health Matrix (UI Journeys)

Grid: rows = journey files (`journeys/*.spec.ts`), columns = last 10 runs.

Each cell shows status for that test file in that run:
- Green = all tests passed
- Red = at least one failed
- Yellow = flaky (passed after retry)
- Gray = skipped / not run

Click on a row → opens Per-Journey Detail panel.

#### B. API Test Matrix

Same grid layout but for `api/*.spec.ts` (15 API test files).

Separate section below UI Journeys, same column alignment (same run IDs).

#### C. Flaky Leaderboard (30 days)

Ranked list of tests with the most flaky/retry incidents.

Columns: Test name | Journey file | Flaky count | Last seen flaky

#### D. Per-Journey Detail (slide-in panel or modal)

Click any row in the matrix → shows:
- Last 10 run statuses for this file
- Individual test names within the file and their per-run status
- Average duration
- Most common error message

#### E. Slowest Tests

Top 10 tests by median `duration_ms`. Useful for spotting tests that need optimization.

---

## Implementation Order

```
Phase 1 (schema + API) → Phase 2 (CI) → Phase 3 (UI)
```

Phase 3 can be partially built with mock/empty data while Phase 2 is pending, but the matrix will only populate once CI starts sending `tests[]`.

---

## Files to Touch

| Phase | File |
|-------|------|
| 1 | `supabase/migration_v7.sql` (new table) |
| 1 | `src/app/api/test-runs/route.ts` (accept + insert tests) |
| 1 | `src/app/api/test-runs/[id]/tests/route.ts` (new) |
| 1 | `src/app/api/test-stats/route.ts` (new) |
| 1 | `src/types/index.ts` (new types) |
| 2 | Cloud Build YAML / shell script (parse JSON + send tests[]) |
| 3 | `src/app/dashboard/page.tsx` (new sections) |
| 3 | `src/components/JourneyMatrix.tsx` (new component) |
| 3 | `src/components/FlakyLeaderboard.tsx` (new component) |
| 3 | `src/components/JourneyDetail.tsx` (new component) |
