# QA Atlas Dashboard — Backlog

Tasks ordered by priority. Pick one, ship it, delete it from the list.

---

## Open

### 1. Per-journey run status strip (passed / flaky / skipped / not_run)
**What:** В боковом списке джорни (или на странице каждого джорни) показать последние N ранов в виде цветных точек/клеток: зелёный = passed, жёлтый = flaky, серый = skipped, тёмный = not_run.

**Why:** Journey Matrix на дашборде уже делает это на уровне `test_file`, но если открыть конкретный джорни — там нет быстрого "полосы здоровья" по последним ранам.

**Steps:**
- Переиспользовать существующий `journey-detail` API (уже возвращает `runs` с `status` по каждому тесту)
- Агрегировать статусы по рану (worst status wins: failed > flaky > skipped > passed)
- Отрендерить горизонтальную полосу из 10 последних ранов аналогично ячейкам в `JourneyMatrix`
- Цвета: `var(--green)` passed · `var(--yellow)` flaky · `var(--text-faint)` skipped · `var(--bg-3)` not_run

---

### 2. Run type separation in Recent Runs + chart
**What:** Each CI run has a type: `smoke`, `regression`, `sms-email`. Show it in the Recent Runs table and as a tooltip on the Pass Rate Trend chart.

**Why:** Right now all runs look identical. Hard to tell a 13-test smoke from a 950-test regression at a glance.

**How the CI sends it:** `notify-qa-atlas` step in Cloud Build can pass `_TRIGGER_SOURCE` (values: `post-deploy`, `regression cron`, `sms-email cron`) as a new `runType` field in the POST body.

**Steps:**
- `migration_v10.sql` — `alter table test_runs add column if not exists run_type text;`
- `POST /api/test-runs` — accept optional `runType` field, store it
- Recent Runs table — add a small badge/chip: `smoke` (cyan), `regression` (purple), `sms-email` (orange)
- Pass Rate Trend chart — show run type in the dot's `<title>` tooltip (cheapest option); or use dot shape (circle/diamond/square)

---

### ~~2. Module Health Grid — make it show data~~ ✓
**What:** The `ModuleHealthGrid` component exists on the dashboard but shows "No module data yet" because no tests carry a `module` field.

**Why:** Per README, each test file maps to one module tag. The grid is the best per-module health view but it's invisible.

**Steps:**
- Confirm `migration_v9.sql` has been applied in Supabase (adds `module` column to `test_run_tests`)
- Update `notify-qa-atlas` step (or the reporting script) to include `module` per test when POSTing to `/api/test-runs`
- The module values should map to CI test file paths or explicit module names (e.g. `contacts`, `auth`, `events`)
- Verify the grid populates after a run with module data

---

### ~~3. Clickable dots on Pass Rate Trend chart~~ ✓
**What:** Clicking a dot on the Pass Rate Trend chart opens a small popup/tooltip with that run's details: pass / fail / flaky / skipped counts, build ID, duration, and a link to the report.

**Why:** Currently dots are decorative. Users can't drill into a specific run from the chart without scrolling to the Recent Runs table.

**Steps:**
- Add `onClick` to each `<circle>` in `PassRateChart`
- Track `hoveredRun: TestRun | null` in state
- Render a small floating card near the clicked dot (absolute-positioned relative to the SVG container)
- Card shows: status badge, build ID, pass/fail/flaky/skipped, duration, report link if available
- Click elsewhere or press Esc to dismiss

---

### ~~4. Time filter applies to ALL dashboard widgets~~ ✓
**What:** The Today / 7d / 14d / 30d / All preset filter currently only affects the Recent Runs list. Journey Health Matrix, Flaky Leaderboard, Module Health, and Most Failed Tests are hardcoded (30 runs / 30 days).

**Why:** Selecting "Today" should give a consistent view across the whole dashboard, not just the top table.

**Steps:**
- Pass `preset` (or derived `from` date) to the fetch calls for:
  - `journey-matrix` — use `?from=` param (add it to the API) instead of fixed `?runs=30`
  - `module-stats` — same
  - `flaky` — already supports `?days=`, map preset to days
  - `topFailingTests()` — computed from `runs` array which is already filtered ✓
- Update `GET /api/test-stats` to accept `from` / `to` date params for `journey-matrix` and `module-stats` types (currently only `runs=N` integer)

---

## Done

### ~~1. Run type separation in Recent Runs + chart~~ ✓
`migration_v10.sql` adds `run_type text` column. API accepts `runType` in POST, stores as `run_type`. Dashboard shows colour-coded badge (smoke=cyan, regression=purple, sms-email=orange) in Recent Runs table. Chart dot tooltips show run type + pass/fail/flaky/skip counts on hover.
