# QA Atlas — Vibecoding Prompts

Copy-paste each prompt into Cursor when you're ready to build that step. Do them in order; each prompt assumes the previous steps exist.

---

## Step 1: Backend scaffold and graph store

**Prompt:**

```
In the qa-atlas/backend folder, create a Node.js API server for QA Atlas.

1. Initialize package.json with express, cors, and uuid. Use "type": "module".
2. Create src/index.js: Express app listening on port 4000, CORS enabled, and mount routes at /api (we'll add route files next).
3. Create src/store/graph.js that:
   - Keeps in-memory state: { productName: "My Product", modules: [] }
   - Each module: { id (uuid), name, features: [] }
   - Each feature: { id, name, moduleId, coverage: 0, testCases: [], tickets: [], bugs: [], automation: [] }
   - Load initial state from data/product.json if the file exists; if not, create data/ and write a default structure with productName and empty modules.
   - Export: load(), save(), getProduct(), getModule(id), getFeature(id), ensureModule(name), ensureFeature(moduleId, name), and addFeatureToModule(moduleId, featureObject). ensureModule creates a module if missing and returns it; ensureFeature does the same for a feature inside a module. save() writes JSON to data/product.json.
4. Add a GET /api/product route in src/routes/product.js that returns getProduct() as JSON.
5. Wire the route in index.js. Add an npm script "start": "node src/index.js".
```

```

---

## Step 2: Product tree endpoint for frontend

**Prompt:**

```
In qa-atlas/backend, add an endpoint that returns the product graph in a shape suitable for react-d3-tree.

1. In src/store/graph.js add a function getProductTree() that returns a single root node with structure:
   - name: productName
   - attributes: { type: "product" }
   - children: array of module nodes. Each module node has name, attributes: { type: "module" }, and children: array of feature nodes. Each feature node has name, attributes: { type: "feature", coverage, bugCount }, and children: array of nodes for test cases (name = test case string, attributes: { type: "testCase" }). Optionally add ticket and bug nodes as children too.
2. Add GET /api/product/tree in src/routes/product.js that returns getProductTree() as JSON.
3. Ensure the tree is a single object (the root), not an array, so react-d3-tree can consume it.
```

---

## Step 3: Write endpoints (module, feature, testcase, ticket, bug, coverage)

**Prompt:**

```
In qa-atlas/backend, add all mutation endpoints that the AI agent will call.

Create src/routes/mutations.js and implement:

1. POST /api/module — body: { name }. Use ensureModule(name), then save(). Return { module } with the module object.
2. POST /api/feature — body: { module (name or id), name }. Resolve module by name or id, then ensureFeature(module.id, name), save(), return { feature }.
3. POST /api/testcase — body: { module, feature, testCase: string, automated?: boolean }. Find feature by module + feature name; push { id: uuid(), name: testCase, automated: !!automated } to feature.testCases; if automated, push to feature.automation. save(). Return { feature }.
4. POST /api/ticket — body: { module, feature, ticket: string }. Find feature; push ticket to feature.tickets (as string or { key: ticket }). save(). Return { feature }.
5. POST /api/bug — body: { module, feature, bug: string }. Find feature; push bug to feature.bugs. save(). Return { feature }.
6. POST /api/coverage — body: { module, feature, coverage: number }. Find feature; set feature.coverage = clamp(0, 100, coverage). save(). Return { feature }.

Wire these routes in src/index.js under /api. Use express.json(). Validate required fields and return 400 with a message if missing. Ensure graph store's ensureFeature and module resolution work by name (string) or id.
```

---

## Step 4: Persist on every mutation

**Prompt:**

```
In qa-atlas/backend, ensure the graph is persisted to data/product.json after every mutation. In src/store/graph.js, make sure save() is called from the mutation handlers (already done in routes). Add a check: if data/ folder doesn't exist, create it before writing the file (use fs.mkdirSync with { recursive: true }).
```

---

## Step 5: React frontend scaffold and API client

**Prompt:**

```
In qa-atlas/frontend, create a Vite + React app.

1. Create frontend with npm create vite@latest . -- --template react (in qa-atlas/frontend). Use React, not React+TS if the template asks.
2. Add an API client src/api/atlas.js with two functions: getProduct() and getProductTree(). They should fetch from http://localhost:4000/api/product and http://localhost:4000/api/product/tree. Return the JSON. Handle errors with a simple throw or return null.
3. In App.jsx, add a layout: a header with title "QA Atlas", and a main area with two placeholders—one div "Map placeholder" and one div "Feature panel placeholder". On mount, call getProduct() and getProductTree(), store both in useState, and show a short message like "Product: {productName}" and "Tree loaded: yes/no" so we know the API is connected. Use useEffect for the fetch.
4. In vite.config.js, add proxy: { '/api': 'http://localhost:4000' } so we can use fetch('/api/product') and fetch('/api/product/tree') from the client without CORS issues. Update atlas.js to use relative URLs /api/product and /api/product/tree.
```

---

## Step 6: Interactive map with react-d3-tree

**Prompt:**

```
In qa-atlas/frontend, add the interactive product map using react-d3-tree.

1. Install react-d3-tree. Create src/components/ProductMap.jsx that accepts treeData (the root node object from getProductTree()) and onNodeClick(nodeData) callback.
2. Render Tree from react-d3-tree with treeData, orientation="vertical", pathFunc="step", and onNodeClick that calls onNodeClick with the node's data. Enable zoom and pan (default). Give the container a fixed height (e.g. 600px) and width 100%.
3. In App.jsx, replace the map placeholder with ProductMap. Pass treeData from state (product tree) and onNodeClick that sets a "selectedNode" state (store the node's data so we know if it's a feature).
4. If treeData is null or undefined, show "Load product tree" or a loading state. If the tree is empty (no children), show "No modules yet".
```

---

## Step 7: Feature panel

**Prompt:**

```
In qa-atlas/frontend, add the Feature Panel that shows when a feature node is clicked.

