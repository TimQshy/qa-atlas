# QA Atlas

Interactive QA test repository: folder tree with test cases, release-based highlighting, and description panel. Updates when an AI agent (Cursor skill) calls the backend API.

## Quick start

**Одной командой (рекомендуется):**
```bash
npm install && npm start
```
Запускает backend (4000) и frontend (5173) одновременно.

**Или по отдельности:**
1. **Backend:** `cd backend && npm start` (port 4000).
2. **Frontend:** `cd frontend && npm start` (port 5173).
3. Open http://localhost:5173 in your browser.

**Seed data:** On first launch, JSON data is migrated to SQLite (`backend/data/qa-atlas.db`). Source data comes from Enquiry Tracker (eq-monorepo) regression test plan — see [docs/DATA_SOURCE.md](docs/DATA_SOURCE.md).

## Features

- **Folder tree** — Collapsible folders (Basic, Event, Enquiries, etc.) with nested items.
- **Description panel** — Click a folder or item to see details, tags, tickets, bugs.
- **Release highlighting** — Select a release to mark affected folders and items in red.
- **Cursor skill** — API for creating/updating releases; see [docs/CURSOR_SKILL_RELEASES.md](docs/CURSOR_SKILL_RELEASES.md).

## Stack

- **Frontend:** React, Vite.
- **Backend:** Node.js, Express, SQLite (`better-sqlite3`).
- **AI:** REST API for releases (Cursor skill integration).

## Docs

- **ROADMAP.md** — Architecture, data model, phases.
- **docs/MVP_ROADMAP_BEGINNER.md** — Full beginner-friendly end-to-end MVP roadmap.
- **docs/CURSOR_SKILL_RELEASES.md** — How to add/update releases from a Cursor skill.
