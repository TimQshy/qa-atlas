---
name: start-qa-atlas
description: Launches the QA Atlas application (backend + frontend). Use when the user says /startQAtlas, "start QA Atlas", "launch QA Atlas", or asks to run the QA Atlas app.
---

# Start QA Atlas

## Instructions

When the user requests to start QA Atlas (e.g. `/startQAtlas`):

1. **Start both backend and frontend** (from project root):
   ```bash
   npm install && npm start
   ```
   Run in a background terminal. This runs backend (port 4000) and frontend (port 5173) concurrently.

2. **Tell the user** to open http://localhost:5173 in the browser.

**Alternative** (separate terminals):
- Backend: `cd backend && npm start`
- Frontend: `cd frontend && npm start`

## Project layout

- `backend/` — Express API (port 4000)
- `frontend/` — React + Vite (port 5173)

## Notes

- If backend or frontend is already running (EADDRINUSE), inform the user and skip that step.
- Backend loads data from `backend/data/folders.json`, `releases.json`.
