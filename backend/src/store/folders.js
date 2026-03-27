import { getDb } from '../db/database.js';
import { v4 as uuid } from 'uuid';

function normalizeComment(comment) {
  return {
    id: comment?.id || uuid(),
    text: String(comment?.text ?? '').trim(),
    createdAt: comment?.created_at || comment?.createdAt || new Date().toISOString(),
    updatedAt: comment?.updated_at || comment?.updatedAt || null,
    scopeType: comment?.scope_type === 'release' ? comment.scope_type : (comment?.scopeType === 'release' ? comment.scopeType : null),
    scopeId: comment?.scope_id ?? comment?.scopeId ?? null
  };
}

function rowToFolder(row) {
  const comments = JSON.parse(row.comments_json || '[]');
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    releaseId: row.release_id ?? null,
    tags: JSON.parse(row.tags || '[]'),
    comments: comments.map(normalizeComment)
  };
}

function rowToItem(row) {
  const comments = JSON.parse(row.comments_json || '[]');
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    releaseId: row.release_id ?? null,
    isStable: Number(row.is_stable || 0) > 0,
    description: row.description ?? '',
    status: row.status ?? 'To Do',
    tags: JSON.parse(row.tags || '[]'),
    parentId: row.parent_id,
    tickets: JSON.parse(row.tickets || '[]'),
    bugs: JSON.parse(row.bugs || '[]'),
    comments: comments.map(normalizeComment)
  };
}

function isScopedToRelease(entityReleaseId, selectedReleaseId) {
  if (selectedReleaseId === '__ANY_RELEASE__') return true;
  if (!selectedReleaseId) return !entityReleaseId;
  return !entityReleaseId || entityReleaseId === selectedReleaseId;
}

function rowToReleaseFolderOverride(row) {
  return {
    folderId: row.folder_id,
    name: row.name,
    parentId: row.parent_id,
    tags: row.tags ? JSON.parse(row.tags) : null,
    isDeleted: Number(row.is_deleted || 0) > 0
  };
}

function applyReleaseFolderOverrides(folders, releaseId) {
  if (!releaseId) return folders;
  const db = getDb();
  const overrideRows = db
    .prepare('SELECT folder_id, name, parent_id, tags, is_deleted FROM release_folder_overrides WHERE release_id = ?')
    .all(releaseId);
  if (overrideRows.length === 0) return folders;

  const overrideMap = new Map(overrideRows.map((row) => [row.folder_id, rowToReleaseFolderOverride(row)]));
  const applied = folders.map((folder) => {
    const override = overrideMap.get(folder.id);
    if (!override) return folder;
    return {
      ...folder,
      name: override.name ?? folder.name,
      parentId: override.parentId !== undefined ? override.parentId : folder.parentId,
      tags: Array.isArray(override.tags) ? override.tags : folder.tags,
      _deletedByReleaseOverride: override.isDeleted
    };
  });

  const childrenByParent = new Map();
  for (const folder of applied) {
    const key = folder.parentId ?? '__ROOT__';
    const list = childrenByParent.get(key) ?? [];
    list.push(folder.id);
    childrenByParent.set(key, list);
  }

  const deleted = new Set(applied.filter((folder) => folder._deletedByReleaseOverride).map((folder) => folder.id));
  const queue = [...deleted];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const childId of childrenByParent.get(current) ?? []) {
      if (deleted.has(childId)) continue;
      deleted.add(childId);
      queue.push(childId);
    }
  }

  return applied
    .filter((folder) => !deleted.has(folder.id))
    .map(({ _deletedByReleaseOverride, ...folder }) => folder);
}

export function load() {
  // No-op: SQLite loads on init
}

export function save() {
  // No-op: SQLite persists on each write
}

