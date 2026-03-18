import { getDb } from '../db/database.js';
import { v4 as uuid } from 'uuid';

function rowToSprint(row) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    goal: row.goal ?? '',
    releaseId: row.release_id,
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

export function getSprints() {
  const db = getDb();
  return db.prepare('SELECT * FROM sprints').all().map(rowToSprint);
}

export function getSprint(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  return row ? rowToSprint(row) : null;
}

export function getChildSprints(parentId = null) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sprints WHERE (parent_id IS NULL AND ? IS NULL) OR parent_id = ?').all(parentId, parentId);
  return rows.map(rowToSprint);
}

export function getDescendantSprintIds(rootId) {
  if (!rootId) return [];
  const out = [];
  const queue = [rootId];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    for (const child of getChildSprints(current)) {
      queue.push(child.id);
    }
  }
  return out;
}

export function getSprintsByReleaseIds(releaseIds = []) {
  const set = new Set(releaseIds);
  return getSprints().filter((s) => s.releaseId && set.has(s.releaseId));
}

export function createSprint({ name, startDate, endDate, goal = '', releaseId = null, parentId = null, affectedFolderIds = [], affectedItemIds = [], tags = [] }) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO sprints (id, name, start_date, end_date, goal, release_id, parent_id, affected_folder_ids, affected_item_ids, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (name ?? '').trim(),
    startDate || new Date().toISOString().slice(0, 10),
    endDate || null,
    (goal ?? '').trim(),
    releaseId || null,
    parentId || null,
    JSON.stringify(Array.isArray(affectedFolderIds) ? affectedFolderIds : []),
    JSON.stringify(Array.isArray(affectedItemIds) ? affectedItemIds : []),
    JSON.stringify(Array.isArray(tags) ? tags : [])
  );
  return getSprint(id);
}

export function updateSprint(id, patch) {
  const sprint = getSprint(id);
  if (!sprint) return null;
  const db = getDb();
  const name = patch.name !== undefined ? String(patch.name).trim() : sprint.name;
  const startDate = patch.startDate !== undefined ? patch.startDate : sprint.startDate;
  const endDate = patch.endDate !== undefined ? patch.endDate : sprint.endDate;
  const goal = patch.goal !== undefined ? String(patch.goal) : sprint.goal;
  const releaseId = patch.releaseId !== undefined ? (patch.releaseId || null) : sprint.releaseId;
  const parentId = patch.parentId !== undefined ? (patch.parentId || null) : sprint.parentId;
  const affectedFolderIds = patch.affectedFolderIds !== undefined ? (Array.isArray(patch.affectedFolderIds) ? patch.affectedFolderIds : sprint.affectedFolderIds) : sprint.affectedFolderIds;
  const affectedItemIds = patch.affectedItemIds !== undefined ? (Array.isArray(patch.affectedItemIds) ? patch.affectedItemIds : sprint.affectedItemIds) : sprint.affectedItemIds;
  const tags = patch.tags !== undefined ? (Array.isArray(patch.tags) ? patch.tags : sprint.tags) : sprint.tags;
  db.prepare(
    'UPDATE sprints SET name = ?, start_date = ?, end_date = ?, goal = ?, release_id = ?, parent_id = ?, affected_folder_ids = ?, affected_item_ids = ?, tags = ? WHERE id = ?'
  ).run(name, startDate, endDate, goal, releaseId, parentId, JSON.stringify(affectedFolderIds), JSON.stringify(affectedItemIds), JSON.stringify(tags), id);
  return getSprint(id);
}
