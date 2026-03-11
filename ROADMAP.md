# QA Atlas — Real Working Roadmap

**Interactive AI-Driven Product Map | Living QA Knowledge Base**

---

## Research Summary (Tech Choices)

| Area | Choice | Rationale |
|------|--------|-----------|
| **Frontend graph** | `react-d3-tree` (v3.6.x) | React-friendly, hierarchy with `name`/`children`, zoom/pan, custom nodes. D3 does layout; React does rendering. |
| **Graph storage** | JSON file + in-memory graph | Minimal deps for MVP; no DB setup. Structure: `Product → modules[] → features[]` with testCases, tickets, bugs. Easy to swap to TinyGraphDB or Postgres later. |
| **Backend** | Node.js (Express) | Simple REST API; same language as frontend; easy MCP wrapping. |
| **AI integration** | REST API first, then MCP tools | Backend exposes `POST /module`, `POST /feature`, etc. Cursor calls these via fetch or via an MCP server that wraps the same API. |

---

## Data Model (Canonical)

```
Product (root)
├── Module { id, name }
│   ├── Feature { id, name, moduleId, coverage%, testCases[], tickets[], bugs[], automation[] }
│   │   ├── TestCase { id, name, automated?: boolean }
│   │   ├── Ticket { id, key (e.g. JIRA-421) }
│   │   └── Bug { id, key or title }
```

**Tree format for react-d3-tree:** Each node has `name`, optional `attributes` (e.g. `coverage`, `type: 'feature'`), and `children` array. Transform backend graph → one root node with nested children.

**Coverage bands:** Green 80–100%, Yellow 40–80%, Red &lt;40%.  
**Bug heatmap:** Count bugs per feature; same color scale or distinct “bug count” badge.

---

## Phase Overview

| Phase | Deliverable | Deps |
|-------|-------------|------|
| **1** | Backend API server + graph storage | — |
| **2** | MCP-style REST endpoints (agent-callable) | Phase 1 |
| **3** | React app shell + API client | Phase 1 |
| **4** | Interactive map (react-d3-tree) + feature panel | Phase 3 |
| **5** | Coverage colors + bug heatmap + mock data | Phase 4 |

---

## Phase 1: Backend API Server + Graph Storage

**Goal:** Run a Node/Express server that holds the product graph in memory (backed by a JSON file) and exposes read endpoints.

**Tasks:**

1. **Scaffold**
   - `qa-atlas/backend/`: `package.json` (express, cors, uuid), `src/index.js`, `src/store/graph.js`.
   - Script: `node src/index.js` → server on port 4000.

2. **Graph store**
   - In-memory object: `{ productName, modules: [] }`.
   - Each module: `{ id, name, features: [] }`.
   - Each feature: `{ id, name, moduleId, coverage: 0, testCases: [], tickets: [], bugs: [], automation: [] }`.
   - Load/save `data/product.json` on startup and after every mutation (or debounced).
   - Helper: `getModule(id)`, `getFeature(id)`, `ensureModule(name)`, `ensureFeature(moduleId, name)`.

3. **Read API**
   - `GET /api/product` → full graph (product + modules + features with all fields).
   - `GET /api/product/tree` → same data shaped for react-d3-tree (root with `name`, `children`; leaf nodes can include coverage/bugs in `attributes`).

**Acceptance:** `GET /api/product` and `GET /api/product/tree` return 200 with JSON; restart preserves data if you write to `product.json`.

---

## Phase 2: MCP-Endpoints (Write API for AI Agent)

**Goal:** Add POST endpoints that the AI agent (or Cursor) can call to update the map.

**Tasks:**

1. **POST /api/module**
   - Body: `{ name }`. Create module if missing; return `{ module }`.

2. **POST /api/feature**
   - Body: `{ module: moduleName | moduleId, name }`. Create feature under module; return `{ feature }`.

3. **POST /api/testcase**
   - Body: `{ module, feature, testCase: string, automated?: boolean }`. Append test case to feature; optionally update automation list.

4. **POST /api/ticket**
   - Body: `{ module, feature, ticket: string }` (e.g. "JIRA-421"). Link ticket to feature.

5. **POST /api/bug**
   - Body: `{ module, feature, bug: string }`. Attach bug to feature.

6. **POST /api/coverage**
   - Body: `{ module, feature, coverage: number }`. Update feature coverage 0–100.

**Validation:** Require non-empty strings; 400 on missing module/feature. Recompute coverage from test counts if you want (e.g. coverage = (automated / total) * 100) or store explicitly.

**Acceptance:** Each POST updates in-memory state and file; `GET /api/product` reflects changes.

---

## Phase 3: React Frontend Shell + API Client

**Goal:** Vite + React app that fetches product data and is ready for the map.

**Tasks:**

1. **Scaffold**
   - `qa-atlas/frontend/`: Vite + React, `src/App.jsx`, `src/main.jsx`, proxy or env for API base URL (e.g. `http://localhost:4000`).