export function getFolders(releaseId = null) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT f.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM folder_comments c WHERE c.folder_id = f.id),
      '[]'
    ) as comments_json
    FROM folders f
  `).all();
  const scopedFolders = rows.map(rowToFolder).filter((folder) => isScopedToRelease(folder.releaseId, releaseId));
  return applyReleaseFolderOverrides(scopedFolders, releaseId);
}

export function getItems(releaseId = null) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM item_comments c WHERE c.item_id = i.id),
      '[]'
    ) as comments_json
    FROM items i
  `).all();
  return rows.map(rowToItem).filter((item) => isScopedToRelease(item.releaseId, releaseId));
}

export function getFolder(id, releaseId = null) {
  return getFolders(releaseId).find((folder) => folder.id === id) ?? null;
}

function getFolderAny(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT f.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM folder_comments c WHERE c.folder_id = f.id),
      '[]'
    ) as comments_json
    FROM folders f WHERE f.id = ?
  `).get(id);
  return row ? rowToFolder(row) : null;
}

export function getItem(id, releaseId = null) {
  const db = getDb();
  const row = db.prepare(`
    SELECT i.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM item_comments c WHERE c.item_id = i.id),
      '[]'
    ) as comments_json
    FROM items i WHERE i.id = ?
  `).get(id);
  if (!row) return null;
  const item = rowToItem(row);
  if (!isScopedToRelease(item.releaseId, releaseId)) return null;
  return item;
}

function getItemAny(id) {
  return getItem(id, '__ANY_RELEASE__');
}

export function getItemsByFolder(folderId, releaseId = null) {
  if (releaseId && !getFolder(folderId, releaseId)) {
    return [];
  }
  return getItems(releaseId).filter((item) => item.folderId === folderId);
}

export function getChildFolders(parentId, releaseId = null) {
  return getFolders(releaseId).filter((folder) => (folder.parentId ?? null) === (parentId ?? null));
}

export function createFolder({ name, parentId = null, tags = [], releaseId = null }) {
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO folders (id, name, parent_id, tags, release_id) VALUES (?, ?, ?, ?, ?)').run(
    id,
    (name ?? '').trim(),
    parentId || null,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    releaseId || null
  );
  return getFolder(id, releaseId || null);
}

export function createItem({
  name,
  folderId,
  description = '',
  status = 'To Do',
  tags = [],
  parentId = null,
  tickets = [],
  bugs = [],
  releaseId = null,
  isStable = false
}) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO items (id, name, folder_id, description, status, tags, parent_id, tickets, bugs, release_id, is_stable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (name ?? '').trim(),
    folderId,
    (description ?? '').trim(),
    status || 'To Do',
    JSON.stringify(Array.isArray(tags) ? tags : []),
    parentId || null,
    JSON.stringify(Array.isArray(tickets) ? tickets : []),
    JSON.stringify(Array.isArray(bugs) ? bugs : []),
    releaseId || null,
    isStable ? 1 : 0
  );
  return getItem(id, releaseId || null);
}

export function updateFolder(id, patch, releaseId = null) {
  const folder = getFolder(id, releaseId);
  if (!folder) return null;
  const db = getDb();
  const name = patch.name !== undefined ? String(patch.name).trim() : folder.name;
  const parentId = patch.parentId !== undefined ? (patch.parentId || null) : folder.parentId;
  const tags = patch.tags !== undefined ? (Array.isArray(patch.tags) ? patch.tags : folder.tags) : folder.tags;
  if (folder.releaseId && folder.releaseId === releaseId) {
    db.prepare('UPDATE folders SET name = ?, parent_id = ?, tags = ? WHERE id = ?').run(name, parentId, JSON.stringify(tags), id);
    return getFolder(id, releaseId);
  }
  if (releaseId) {
    db.prepare(`
      INSERT INTO release_folder_overrides (release_id, folder_id, name, parent_id, tags, is_deleted, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(release_id, folder_id) DO UPDATE SET
        name = excluded.name,
        parent_id = excluded.parent_id,
        tags = excluded.tags,
        is_deleted = 0,
        updated_at = excluded.updated_at
    `).run(releaseId, id, name, parentId, JSON.stringify(tags), new Date().toISOString());
    return getFolder(id, releaseId);
  }
  db.prepare('UPDATE folders SET name = ?, parent_id = ?, tags = ? WHERE id = ?').run(name, parentId, JSON.stringify(tags), id);
  if (patch.comments !== undefined) {
    db.prepare('DELETE FROM folder_comments WHERE folder_id = ?').run(id);
    const ins = db.prepare('INSERT INTO folder_comments (id, folder_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of Array.isArray(patch.comments) ? patch.comments.map(normalizeComment) : []) {
      ins.run(c.id, id, c.text, c.createdAt || new Date().toISOString(), c.updatedAt || null, c.scopeType || null, c.scopeId || null);
    }
  }
  return getFolder(id);
}

function isCommentScoped(comment) {
  return Boolean(comment?.scopeType && comment?.scopeId);
}

function isCommentMatchedByScope(comment, scopeContext, includeGlobal = true) {
  if (!scopeContext) return true;
  if (!isCommentScoped(comment)) return includeGlobal;
  if (comment.scopeType === 'release') return scopeContext.releaseIds.has(comment.scopeId);
  return false;
}

export function filterCommentsByScope(comments = [], scopeContext = null) {
  const hasScopeFilter = Boolean(
    scopeContext && scopeContext.releaseIds && scopeContext.releaseIds.size > 0
  );
  if (!hasScopeFilter) return comments;
  return comments.filter((comment) => isCommentMatchedByScope(comment, scopeContext, true));
}

function buildComment(text, scopeType, scopeId) {
  return normalizeComment({
    id: uuid(),
    text: String(text).trim(),
    createdAt: new Date().toISOString(),
    scopeType,
    scopeId
  });
}

function buildInClause(ids = []) {
  return ids.map(() => '?').join(', ');
}

function remapCommentScope(commentRow, sourceReleaseId, targetReleaseId) {
  if (commentRow.scope_type === 'release' && commentRow.scope_id === sourceReleaseId) {
    return targetReleaseId;
  }
  return commentRow.scope_id ?? null;
}

export function cloneReleaseScopedData(sourceReleaseId, targetReleaseId, { copyOnlyStableItems = true, copyComments = false } = {}) {
  const db = getDb();
  if (!sourceReleaseId || !targetReleaseId || sourceReleaseId === targetReleaseId) return;

  db.prepare(
    `INSERT OR REPLACE INTO release_folder_overrides (release_id, folder_id, name, parent_id, tags, is_deleted, updated_at)
     SELECT ?, folder_id, name, parent_id, tags, is_deleted, ?
     FROM release_folder_overrides
     WHERE release_id = ?`
  ).run(targetReleaseId, new Date().toISOString(), sourceReleaseId);

  const sourceFolders = db.prepare('SELECT id, name, parent_id, tags FROM folders WHERE release_id = ?').all(sourceReleaseId);
  const folderIdMap = new Map();
  const insertFolder = db.prepare('INSERT INTO folders (id, name, parent_id, tags, release_id) VALUES (?, ?, ?, ?, ?)');
  for (const folder of sourceFolders) {
    folderIdMap.set(folder.id, uuid());
  }
  for (const folder of sourceFolders) {
    insertFolder.run(
      folderIdMap.get(folder.id),
      folder.name,
      folderIdMap.get(folder.parent_id) ?? folder.parent_id ?? null,
      folder.tags ?? '[]',
      targetReleaseId
    );
  }

  const sourceFolderIds = sourceFolders.map((folder) => folder.id);
  if (copyComments && sourceFolderIds.length > 0) {
    const inClause = buildInClause(sourceFolderIds);
    const folderComments = db
      .prepare(`SELECT id, folder_id, text, created_at, updated_at, scope_type, scope_id FROM folder_comments WHERE folder_id IN (${inClause})`)
      .all(...sourceFolderIds);
    const insertFolderComment = db.prepare(
      'INSERT INTO folder_comments (id, folder_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const comment of folderComments) {
      insertFolderComment.run(
        uuid(),
        folderIdMap.get(comment.folder_id) ?? comment.folder_id,
        comment.text,
        comment.created_at,
        comment.updated_at ?? null,
        comment.scope_type ?? null,
        remapCommentScope(comment, sourceReleaseId, targetReleaseId)
      );
    }
  }

  const sourceItems = db
    .prepare(
      `SELECT id, name, folder_id, description, status, tags, parent_id, tickets, bugs, is_stable
       FROM items
       WHERE release_id = ? ${copyOnlyStableItems ? 'AND is_stable = 1' : ''}`
    )
    .all(sourceReleaseId);
  const itemIdMap = new Map();
  const insertItem = db.prepare(
    'INSERT INTO items (id, name, folder_id, description, status, tags, parent_id, tickets, bugs, release_id, is_stable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const item of sourceItems) {
    itemIdMap.set(item.id, uuid());
  }
  for (const item of sourceItems) {
    insertItem.run(
      itemIdMap.get(item.id),
      item.name,
      folderIdMap.get(item.folder_id) ?? item.folder_id,
      item.description ?? '',
      item.status ?? 'To Do',
      item.tags ?? '[]',
      itemIdMap.get(item.parent_id) ?? item.parent_id ?? null,
      item.tickets ?? '[]',
      item.bugs ?? '[]',
      targetReleaseId,
      Number(item.is_stable || 0) > 0 ? 1 : 0
    );
  }

  const sourceItemIds = sourceItems.map((item) => item.id);
  if (copyComments && sourceItemIds.length > 0) {
    const inClause = buildInClause(sourceItemIds);
    const itemComments = db
      .prepare(`SELECT id, item_id, text, created_at, updated_at, scope_type, scope_id FROM item_comments WHERE item_id IN (${inClause})`)
      .all(...sourceItemIds);
    const insertItemComment = db.prepare(
      'INSERT INTO item_comments (id, item_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const comment of itemComments) {
      insertItemComment.run(
        uuid(),
        itemIdMap.get(comment.item_id) ?? comment.item_id,
        comment.text,
        comment.created_at,
        comment.updated_at ?? null,
        comment.scope_type ?? null,
        remapCommentScope(comment, sourceReleaseId, targetReleaseId)
      );
    }
  }
}

export function addCommentToFolder(id, { text, scopeType, scopeId }) {
  const folder = getFolderAny(id);
  if (!folder) return null;
  const comment = buildComment(text, scopeType, scopeId);
  const db = getDb();
  db.prepare('INSERT INTO folder_comments (id, folder_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    comment.id,
    id,
    comment.text,
    comment.createdAt,
    null,
    scopeType || null,
    scopeId || null
  );
  return comment;
}

export function addCommentToItem(id, { text, scopeType, scopeId }) {
  const item = getItemAny(id);
  if (!item) return null;
  const comment = buildComment(text, scopeType, scopeId);
  const db = getDb();
  db.prepare('INSERT INTO item_comments (id, item_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    comment.id,
    id,
    comment.text,
    comment.createdAt,
    null,
    scopeType || null,
    scopeId || null
  );
  return comment;
}

export function updateFolderComment(folderId, commentId, patch) {
  const folder = getFolderAny(folderId);
  if (!folder) return null;
  const comment = folder.comments.find((c) => c.id === commentId);
  if (!comment) return null;
  const db = getDb();
  const text = patch.text !== undefined ? String(patch.text).trim() : comment.text;
  const scopeType = patch.scopeType !== undefined ? patch.scopeType : comment.scopeType;
  const scopeId = patch.scopeId !== undefined ? patch.scopeId : comment.scopeId;
  db.prepare('UPDATE folder_comments SET text = ?, updated_at = ?, scope_type = ?, scope_id = ? WHERE id = ?').run(
    text,
    new Date().toISOString(),
    scopeType || null,
    scopeId || null,
    commentId
  );
  return { ...comment, text, scopeType, scopeId, updatedAt: new Date().toISOString() };
}

export function updateItemComment(itemId, commentId, patch) {
  const item = getItemAny(itemId);
  if (!item) return null;
  const comment = item.comments.find((c) => c.id === commentId);
  if (!comment) return null;
  const db = getDb();
  const text = patch.text !== undefined ? String(patch.text).trim() : comment.text;
  const scopeType = patch.scopeType !== undefined ? patch.scopeType : comment.scopeType;
  const scopeId = patch.scopeId !== undefined ? patch.scopeId : comment.scopeId;
  db.prepare('UPDATE item_comments SET text = ?, updated_at = ?, scope_type = ?, scope_id = ? WHERE id = ?').run(
    text,
    new Date().toISOString(),
    scopeType || null,
    scopeId || null,
    commentId
  );
  return { ...comment, text, scopeType, scopeId, updatedAt: new Date().toISOString() };
}

export function deleteFolderComment(folderId, commentId) {
  const db = getDb();
  const r = db.prepare('DELETE FROM folder_comments WHERE folder_id = ? AND id = ?').run(folderId, commentId);
  return r.changes > 0;
}

export function deleteItemComment(itemId, commentId) {
  const db = getDb();
  const r = db.prepare('DELETE FROM item_comments WHERE item_id = ? AND id = ?').run(itemId, commentId);
  return r.changes > 0;
}

export function deleteFolder(id, releaseId = null) {
  const folder = getFolder(id, releaseId);
  if (!folder) return false;

  const db = getDb();
  if (releaseId && folder.releaseId === releaseId) {
    const folders = getFolders(releaseId);
    const childrenByParent = new Map();
    for (const node of folders) {
      const key = node.parentId ?? '__ROOT__';
      const list = childrenByParent.get(key) ?? [];
      list.push(node.id);
      childrenByParent.set(key, list);
    }
    const folderIds = [];
    const queue = [id];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      folderIds.push(current);
      for (const childId of childrenByParent.get(current) ?? []) {
        queue.push(childId);
      }
    }
    const folderIdSet = new Set(folderIds);
    const itemIds = getItems(releaseId)
      .filter((item) => folderIdSet.has(item.folderId))
      .map((item) => item.id);
    if (itemIds.length > 0) {
      const itemInClause = buildInClause(itemIds);
      db.prepare(`DELETE FROM item_comments WHERE item_id IN (${itemInClause})`).run(...itemIds);
      db.prepare(`DELETE FROM items WHERE id IN (${itemInClause})`).run(...itemIds);
    }
    const folderInClause = buildInClause(folderIds);
    db.prepare(`DELETE FROM folder_comments WHERE folder_id IN (${folderInClause})`).run(...folderIds);
    db.prepare(`DELETE FROM folders WHERE id IN (${folderInClause})`).run(...folderIds);
    return true;
  }
  if (releaseId) {
    const folders = getFolders(releaseId);
    const childrenByParent = new Map();
    for (const node of folders) {
      const key = node.parentId ?? '__ROOT__';
      const list = childrenByParent.get(key) ?? [];
      list.push(node.id);
      childrenByParent.set(key, list);
    }

    const folderIds = [];
    const queue = [id];
    const seen = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      folderIds.push(current);
      for (const childId of childrenByParent.get(current) ?? []) {
        queue.push(childId);
      }
    }

    const upsertDelete = db.prepare(`
      INSERT INTO release_folder_overrides (release_id, folder_id, is_deleted, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(release_id, folder_id) DO UPDATE SET
        is_deleted = 1,
        updated_at = excluded.updated_at
    `);
    const now = new Date().toISOString();
    for (const folderId of folderIds) {
      upsertDelete.run(releaseId, folderId, now);
    }
    return true;
  }

  const folderIds = [];
  const queue = [id];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    folderIds.push(current);
    for (const child of getChildFolders(current)) {
      queue.push(child.id);
    }
  }

  const folderIdSet = new Set(folderIds);
  const itemIds = getItems('__ANY_RELEASE__')
    .filter((item) => folderIdSet.has(item.folderId))
    .map((item) => item.id);

  if (itemIds.length > 0) {
    const itemInClause = buildInClause(itemIds);
    db.prepare(`DELETE FROM item_comments WHERE item_id IN (${itemInClause})`).run(...itemIds);
    db.prepare(`DELETE FROM items WHERE id IN (${itemInClause})`).run(...itemIds);
  }

  const folderInClause = buildInClause(folderIds);
  db.prepare(`DELETE FROM folder_comments WHERE folder_id IN (${folderInClause})`).run(...folderIds);
  db.prepare(`DELETE FROM folders WHERE id IN (${folderInClause})`).run(...folderIds);

  return true;
}

export function updateItem(id, patch) {
  const item = getItemAny(id);
  if (!item) return null;
  const db = getDb();
  const name = patch.name !== undefined ? String(patch.name).trim() : item.name;
  const folderId = patch.folderId !== undefined ? patch.folderId : item.folderId;
  const description = patch.description !== undefined ? patch.description : item.description;
  const status = patch.status !== undefined ? patch.status : item.status;
  const tags = patch.tags !== undefined ? (Array.isArray(patch.tags) ? patch.tags : item.tags) : item.tags;
  const parentId = patch.parentId !== undefined ? (patch.parentId || null) : item.parentId;
  const tickets = patch.tickets !== undefined ? (Array.isArray(patch.tickets) ? patch.tickets : item.tickets) : item.tickets;
  const bugs = patch.bugs !== undefined ? (Array.isArray(patch.bugs) ? patch.bugs : item.bugs) : item.bugs;
  const isStable = patch.isStable !== undefined ? Boolean(patch.isStable) : Boolean(item.isStable);
  db.prepare(
    'UPDATE items SET name = ?, folder_id = ?, description = ?, status = ?, tags = ?, parent_id = ?, tickets = ?, bugs = ?, is_stable = ? WHERE id = ?'
  ).run(name, folderId, description, status, JSON.stringify(tags), parentId, JSON.stringify(tickets), JSON.stringify(bugs), isStable ? 1 : 0, id);
  if (patch.comments !== undefined) {
    db.prepare('DELETE FROM item_comments WHERE item_id = ?').run(id);
    const ins = db.prepare('INSERT INTO item_comments (id, item_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of Array.isArray(patch.comments) ? patch.comments.map(normalizeComment) : []) {
      ins.run(c.id, id, c.text, c.createdAt || new Date().toISOString(), c.updatedAt || null, c.scopeType || null, c.scopeId || null);
    }
  }
  return getItemAny(id);
}

function collectAffectedIds(release) {
  const folderIds = new Set(release?.affectedFolderIds ?? []);
  const itemIds = new Set(release?.affectedItemIds ?? []);
  const tags = new Set((release?.tags ?? []).map((t) => String(t).toUpperCase()));
  const folders = getFolders();
  const items = getItems();
  for (const folder of folders) {
    if (folder.tags?.some((t) => tags.has(String(t).toUpperCase()))) folderIds.add(folder.id);
  }
  for (const item of items) {
    if (item.tags?.some((t) => tags.has(String(t).toUpperCase()))) itemIds.add(item.id);
  }
  return { folderIds, itemIds };
}

function isFolderAffected(folderId, affectedFolderIds, affectedItemIds, releaseId = null) {
  if (affectedFolderIds.has(folderId)) return true;
  const folder = getFolder(folderId, releaseId);
  if (!folder?.parentId) return false;
  return isFolderAffected(folder.parentId, affectedFolderIds, affectedItemIds, releaseId);
}

function isItemAffected(itemId, affectedFolderIds, affectedItemIds, releaseId = null) {
  if (affectedItemIds.has(itemId)) return true;
  const item = getItem(itemId, releaseId);
  if (!item) return false;
  if (isFolderAffected(item.folderId, affectedFolderIds, affectedItemIds, releaseId)) return true;
  if (item.parentId && affectedItemIds.has(item.parentId)) return true;
  if (item.parentId) return isItemAffected(item.parentId, affectedFolderIds, affectedItemIds, releaseId);
  return false;
}

function folderHasComments(folderId, scopeContext, releaseId = null) {
  const folder = getFolder(folderId, releaseId);
  if (!folder) return false;
  if ((folder.comments ?? []).some((comment) => isCommentMatchedByScope(comment, scopeContext, false))) return true;
  for (const sub of getChildFolders(folderId, releaseId)) {
    if (folderHasComments(sub.id, scopeContext, releaseId)) return true;
  }
  for (const item of getItemsByFolder(folderId, releaseId)) {
    if ((item.comments ?? []).some((comment) => isCommentMatchedByScope(comment, scopeContext, false))) return true;
    if (itemHasDescendantWithComment(item.id, scopeContext, releaseId)) return true;
  }
  return false;
}

function itemHasDescendantWithComment(itemId, scopeContext, releaseId = null) {
  const items = getItems(releaseId);
  const children = items.filter((i) => i.parentId === itemId);
  for (const c of children) {
    if ((c.comments ?? []).some((comment) => isCommentMatchedByScope(comment, scopeContext, false))) return true;
    if (itemHasDescendantWithComment(c.id, scopeContext, releaseId)) return true;
  }
  return false;
}

export function getFoldersTree(release = null, scopeContext = null, releaseId = null) {
  const { folderIds: affectedFolderIds, itemIds: affectedItemIds } = release
    ? collectAffectedIds(release)
    : { folderIds: new Set(), itemIds: new Set() };
  const visibleFolderIds = new Set(getFolders(releaseId).map((folder) => folder.id));
  const items = getItems(releaseId).filter((item) => visibleFolderIds.has(item.folderId));

  function buildFolderNode(folder) {
    const children = [];
    const subFolders = getChildFolders(folder.id, releaseId);
    const folderItems = getItemsByFolder(folder.id, releaseId).filter((i) => !i.parentId);
    for (const sub of subFolders) children.push(buildFolderNode(sub));
    for (const item of folderItems) children.push(buildItemNode(item));
    const affectedByRelease = isFolderAffected(folder.id, affectedFolderIds, affectedItemIds, releaseId);
    const affectedByComment = folderHasComments(folder.id, scopeContext, releaseId);
    const affected = affectedByRelease;
    return {
      type: 'folder',
      id: folder.id,
      name: folder.name,
      tags: folder.tags ?? [],
      count: countItemsInFolder(folder.id),
      affectedByRelease: affected,
      hasComment: affectedByComment,
      children
    };
  }

  function buildItemNode(item) {
    const children = items.filter((i) => i.parentId === item.id).map((i) => buildItemNode(i));
    const affectedByRelease = isItemAffected(item.id, affectedFolderIds, affectedItemIds, releaseId);
    const hasComment =
      (item.comments ?? []).some((comment) => isCommentMatchedByScope(comment, scopeContext, false)) ||
      itemHasDescendantWithComment(item.id, scopeContext, releaseId);
    const affected = affectedByRelease;
    return {
      type: 'item',
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      status: item.status ?? 'To Do',
      tags: item.tags ?? [],
      folderId: item.folderId,
      affectedByRelease: affected,
      hasComment,
      children: children.length ? children : undefined
    };
  }

  function countItemsInFolder(folderId) {
    const direct = items.filter((i) => i.folderId === folderId);
    const subFolders = getChildFolders(folderId, releaseId);
    let total = direct.length;
    for (const sub of subFolders) total += countItemsInFolder(sub.id);
    return total;
  }

  const rootFolders = getChildFolders(null, releaseId);
  return {
    type: 'root',
    name: 'Test Repository',
    children: rootFolders.map(buildFolderNode),
    totalCount: getFolders(releaseId).length + items.length
  };
}

export function getFolderScoped(id, scopeContext = null, releaseId = null) {
  const folder = getFolder(id, releaseId);
  if (!folder) return null;
  return {
    ...folder,
    comments: filterCommentsByScope(folder.comments ?? [], scopeContext)
  };
}

export function getItemScoped(id, scopeContext = null, releaseId = null) {
  const item = getItem(id, releaseId);
  if (!item) return null;
  return {
    ...item,
    comments: filterCommentsByScope(item.comments ?? [], scopeContext)
  };
}
