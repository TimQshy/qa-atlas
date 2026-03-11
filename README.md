# QA Atlas

Interactive AI-driven product map: visualize product structure and QA coverage, linked to test cases, Jira tickets, and bugs. Updates when an AI agent calls the backend API.

## Docs

- **ROADMAP.md** — Architecture, data model, phases, and file structure.
- **VIBECODING_PROMPTS.md** — Copy-paste prompts for building each step with Cursor (vibecoding).

## Quick start (after building)

1. **Backend:** `cd backend && npm install && npm start` (port 4000).
2. **Frontend:** `cd frontend && npm install && npm run dev`.
3. Open the app; use the prompts in order to build from Step 1.

## Stack

- **Frontend:** React, Vite, react-d3-tree.
- **Backend:** Node.js, Express, JSON file storage.
- **AI:** REST API (optional MCP server for Cursor).

Build step-by-step using **VIBECODING_PROMPTS.md**.
