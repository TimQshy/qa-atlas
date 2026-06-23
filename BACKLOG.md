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

### ~~2. Run type separation in Recent Runs + chart~~ ✓
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

---

### ~~5. Test failure timeline — drill into a specific failing test~~ ✓

**What:** В виджете "Most Failed Tests" сделать каждую строку кликабельной. По клику открывается детальный вид (панель или отдельная вкладка) с временной шкалой: когда именно этот тест падал за последние N дней. По каждой точке видно: дата/время рана, статус (failed / flaky / passed), тест-сет (smoke / regression / sms-email), ссылка на репорт.

**Why:** Сейчас видно только "этот тест упал 44 раза за 30 дней", но непонятно — он падает каждый день подряд или только в определённых ранах? Хочется видеть паттерн.

**UX вариант (рекомендуемый):** Клик по строке открывает панель справа или модал. Внутри — мини-чарт (как Pass Rate Trend, но для одного теста): ось X — время, ось Y — статус (failed=красный, flaky=жёлтый, passed=зелёный, did not run=серый). Плюс таблица ранов ниже чарта.

**Steps:**
- Добавить API `GET /api/test-failure-timeline?testName=<name>&days=30` — возвращает список ранов, в каждом: `run_id`, `run_at`, `status`, `run_type`, `report_url`
- Запрос к `test_run_tests` JOIN `test_runs` WHERE `test_run_tests.name = $1 AND run_at >= now() - interval '$2 days'`
- Компонент `TestFailureTimeline` — SVG-чарт по аналогии с `PassRateChart`, одна линия, цветные точки по статусу
- Таблица под чартом: дата · тест-сет · статус-бадж · ссылка
- Открывать через `onClick` на строке `MostFailedTests`, закрывать по Esc / клику снаружи

---

### ~~6. Module Health — показывать только текущее состояние + drill-in~~ ✓

**What:** Переделать виджет Module Health так, чтобы каждая карточка показывала состояние **только последнего рана**, а не агрегат за 30 дней. Маленькие цветные боксы (история ранов) убрать с карточки — они будут доступны только внутри детального вида. Клик по карточке открывает модал/панель с деталями модуля.

**Why:** Текущий вид смешивает "сколько ранов было" и "как дела сейчас". Пользователю важно в первую очередь: работает ли модуль прямо сейчас. История — вторичное.

**UX:**
- Карточка: название модуля · процент прохождения последнего рана · статус-лейбл (`clean` / `degraded` / `failing`) · время последнего рана
- Клик → модал с историей: список тестов модуля × последние N ранов (те самые цветные боксы), аналогично Journey Matrix detail

**Steps:**
- API: `GET /api/module-detail?module=<name>&runs=10` — тесты модуля × последние N ранов (JOIN `test_run_tests` + `test_runs`)
- Изменить `ModuleHealthGrid` — убрать run-боксы с карточки, добавить `onClick`
- Новый компонент `ModuleDetailPanel` — матрица тест × ран (как в `JourneyMatrixPanel`), закрывается по Esc / клику снаружи

---

### ~~7. Journey Health Matrix — только последний ран + drill-in по джорни~~ ✓

**What:** Переделать Journey Health Matrix (список джорней с маленькими боксами ранов) по той же логике: по умолчанию показывать **текущее состояние** (один статус из последнего рана), без мини-боксов. Клик по джорни открывает детальную панель — матрицу тест × ран с цветными боксами (как на Image 4: `auth.journey.spec.ts` → таблица тестов по колонкам-ранам).

**Why:** Мини-боксы на каждой строке перегружают таблицу. Детали нужны по требованию, а не всегда.

**UX:**
- Строка джорни: имя файла · статус последнего рана (цветной бадж) · дата последнего рана
- Клик → открывается панель (уже существует `JourneyMatrixPanel`?) с матрицей тест × N ранов + тултипы на боксах (дата, статус, длительность)
- Если `JourneyMatrixPanel` уже существует — переиспользовать, просто подключить к клику из списка

**Steps:**
- Убрать run-strip из строк Journey Matrix, заменить на статус-бадж последнего рана
- Добавить `onClick` на строку → открывает `JourneyDetailPanel` (или существующий модал)
- Внутри панели: полоска последних ранов сверху + матрица тест × ран как на Image 4
- Убедиться что API `journey-detail` возвращает достаточно данных (тесты × раны с датами и статусами)

---

### ~~8. Глобальные фильтры — модуль + джорни рядом с временным фильтром~~ ✓

**What:** В хедере дашборда рядом с кнопками времени (Today / 7d / 14d / 30d / All) добавить два дропдауна:
1. **Module** — список всех модулей (сейчас 13: activity-log, admin, analytics, …). Выбор модуля фильтрует весь дашборд: показывает только раны/тесты этого модуля.
2. **Journey** — список всех джорни-файлов. Выбор джорни фильтрует весь дашборд под конкретный journey spec.

По умолчанию оба = "All" (никакого фильтра). Фильтры независимые и комбинируются с временным.

**Why:** Сейчас дашборд всегда показывает всё. Если хочу понять "как дела у модуля contacts за 7 дней" — нет способа это увидеть без ручной фильтрации.

**Виджеты, которые должны реагировать на фильтр:**
- Last Run / Last Run Counts — показывать последний ран где есть тесты из выбранного модуля/джорни
- Avg Pass Rate — считать только по тестам модуля/джорни
- Flaky count — только тесты модуля/джорни
- Pass Rate Trend — точки только по ранам где участвовал модуль/джорни
- Most Failed Tests — только тесты модуля/джорни
- Module Health — при выборе модуля выделять/фокусировать его карточку
- Journey Matrix — при выборе джорни показывать только её строку

**Steps:**
- Добавить `moduleFilter: string | null` и `journeyFilter: string | null` в глобальный state дашборда (рядом с `preset`)
- Компонент `FilterBar` — рядом с time-preset кнопками добавить два `<select>` или кастомных дропдауна
- Для Module: список тянуть из уже существующего API `module-stats` (возвращает список модулей)
- Для Journey: список тянуть из `journey-matrix` API (возвращает список journey files)
- Пробросить фильтры как query-параметры (`?module=contacts&journey=auth.journey.spec.ts`) во все fetch-вызовы дашборда
- Обновить API-эндпоинты чтобы принимали и применяли эти параметры в запросах к БД


## Done

### ~~1. Run type separation in Recent Runs + chart~~ ✓
`migration_v10.sql` adds `run_type text` column. API accepts `runType` in POST, stores as `run_type`. Dashboard shows colour-coded badge (smoke=cyan, regression=purple, sms-email=orange) in Recent Runs table. Chart dot tooltips show run type + pass/fail/flaky/skip counts on hover.
