import { Router } from 'express';
import {
  getFolders,
  getItems,
  getFolder,
  getFolderScoped,
  getItemScoped,
  getItemsByFolder,
  getFoldersTree,
  createFolder,
  createItem,
  updateFolder,
  updateItem,
  addCommentToFolder,
  addCommentToItem,
  updateFolderComment,
  updateItemComment,
  deleteFolderComment,
  deleteItemComment,
  deleteFolder
} from '../store/folders.js';
import { getRelease, getDescendantReleaseIds } from '../store/releases.js';
import { getSprint, getDescendantSprintIds, getSprintsByReleaseIds } from '../store/sprints.js';

const router = Router();

function buildScopeContext(releaseId, sprintId) {
  const releaseIds = new Set();
  const sprintIds = new Set();

  if (releaseId) {
    const ids = getDescendantReleaseIds(releaseId);
    for (const id of ids) releaseIds.add(id);
  }

  if (sprintId) {
    const ids = getDescendantSprintIds(sprintId);
    for (const id of ids) sprintIds.add(id);
  }

  if (releaseIds.size > 0) {
    const releaseSprints = getSprintsByReleaseIds([...releaseIds]);
    for (const sprint of releaseSprints) {
      sprintIds.add(sprint.id);
      for (const childId of getDescendantSprintIds(sprint.id)) {
        sprintIds.add(childId);
      }
    }
  }

  return { releaseIds, sprintIds };
}

function buildAggregateImpact(scopeContext) {
  const release = {
    affectedFolderIds: [],
    affectedItemIds: [],
    tags: []
  };
  const sprint = {
    affectedFolderIds: [],
    affectedItemIds: [],
    tags: []
  };

  const releaseFolderSet = new Set();
  const releaseItemSet = new Set();
  const releaseTagSet = new Set();
  const sprintFolderSet = new Set();
  const sprintItemSet = new Set();
  const sprintTagSet = new Set();

  for (const releaseId of scopeContext.releaseIds) {
    const node = getRelease(releaseId);
    if (!node) continue;
    for (const id of node.affectedFolderIds ?? []) releaseFolderSet.add(id);
    for (const id of node.affectedItemIds ?? []) releaseItemSet.add(id);
    for (const tag of node.tags ?? []) releaseTagSet.add(tag);
  }

  for (const sprintId of scopeContext.sprintIds) {
    const node = getSprint(sprintId);
    if (!node) continue;
    for (const id of node.affectedFolderIds ?? []) sprintFolderSet.add(id);
    for (const id of node.affectedItemIds ?? []) sprintItemSet.add(id);
    for (const tag of node.tags ?? []) sprintTagSet.add(tag);
  }

  release.affectedFolderIds = [...releaseFolderSet];
  release.affectedItemIds = [...releaseItemSet];
  release.tags = [...releaseTagSet];
  sprint.affectedFolderIds = [...sprintFolderSet];
  sprint.affectedItemIds = [...sprintItemSet];
  sprint.tags = [...sprintTagSet];

  return { release, sprint };
}

function validateScope({ scopeType, scopeId }) {
  if (scopeType == null && scopeId == null) return null;
  if (!scopeType || !scopeId) return 'scopeType and scopeId must be provided together';
  if (scopeType !== 'release' && scopeType !== 'sprint') return 'scopeType must be "release" or "sprint"';
  if (scopeType === 'release' && !getRelease(scopeId)) return 'release not found';
  if (scopeType === 'sprint' && !getSprint(scopeId)) return 'sprint not found';
  return null;
}

router.get('/', (req, res) => {
  const releaseId = req.query.releaseId || null;
  res.json({ folders: getFolders(releaseId), items: getItems() });
});

router.get('/tree', (req, res) => {
  const releaseId = req.query.releaseId;
  const sprintId = req.query.sprintId;
  const scopeContext = buildScopeContext(releaseId, sprintId);
  const { release, sprint } = buildAggregateImpact(scopeContext);
  const tree = getFoldersTree(release, sprint, scopeContext, releaseId || null);
  res.json(tree);
});

router.post('/folder', (req, res) => {
  const { name, parentId, tags } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const folder = createFolder({ name: name.trim(), parentId: parentId || null, tags: tags ?? [] });
  res.json({ folder });
});

router.post('/item', (req, res) => {
  const { name, folderId, description, status, tags, parentId, tickets, bugs } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!folderId) {
    return res.status(400).json({ error: 'folderId is required' });
  }
  const folder = getFolder(folderId);
  if (!folder) {
    return res.status(400).json({ error: 'folder not found' });
  }
  const item = createItem({
    name: name.trim(),
    folderId,
    description: description ?? '',
    status: status ?? 'To Do',
    tags: tags ?? [],
    parentId: parentId || null,
    tickets: tickets ?? [],
    bugs: bugs ?? []
  });
  res.json({ item });
});

