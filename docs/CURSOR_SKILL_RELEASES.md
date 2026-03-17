# QA Atlas — Cursor Skill: Releases API

This document describes how a Cursor skill can add and update releases in QA Atlas via the backend API.

## Base URL

- Local: `http://localhost:4000/api`
- Ensure the QA Atlas backend is running: `cd backend && node src/index.js`

## Endpoints

### Create Release

```http
POST /api/releases
Content-Type: application/json

{
  "name": "v1.2.0 - Event Module",
  "date": "2025-03-15",
  "affectedFolderIds": ["folder-event", "folder-event-add"],
  "affectedItemIds": ["item-te9", "item-te10"],
  "tags": ["EVENT"]
}
```

**Response:** The created release object with `id`.

### Update Release

```http
PUT /api/releases/:id
Content-Type: application/json

{
  "name": "v1.2.1 - Event fixes",
  "date": "2025-03-16",
  "affectedFolderIds": ["folder-event"],
  "affectedItemIds": ["item-te11"],
  "tags": ["EVENT", "BUGFIX"]
}
```

### List Releases

```http
GET /api/releases
```

**Response:** `{ "releases": [...] }`

### Get Folders and Items (for IDs)

```http
GET /api/folders
```

**Response:** `{ "folders": [...], "items": [...] }` — use `id` from these to populate `affectedFolderIds` and `affectedItemIds`.

## Skill Integration

When building a Cursor skill that updates releases:

1. **Parse context** (changelog, commits, Jira tickets) to determine affected areas.
2. **Map to folder/item IDs** — call `GET /api/folders` to get IDs, or match by name/tags.
3. **Create or update release** — `POST /api/releases` for new, `PUT /api/releases/:id` for updates.
4. **Use tags** — if release affects "Event" module, include `tags: ["EVENT"]`; folders and items with matching tags will be highlighted automatically.

## Example: fetch from skill

```javascript
// Create release
const res = await fetch('http://localhost:4000/api/releases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'v1.2.0',
    date: new Date().toISOString().slice(0, 10),
    affectedFolderIds: ['folder-event'],
    affectedItemIds: ['item-te9', 'item-te10'],
    tags: ['EVENT']
  })
});
const release = await res.json();
```

## Tag-based highlighting

Releases support `tags`. Any folder or item with a matching tag (case-insensitive) is automatically marked as affected, even if not in `affectedFolderIds`/`affectedItemIds`. Use tags when you know the area (e.g. "EVENT") but not specific IDs.
