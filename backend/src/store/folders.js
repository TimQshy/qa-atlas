import { getDb } from '../db/database.js';
import { v4 as uuid } from 'uuid';

function normalizeComment(comment) {
  return {
    id: comment?.id || uuid(),
    text: String(comment?.text ?? '').trim(),
    createdAt: comment?.created_at || comment?.createdAt || new Date().toISOString(),
    updatedAt: comment?.updated_at || comment?.updatedAt || null,
    scopeType: comment?.scope_type === 'release' || comment?.scope_type === 'sprint' ? comment.scope_type : (comment?.scopeType === 'release' || comment?.scopeType === 'sprint' ? comment.scopeType : null),
    scopeId: comment?.scope_id ?? comment?.scopeId ?? null
  };
}

function rowToFolder(row) {
  const comments = JSON.parse(row.comments_json || '[]');
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
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
    description: row.description ?? '',
    status: row.status ?? 'To Do',
    tags: JSON.parse(row.tags || '[]'),
    parentId: row.parent_id,
    tickets: JSON.parse(row.tickets || '[]'),
    bugs: JSON.parse(row.bugs || '[]'),
    comments: comments.map(normalizeComment)
  };
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
  return applyReleaseFolderOverrides(rows.map(rowToFolder), releaseId);
}

export function getItems() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM item_comments c WHERE c.item_id = i.id),
      '[]'
    ) as comments_json
    FROM items i
  `).all();
  return rows.map(rowToItem);
}

export function getFolder(id, releaseId = null) {
  return getFolders(releaseId).find((folder) => folder.id === id) ?? null;
}

export function getItem(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT i.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM item_comments c WHERE c.item_id = i.id),
      '[]'
    ) as comments_json
    FROM items i WHERE i.id = ?
  `).get(id);
  return row ? rowToItem(row) : null;
}

export function getItemsByFolder(folderId, releaseId = null) {
  if (releaseId && !getFolder(folderId, releaseId)) {
    return [];
  }
  const db = getDb();
  const rows = db.prepare(`
    SELECT i.*, COALESCE(
      (SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'created_at', c.created_at, 'updated_at', c.updated_at, 'scope_type', c.scope_type, 'scope_id', c.scope_id))
       FROM item_comments c WHERE c.item_id = i.id),
      '[]'
    ) as comments_json
    FROM items i WHERE i.folder_id = ?
  `).all(folderId);
  return rows.map(rowToItem);
}

export function getChildFolders(parentId, releaseId = null) {
  return getFolders(releaseId).filter((folder) => (folder.parentId ?? null) === (parentId ?? null));
}

export function createFolder({ name, parentId = null, tags = [] }) {
  const db = getDb();
  const id = uuid();
  db.prepare('INSERT INTO folders (id, name, parent_id, tags) VALUES (?, ?, ?, ?)').run(
    id,
    (name ?? '').trim(),
    parentId || null,
    JSON.stringify(Array.isArray(tags) ? tags : [])
  );
  return getFolder(id);
}

export function createItem({ name, folderId, description = '', status = 'To Do', tags = [], parentId = null, tickets = [], bugs = [] }) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO items (id, name, folder_id, description, status, tags, parent_id, tickets, bugs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (name ?? '').trim(),
    folderId,
    (description ?? '').trim(),
    status || 'To Do',
    JSON.stringify(Array.isArray(tags) ? tags : []),
    parentId || null,
    JSON.stringify(Array.isArray(tickets) ? tickets : []),
    JSON.stringify(Array.isArray(bugs) ? bugs : [])
  );
  return getItem(id);
}

