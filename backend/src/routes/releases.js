import { Router } from 'express';
import {
  getReleases,
  getRelease,
  createRelease,
  createReleaseFrom,
  updateRelease,
  deleteRelease
} from '../store/releases.js';

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
  const { name, date, parentId, affectedFolderIds, affectedItemIds, tags, duplicateFromReleaseId, copyOnlyStableItems } = req.body ?? {};

  if (duplicateFromReleaseId) {
    const release = createReleaseFrom(duplicateFromReleaseId, {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      date: date || undefined,
      parentId: parentId !== undefined ? parentId || null : undefined,
      affectedFolderIds: Array.isArray(affectedFolderIds) ? affectedFolderIds : undefined,
      affectedItemIds: Array.isArray(affectedItemIds) ? affectedItemIds : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      copyOnlyStableItems: copyOnlyStableItems !== undefined ? Boolean(copyOnlyStableItems) : undefined
    });
    if (!release) {
      return res.status(400).json({ error: 'duplicate source release not found' });
    }
    return res.json(release);
  }

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

router.delete('/:id', (req, res) => {
  const deleted = deleteRelease(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'release not found' });
  }
  res.status(204).send();
});

export default router;