1. Create src/components/FeaturePanel.jsx. It receives props: feature (object or null), product (full product graph from getProduct()). If feature is null, render nothing or "Select a feature".
2. When feature is set, display: feature name (from node name or feature.name), coverage % (from feature.attributes.coverage or feature.coverage), list of test cases (from feature.testCases or node children of type testCase), linked tickets, bugs, and automation list. Use the product graph to get the full feature by matching feature name and module so we have testCases, tickets, bugs, automation arrays.
3. In App.jsx, when the user clicks a node, check if the node has attributes.type === 'feature'. If yes, find the corresponding feature in the product graph (by walking modules and features) and set selectedFeature state. Render FeaturePanel in the "Feature panel placeholder" area with feature={selectedFeature} product={product}.
4. Style the panel: a card or sidebar with sections "Coverage", "Test Cases", "Tickets", "Bugs", "Automation". Use simple CSS or a minimal library.
```

---

## Step 8: Coverage and bug coloring on the map

**Prompt:**

```
In qa-atlas/frontend, add coverage-based and bug-based styling to the tree nodes.

1. In ProductMap, use the customNodeElement prop of react-d3-tree (or equivalent) to render nodes with custom styling. If the node has attributes.coverage, color the node: green for 80–100, yellow for 40–80, red for <40. If attributes.bugCount is present and high (e.g. >5), add a red border or a small "bug" badge.
2. Ensure the backend getProductTree() includes coverage and bugCount in each feature node's attributes. If not, add that in backend src/store/graph.js getProductTree().
3. Use a consistent color palette (e.g. green #22c55e, yellow #eab308, red #ef4444) and apply to node rectangle or circle. Leaf nodes (test case, ticket) can stay neutral.
```

---

## Step 9: Mock data for demo

**Prompt:**

```
Add mock data so QA Atlas works out of the box without external systems.

1. In qa-atlas/backend/data/, create or replace product.json with a seed structure: productName "My App", modules: "Authentication" (features: Login, Register), "Booking" (features: Create Booking, Cancel Booking), "Event Forms" (features: Submit Form). For "Submit Form" add test cases TC-01 Valid submission, TC-02 Empty fields, TC-03 Duplicate submission; ticket JIRA-421; coverage 66; and 1–2 bugs. For "Payments" module add a feature with 0% coverage and 12 bugs so we can see red/bug heatmap. For Authentication set coverage 90+ so it's green.
2. Ensure the backend loads this file on startup. If data/product.json already exists from previous runs, you can keep it; otherwise document in README that running "node src/seed.js" or placing the mock JSON as data/product.json will seed the app. Alternatively, in graph.js load(), if modules length is 0, call a seed() that fills the default structure above then save().
3. Optionally add a GET /api/seed or a separate script that overwrites product.json with this mock data so the user can reset to demo state.
```

---

## Step 10: Polish and navigation

**Prompt:**

```
Polish QA Atlas for a minimal viable demo.

1. Add a "Refresh" button in the header that re-fetches getProduct() and getProductTree() and updates state.
2. Ensure the map supports zoom and pan (react-d3-tree default). Add a short instruction in the UI: "Click a feature to see details."
3. In the Feature Panel, if the feature has no test cases or tickets, show "No test cases" or "No tickets" instead of an empty list.
4. Add minimal global styles: clean font, spacing, and a distinct style for the selected feature in the tree if possible (e.g. highlight the node when it's selected).
```

---

## Optional: MCP server for Cursor

**Prompt:**

```
Create a small MCP server that exposes QA Atlas write operations as tools so the Cursor agent can call them.

1. In qa-atlas/mcp-server/ (or backend/mcp/), init package.json with @modelcontextprotocol/sdk and zod. Create a server that uses StdioServerTransport.
2. Register tools: create_module({ name }), add_feature({ module, name }), add_testcase({ module, feature, testCase, automated }), link_ticket({ module, feature, ticket }), add_bug({ module, feature, bug }), update_coverage({ module, feature, coverage }). Each tool should POST to http://localhost:4000/api/... (module, feature, testcase, ticket, bug, coverage) and return the API response or a success message.
3. Document in README how to add this MCP server to Cursor (e.g. in Cursor settings or claude_desktop_config.json) so the AI can update the QA map when generating test plans from Jira.
```

---

## Quick reference: endpoint payloads

| Endpoint | Method | Body |
|----------|--------|------|
| Product | GET | — |
| Tree | GET | — |
| Module | POST | `{ "name": "Event Forms" }` |
| Feature | POST | `{ "module": "Event Forms", "name": "Submit Form" }` |
| Test case | POST | `{ "module": "Event Forms", "feature": "Submit Form", "testCase": "TC-03 Duplicate submission", "automated": true }` |
| Ticket | POST | `{ "module": "Event Forms", "feature": "Submit Form", "ticket": "JIRA-421" }` |
| Bug | POST | `{ "module": "Event Forms", "feature": "Submit Form", "bug": "BUG-101" }` |
| Coverage | POST | `{ "module": "Event Forms", "feature": "Submit Form", "coverage": 66 }` |

Use these prompts in order; each step builds on the previous. After Step 10 you have a working QA Atlas MVP. Use the optional MCP step when you want Cursor to drive updates via MCP tools.