export function updateFolder(id, patch, releaseId = null) {
  const folder = getFolder(id, releaseId);
  if (!folder) return null;
  const db = getDb();
  const name = patch.name !== undefined ? String(patch.name).trim() : folder.name;
  const parentId = patch.parentId !== undefined ? (patch.parentId || null) : folder.parentId;
  const tags = patch.tags !== undefined ? (Array.isArray(patch.tags) ? patch.tags : folder.tags) : folder.tags;
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

export function filterCommentsByScope(comments = [], scopeContext = null) {
  const hasScopeFilter = Boolean(
    scopeContext &&
      ((scopeContext.releaseIds && scopeContext.releaseIds.size > 0) ||
        (scopeContext.sprintIds && scopeContext.sprintIds.size > 0))
  );
  if (!hasScopeFilter) return comments;
  return comments.filter((comment) => {
    if (!isCommentScoped(comment)) return true;
    if (comment.scopeType === 'release') return scopeContext.releaseIds.has(comment.scopeId);
    if (comment.scopeType === 'sprint') return scopeContext.sprintIds.has(comment.scopeId);
    return false;
  });
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

export function addCommentToFolder(id, { text, scopeType, scopeId }) {
  const folder = getFolder(id);
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
  const item = getItem(id);
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
  const folder = getFolder(folderId);
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
  const item = getItem(itemId);
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
  const itemIds = getItems()
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
  const item = getItem(id);
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
  db.prepare(
    'UPDATE items SET name = ?, folder_id = ?, description = ?, status = ?, tags = ?, parent_id = ?, tickets = ?, bugs = ? WHERE id = ?'
  ).run(name, folderId, description, status, JSON.stringify(tags), parentId, JSON.stringify(tickets), JSON.stringify(bugs), id);
  if (patch.comments !== undefined) {
    db.prepare('DELETE FROM item_comments WHERE item_id = ?').run(id);
    const ins = db.prepare('INSERT INTO item_comments (id, item_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of Array.isArray(patch.comments) ? patch.comments.map(normalizeComment) : []) {
      ins.run(c.id, id, c.text, c.createdAt || new Date().toISOString(), c.updatedAt || null, c.scopeType || null, c.scopeId || null);
    }
  }
  return getItem(id);
}

function collectAffectedIds(releaseOrSprint) {
  const folderIds = new Set(releaseOrSprint?.affectedFolderIds ?? []);
  const itemIds = new Set(releaseOrSprint?.affectedItemIds ?? []);
  const tags = new Set((releaseOrSprint?.tags ?? []).map((t) => String(t).toUpperCase()));
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

function mergeAffectedIds(release, sprint) {
  const r = release ? collectAffectedIds(release) : { folderIds: new Set(), itemIds: new Set() };
  const s = sprint ? collectAffectedIds(sprint) : { folderIds: new Set(), itemIds: new Set() };
  return {
    folderIds: new Set([...r.folderIds, ...s.folderIds]),
    itemIds: new Set([...r.itemIds, ...s.itemIds])
  };
}

function isFolderAffected(folderId, affectedFolderIds, affectedItemIds, releaseId = null) {
  if (affectedFolderIds.has(folderId)) return true;
  const folder = getFolder(folderId, releaseId);
  if (!folder?.parentId) return false;
  return isFolderAffected(folder.parentId, affectedFolderIds, affectedItemIds, releaseId);
}

function isItemAffected(itemId, affectedFolderIds, affectedItemIds, releaseId = null) {
  if (affectedItemIds.has(itemId)) return true;
  const item = getItem(itemId);
  if (!item) return false;
  if (releaseId && !getFolder(item.folderId, releaseId)) return false;
  if (isFolderAffected(item.folderId, affectedFolderIds, affectedItemIds, releaseId)) return true;
  if (item.parentId && affectedItemIds.has(item.parentId)) return true;
  if (item.parentId) return isItemAffected(item.parentId, affectedFolderIds, affectedItemIds, releaseId);
  return false;
}

function folderHasComments(folderId, scopeContext, releaseId = null) {
  const folder = getFolder(folderId, releaseId);
  if (!folder) return false;
  if (filterCommentsByScope(folder.comments ?? [], scopeContext).length > 0) return true;
  for (const sub of getChildFolders(folderId, releaseId)) {
    if (folderHasComments(sub.id, scopeContext, releaseId)) return true;
  }
  for (const item of getItemsByFolder(folderId, releaseId)) {
    if (filterCommentsByScope(item.comments ?? [], scopeContext).length > 0) return true;
    if (itemHasDescendantWithComment(item.id, scopeContext)) return true;
  }
  return false;
}

function itemHasDescendantWithComment(itemId, scopeContext) {
  const items = getItems();
  const children = items.filter((i) => i.parentId === itemId);
  for (const c of children) {
    if (filterCommentsByScope(c.comments ?? [], scopeContext).length > 0) return true;
    if (itemHasDescendantWithComment(c.id, scopeContext)) return true;
  }
  return false;
}

export function getFoldersTree(release = null, sprint = null, scopeContext = null, releaseId = null) {
  const { folderIds: affectedFolderIds, itemIds: affectedItemIds } = mergeAffectedIds(release, sprint);
  const visibleFolderIds = new Set(getFolders(releaseId).map((folder) => folder.id));
  const items = getItems().filter((item) => visibleFolderIds.has(item.folderId));

  function buildFolderNode(folder) {
    const children = [];
    const subFolders = getChildFolders(folder.id, releaseId);
    const folderItems = getItemsByFolder(folder.id, releaseId).filter((i) => !i.parentId);
    for (const sub of subFolders) children.push(buildFolderNode(sub));
    for (const item of folderItems) children.push(buildItemNode(item));
    const affectedByRelease = isFolderAffected(folder.id, affectedFolderIds, affectedItemIds, releaseId);
    const affectedByComment = folderHasComments(folder.id, scopeContext, releaseId);
    const affected = affectedByRelease || affectedByComment;
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
      filterCommentsByScope(item.comments ?? [], scopeContext).length > 0 ||
      itemHasDescendantWithComment(item.id, scopeContext);
    const affected = affectedByRelease || hasComment;
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
  const item = getItem(id);
  if (!item) return null;
  if (releaseId && !getFolder(item.folderId, releaseId)) return null;
  return {
    ...item,
    comments: filterCommentsByScope(item.comments ?? [], scopeContext)
  };
}
