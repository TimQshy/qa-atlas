import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'folders.json');

let state = {
  folders: [],
  items: []
};

function getDefaultState() {
  return { folders: [], items: [] };
}

export function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      state = JSON.parse(data);
    } else {
      state = getDefaultState();
      save();
    }
  } catch (err) {
    console.error('Error loading folders:', err);
    state = getDefaultState();
  }
}

export function save() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving folders:', err);
  }
}

export function getFolders() {
  return [...state.folders];
}

export function getItems() {
  return [...state.items];
}

export function getFolder(id) {
  return state.folders.find((f) => f.id === id) ?? null;
}

export function getItem(id) {
  return state.items.find((i) => i.id === id) ?? null;
}

export function getItemsByFolder(folderId) {
  return state.items.filter((i) => i.folderId === folderId);
}

export function getChildFolders(parentId) {
  return state.folders.filter((f) => (f.parentId ?? null) === parentId);
}

export function createFolder({ name, parentId = null, tags = [] }) {
  const folder = {
    id: uuid(),
    name: (name ?? '').trim(),
    parentId: parentId || null,
    tags: Array.isArray(tags) ? tags : [],
    comments: []
  };
  state.folders.push(folder);
  return folder;
}

export function createItem({ name, folderId, description = '', status = 'To Do', tags = [], parentId = null, tickets = [], bugs = [] }) {
  const item = {
    id: uuid(),
    name: (name ?? '').trim(),
    folderId,
    description: (description ?? '').trim(),
    status: status || 'To Do',
    tags: Array.isArray(tags) ? tags : [],
    parentId: parentId || null,
    tickets: Array.isArray(tickets) ? tickets : [],
    bugs: Array.isArray(bugs) ? bugs : [],
    comments: []
  };
  state.items.push(item);
  return item;
}

export function updateFolder(id, patch) {
  const folder = getFolder(id);
  if (!folder) return null;
  if (patch.name !== undefined) folder.name = String(patch.name).trim();
  if (patch.parentId !== undefined) folder.parentId = patch.parentId || null;
  if (patch.tags !== undefined) folder.tags = Array.isArray(patch.tags) ? patch.tags : folder.tags;
  if (patch.comments !== undefined) folder.comments = Array.isArray(patch.comments) ? patch.comments : (folder.comments ?? []);
  return folder;
}

export function addCommentToFolder(id, text) {
  const folder = getFolder(id);
  if (!folder) return null;
  folder.comments = folder.comments ?? [];
  folder.comments.push({ id: uuid(), text: String(text).trim(), createdAt: new Date().toISOString() });
  return folder;
}

export function addCommentToItem(id, text) {
  const item = getItem(id);
  if (!item) return null;
  item.comments = item.comments ?? [];
  item.comments.push({ id: uuid(), text: String(text).trim(), createdAt: new Date().toISOString() });
  return item;
}

export function updateItem(id, patch) {
  const item = getItem(id);
  if (!item) return null;
  if (patch.name !== undefined) item.name = String(patch.name).trim();
  if (patch.folderId !== undefined) item.folderId = patch.folderId;
  if (patch.description !== undefined) item.description = String(patch.description);
  if (patch.status !== undefined) item.status = patch.status;
  if (patch.tags !== undefined) item.tags = Array.isArray(patch.tags) ? patch.tags : item.tags;
  if (patch.parentId !== undefined) item.parentId = patch.parentId || null;
  if (patch.tickets !== undefined) item.tickets = Array.isArray(patch.tickets) ? patch.tickets : item.tickets;
  if (patch.bugs !== undefined) item.bugs = Array.isArray(patch.bugs) ? patch.bugs : item.bugs;
  if (patch.comments !== undefined) item.comments = Array.isArray(patch.comments) ? patch.comments : (item.comments ?? []);
  return item;
}

function collectAffectedIds(releaseOrSprint) {
  const folderIds = new Set(releaseOrSprint?.affectedFolderIds ?? []);
  const itemIds = new Set(releaseOrSprint?.affectedItemIds ?? []);
  const tags = new Set((releaseOrSprint?.tags ?? []).map((t) => String(t).toUpperCase()));

  for (const folder of state.folders) {
    if (folder.tags?.some((t) => tags.has(String(t).toUpperCase()))) {
      folderIds.add(folder.id);
    }
  }
  for (const item of state.items) {
    if (item.tags?.some((t) => tags.has(String(t).toUpperCase()))) {
      itemIds.add(item.id);
    }
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

function isFolderAffected(folderId, affectedFolderIds, affectedItemIds) {
  if (affectedFolderIds.has(folderId)) return true;
  const folder = getFolder(folderId);
  if (!folder?.parentId) return false;
  return isFolderAffected(folder.parentId, affectedFolderIds, affectedItemIds);
}

function isItemAffected(itemId, affectedFolderIds, affectedItemIds) {
  if (affectedItemIds.has(itemId)) return true;
  const item = getItem(itemId);
  if (!item) return false;
  if (isFolderAffected(item.folderId, affectedFolderIds, affectedItemIds)) return true;
  if (item.parentId && affectedItemIds.has(item.parentId)) return true;
  if (item.parentId) return isItemAffected(item.parentId, affectedFolderIds, affectedItemIds);
  return false;
}

function folderHasComments(folderId) {
  const folder = getFolder(folderId);
  if (!folder) return false;
  if ((folder.comments ?? []).length > 0) return true;
  for (const sub of getChildFolders(folderId)) {
    if (folderHasComments(sub.id)) return true;
  }
  for (const item of getItemsByFolder(folderId)) {
    if ((item.comments ?? []).length > 0) return true;
    if (itemHasDescendantWithComment(item.id)) return true;
  }
  return false;
}

function itemHasDescendantWithComment(itemId) {
  const children = state.items.filter((i) => i.parentId === itemId);
  for (const c of children) {
    if ((c.comments ?? []).length > 0) return true;
    if (itemHasDescendantWithComment(c.id)) return true;
  }
  return false;
}

export function getFoldersTree(release = null, sprint = null) {
  const { folderIds: affectedFolderIds, itemIds: affectedItemIds } = mergeAffectedIds(release, sprint);

  function buildFolderNode(folder) {
    const children = [];
    const subFolders = getChildFolders(folder.id);
    const items = getItemsByFolder(folder.id).filter((i) => !i.parentId);

    for (const sub of subFolders) {
      children.push(buildFolderNode(sub));
    }
    for (const item of items) {
      children.push(buildItemNode(item));
    }

    const affectedByRelease = isFolderAffected(folder.id, affectedFolderIds, affectedItemIds);
    const affectedByComment = folderHasComments(folder.id);
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
    const children = state.items
      .filter((i) => i.parentId === item.id)
      .map((i) => buildItemNode(i));

    const affectedByRelease = isItemAffected(item.id, affectedFolderIds, affectedItemIds);
    const hasComment = (item.comments ?? []).length > 0 || itemHasDescendantWithComment(item.id);
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
    const direct = state.items.filter((i) => i.folderId === folderId);
    const subFolders = getChildFolders(folderId);
    let total = direct.length;
    for (const sub of subFolders) {
      total += countItemsInFolder(sub.id);
    }
    return total;
  }

  const rootFolders = getChildFolders(null);
  return {
    type: 'root',
    name: 'Test Repository',
    children: rootFolders.map(buildFolderNode),
    totalCount: state.folders.length + state.items.length
  };
}
