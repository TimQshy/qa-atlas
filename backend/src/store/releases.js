import { getDb } from '../db/database.js';
import { v4 as uuid } from 'uuid';
import { cloneReleaseScopedData } from './folders.js';

function rowToRelease(row) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    parentId: row.parent_id,
    affectedFolderIds: JSON.parse(row.affected_folder_ids || '[]'),
    affectedItemIds: JSON.parse(row.affected_item_ids || '[]'),
    tags: JSON.parse(row.tags || '[]')
  };
}

export function load() {
  // No-op: SQLite loads on init
}

export function save() {
  // No-op: SQLite persists on each write
}

export function getReleases() {
  const db = getDb();
  return db.prepare('SELECT * FROM releases').all().map(rowToRelease);
}

export function getRelease(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(id);
  return row ? rowToRelease(row) : null;
}

export function getChildReleases(parentId = null) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM releases WHERE (parent_id IS NULL AND ? IS NULL) OR parent_id = ?').all(parentId, parentId);
  return rows.map(rowToRelease);
}

export function getDescendantReleaseIds(rootId) {
  if (!rootId) return [];
  const out = [];
  const queue = [rootId];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    for (const child of getChildReleases(current)) {
      queue.push(child.id);
    }
  }
  return out;
}

export function createRelease({ name, date, parentId = null, affectedFolderIds = [], affectedItemIds = [], tags = [] }) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO releases (id, name, date, parent_id, affected_folder_ids, affected_item_ids, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (name ?? '').trim(),
    date || new Date().toISOString().slice(0, 10),
    parentId || null,
    JSON.stringify(Array.isArray(affectedFolderIds) ? affectedFolderIds : []),
    JSON.stringify(Array.isArray(affectedItemIds) ? affectedItemIds : []),
    JSON.stringify(Array.isArray(tags) ? tags : [])
  );
  return getRelease(id);
}

export function createReleaseFrom(sourceId, patch = {}) {
  const source = getRelease(sourceId);
  if (!source) return null;
  const release = createRelease({
    name: patch.name ?? `${source.name} (copy)`,
    date: patch.date ?? source.date,
    parentId: patch.parentId !== undefined ? patch.parentId : source.parentId,
    affectedFolderIds: patch.affectedFolderIds ?? [],
    affectedItemIds: patch.affectedItemIds ?? [],
    tags: patch.tags ?? []
  });
  if (!release) return null;
  cloneReleaseScopedData(sourceId, release.id, {
    copyOnlyStableItems: patch.copyOnlyStableItems !== undefined ? Boolean(patch.copyOnlyStableItems) : true,
    copyComments: false
  });
  return release;
}

export function updateRelease(id, patch) {
  const release = getRelease(id);
  if (!release) return null;
  const db = getDb();
  const name = patch.name !== undefined ? String(patch.name).trim() : release.name;
  const date = patch.date !== undefined ? patch.date : release.date;
  const parentId = patch.parentId !== undefined ? (patch.parentId || null) : release.parentId;
  const affectedFolderIds = patch.affectedFolderIds !== undefined ? (Array.isArray(patch.affectedFolderIds) ? patch.affectedFolderIds : release.affectedFolderIds) : release.affectedFolderIds;
  const affectedItemIds = patch.affectedItemIds !== undefined ? (Array.isArray(patch.affectedItemIds) ? patch.affectedItemIds : release.affectedItemIds) : release.affectedItemIds;
  const tags = patch.tags !== undefined ? (Array.isArray(patch.tags) ? patch.tags : release.tags) : release.tags;
  db.prepare(
    'UPDATE releases SET name = ?, date = ?, parent_id = ?, affected_folder_ids = ?, affected_item_ids = ?, tags = ? WHERE id = ?'
  ).run(name, date, parentId, JSON.stringify(affectedFolderIds), JSON.stringify(affectedItemIds), JSON.stringify(tags), id);
  return getRelease(id);
}

export function deleteRelease(id) {
  const db = getDb();
  const root = getRelease(id);
  if (!root) return false;

  const releaseIds = getDescendantReleaseIds(id);

  if (releaseIds.length > 0) {
    const placeholders = releaseIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM release_folder_overrides WHERE release_id IN (${placeholders})`).run(...releaseIds);
    db.prepare(`DELETE FROM releases WHERE id IN (${placeholders})`).run(...releaseIds);
  }

  return true;
}
