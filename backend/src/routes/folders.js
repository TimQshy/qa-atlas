import { Router } from 'express';
import {
  save,
  getFolders,
  getItems,
  getFolder,
  getItem,
  getItemsByFolder,
  getFoldersTree,
  createFolder,
  createItem,
  updateFolder,
  updateItem,
  addCommentToFolder,
  addCommentToItem
} from '../store/folders.js';
import { getRelease } from '../store/releases.js';
import { getSprint } from '../store/sprints.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ folders: getFolders(), items: getItems() });
});

router.get('/tree', (req, res) => {
  const releaseId = req.query.releaseId;
  const sprintId = req.query.sprintId;
  const release = releaseId ? getRelease(releaseId) : null;
  const sprint = sprintId ? getSprint(sprintId) : null;
  const tree = getFoldersTree(release, sprint);
  res.json(tree);
});

router.post('/folder', (req, res) => {
  const { name, parentId, tags } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const folder = createFolder({ name: name.trim(), parentId: parentId || null, tags: tags ?? [] });
  save();
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
  save();
  res.json({ item });
});

router.put('/folder/:id', (req, res) => {
  const folder = updateFolder(req.params.id, req.body ?? {});
  if (!folder) {
    return res.status(404).json({ error: 'folder not found' });
  }
  save();
  res.json({ folder });
});

router.put('/item/:id', (req, res) => {
  const item = updateItem(req.params.id, req.body ?? {});
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  save();
  res.json({ item });
});

router.get('/folder/:id', (req, res) => {
  const folder = getFolder(req.params.id);
  if (!folder) {
    return res.status(404).json({ error: 'folder not found' });
  }
  const items = getItemsByFolder(folder.id).filter((i) => !i.parentId);
  res.json({ folder, items });
});

router.get('/item/:id', (req, res) => {
  const item = getItem(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  res.json(item);
});

router.post('/folder/:id/comment', (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const folder = addCommentToFolder(req.params.id, text.trim());
  if (!folder) {
    return res.status(404).json({ error: 'folder not found' });
  }
  save();
  res.json({ folder, comment: folder.comments[folder.comments.length - 1] });
});

router.post('/item/:id/comment', (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const item = addCommentToItem(req.params.id, text.trim());
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  save();
  res.json({ item, comment: item.comments[item.comments.length - 1] });
});

export default router;
