import { Router } from 'express';
import { getReleases, getRelease, createRelease, updateRelease } from '../store/releases.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ releases: getReleases() });
});

router.get('/:id', (req, res) => {
  const release = getRelease(req.params.id);
  if (!release) {
    return res.status(404).json({ error: 'release not found' });
  }
  res.json(release);
});

router.post('/', (req, res) => {
  const { name, date, parentId, affectedFolderIds, affectedItemIds, tags } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const release = createRelease({
    name: name.trim(),
    date: date || new Date().toISOString().slice(0, 10),
    parentId: parentId || null,
    affectedFolderIds: affectedFolderIds ?? [],
    affectedItemIds: affectedItemIds ?? [],
    tags: tags ?? []
  });
  res.json(release);
});

router.put('/:id', (req, res) => {
  const { name, date, parentId, affectedFolderIds, affectedItemIds, tags } = req.body ?? {};
  const release = updateRelease(req.params.id, {
    name,
    date,
    parentId,
    affectedFolderIds,
    affectedItemIds,
    tags
  });
  if (!release) {
    return res.status(404).json({ error: 'release not found' });
  }
  res.json(release);
});

export default router;