router.put('/folder/:id', (req, res) => {
  const releaseId = req.query.releaseId || null;
  const folder = updateFolder(req.params.id, req.body ?? {}, releaseId);
  if (!folder) {
    return res.status(404).json({ error: 'folder not found' });
  }
  res.json({ folder });
});

router.delete('/folder/:id', (req, res) => {
  const releaseId = req.query.releaseId || null;
  const deleted = deleteFolder(req.params.id, releaseId);
  if (!deleted) {
    return res.status(404).json({ error: 'folder not found' });
  }
  res.status(204).send();
});

router.put('/item/:id', (req, res) => {
  const item = updateItem(req.params.id, req.body ?? {});
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  res.json({ item });
});

router.get('/folder/:id', (req, res) => {
  const releaseId = req.query.releaseId || null;
  const scopeContext = buildScopeContext(req.query.releaseId, req.query.sprintId);
  const folder = getFolderScoped(req.params.id, scopeContext, releaseId);
  if (!folder) {
    return res.status(404).json({ error: 'folder not found' });
  }
  const items = getItemsByFolder(folder.id, releaseId).filter((i) => !i.parentId);
  res.json({ folder, items });
});

router.get('/item/:id', (req, res) => {
  const releaseId = req.query.releaseId || null;
  const scopeContext = buildScopeContext(req.query.releaseId, req.query.sprintId);
  const item = getItemScoped(req.params.id, scopeContext, releaseId);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  res.json(item);
});

router.post('/folder/:id/comment', (req, res) => {
  const { text, scopeType, scopeId } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const scopeError = validateScope({ scopeType, scopeId });
  if (scopeError) {
    return res.status(400).json({ error: scopeError });
  }
  const comment = addCommentToFolder(req.params.id, { text: text.trim(), scopeType, scopeId });
  if (!comment) {
    return res.status(404).json({ error: 'folder not found' });
  }
  res.json({ comment });
});

router.post('/item/:id/comment', (req, res) => {
  const { text, scopeType, scopeId } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const scopeError = validateScope({ scopeType, scopeId });
  if (scopeError) {
    return res.status(400).json({ error: scopeError });
  }
  const comment = addCommentToItem(req.params.id, { text: text.trim(), scopeType, scopeId });
  if (!comment) {
    return res.status(404).json({ error: 'item not found' });
  }
  res.json({ comment });
});

router.put('/folder/:id/comment/:commentId', (req, res) => {
  const { text, scopeType, scopeId } = req.body ?? {};
  if (text !== undefined && (!String(text).trim() || typeof text !== 'string')) {
    return res.status(400).json({ error: 'text must be non-empty string' });
  }
  if ((scopeType !== undefined || scopeId !== undefined) && validateScope({ scopeType, scopeId })) {
    return res.status(400).json({ error: 'invalid scope' });
  }
  const comment = updateFolderComment(req.params.id, req.params.commentId, {
    text: text !== undefined ? String(text).trim() : undefined,
    scopeType,
    scopeId
  });
  if (!comment) {
    return res.status(404).json({ error: 'folder or comment not found' });
  }
  res.json({ comment });
});

router.put('/item/:id/comment/:commentId', (req, res) => {
  const { text, scopeType, scopeId } = req.body ?? {};
  if (text !== undefined && (!String(text).trim() || typeof text !== 'string')) {
    return res.status(400).json({ error: 'text must be non-empty string' });
  }
  if ((scopeType !== undefined || scopeId !== undefined) && validateScope({ scopeType, scopeId })) {
    return res.status(400).json({ error: 'invalid scope' });
  }
  const comment = updateItemComment(req.params.id, req.params.commentId, {
    text: text !== undefined ? String(text).trim() : undefined,
    scopeType,
    scopeId
  });
  if (!comment) {
    return res.status(404).json({ error: 'item or comment not found' });
  }
  res.json({ comment });
});

router.delete('/folder/:id/comment/:commentId', (req, res) => {
  const deleted = deleteFolderComment(req.params.id, req.params.commentId);
  if (!deleted) {
    return res.status(404).json({ error: 'folder or comment not found' });
  }
  res.status(204).send();
});

router.delete('/item/:id/comment/:commentId', (req, res) => {
  const deleted = deleteItemComment(req.params.id, req.params.commentId);
  if (!deleted) {
    return res.status(404).json({ error: 'item or comment not found' });
  }
  res.status(204).send();
});

export default router;