2. **API client**
   - `src/api/atlas.js`: `getProduct()`, `getProductTree()` calling `GET /api/product` and `GET /api/product/tree`. Export as simple async functions.

3. **App layout**
   - Top: title “QA Atlas” + optional refresh.
   - Main: placeholder for map (e.g. “Map will go here”) and a sidebar or panel placeholder for “Feature panel”.
   - On load: fetch product (or tree); store in React state; show raw JSON or a simple list for now.

**Acceptance:** Running backend + frontend shows data from API; no errors in console.

---

## Phase 4: Interactive Map + Feature Panel

**Goal:** Product map with react-d3-tree and a feature detail panel.

**Tasks:**

1. **Install**
   - `react-d3-tree` (and D3 peer if needed). Use tree in “horizontal” or “vertical” orientation.

2. **Transform**
   - Convert `GET /api/product/tree` response to react-d3-tree format: root node → children = modules → each module’s children = features → each feature’s children = test cases (and/or tickets/bugs as extra nodes or only in panel). Keep `attributes` for coverage and bug count for styling.

3. **Map component**
   - Render tree; enable zoom/pan (built-in). On node click, if node is a feature, set “selected feature” state and show Feature Panel.

4. **Feature panel**
   - Side panel or modal: feature name, coverage %, list of test cases, linked tickets, bugs, automation list. Data from selected feature in state (from product graph).

5. **Styling**
   - Nodes: different style for root / module / feature / leaf. Use `attributes.coverage` and `attributes.bugCount` for Phase 5 colors.

**Acceptance:** Map renders; clicking a feature opens panel with correct details; zoom/pan work.

---

## Phase 5: Coverage, Bug Heatmap, Mock Data

**Goal:** Color-coded coverage, bug highlighting, and seed data for demos.

**Tasks:**

1. **Coverage colors**
   - Per feature (and optionally aggregate per module): Green 80–100%, Yellow 40–80%, Red &lt;40%. Apply to node background or border in react-d3-tree (custom node component or CSS from `attributes`).

2. **Bug heatmap**
   - Features with more bugs get a distinct style (e.g. red border or badge). Option: same green/yellow/red scale by bug count (inverted: green = few bugs).

3. **Mock data**
   - Add a seed script or initial `data/product.json`: e.g. Product “My App” → modules “Authentication”, “Booking”, “Event Forms” → features “Login”, “Register”, “Submit Form”, etc., with sample test cases, tickets (JIRA-421), coverage values, and a few bugs. Ensures tree and panel have content without Jira.

4. **Optional**
   - Risk detection: e.g. “feature with low coverage and high bugs” flagged in panel or on map.

**Acceptance:** Map shows color by coverage; high-bug features stand out; mock data loads and looks correct.

---

## File Structure (Target)

```
qa-atlas/
├── ROADMAP.md                 # this file
├── VIBECODING_PROMPTS.md      # step-by-step prompts
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.js           # Express app, routes, CORS
│   │   ├── store/
│   │   │   └── graph.js       # in-memory graph + JSON load/save
│   │   └── routes/
│   │       ├── product.js     # GET /api/product, GET /api/product/tree
│   │       └── mutations.js   # POST module, feature, testcase, ticket, bug, coverage
│   └── data/
│       └── product.json       # persisted graph
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── atlas.js
        ├── components/
        │   ├── ProductMap.jsx   # react-d3-tree wrapper
        │   └── FeaturePanel.jsx
        └── styles/
            └── (or inline/CSS modules)
```

---

## MCP Integration (Cursor Agent)

**Option A — Direct HTTP:** Cursor (or any agent) calls your backend with `fetch` to `POST /api/feature`, etc., when it creates test plans from Jira. No MCP server needed.

**Option B — MCP server:** Separate small Node script using `@modelcontextprotocol/sdk`: register tools like `create_module`, `add_feature`, `add_testcase`, `link_ticket`, `add_bug`, `update_coverage`. Each tool calls your backend HTTP API. Add that MCP server to Cursor; then the agent uses “Add test case” etc. via MCP instead of raw HTTP.

Recommendation: implement **Option A** first; add **Option B** when you want Cursor to discover and call “QA Atlas” tools by name.

---

## Success Criteria (MVP)

- [ ] Backend serves product graph and tree; writes persist to JSON.
- [ ] All 6 write endpoints (module, feature, testcase, ticket, bug, coverage) work and update the graph.
- [ ] React app loads; map shows product → modules → features (and optionally test cases).
- [ ] Clicking a feature opens a panel with coverage, test cases, tickets, bugs, automation.
- [ ] Coverage colors and bug heatmap visible on the map.
- [ ] Mock data provides a realistic demo without external systems.

Use **VIBECODING_PROMPTS.md** for copy-paste prompts to build each phase step by step.
