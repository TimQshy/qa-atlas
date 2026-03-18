import { Router } from 'express';
import { getSprints, getSprint, createSprint, updateSprint } from '../store/sprints.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ sprints: getSprints() });
});

router.get('/:id', (req, res) => {
  const sprint = getSprint(req.params.id);
  if (!sprint) {
    return res.status(404).json({ error: 'sprint not found' });
  }
  res.json(sprint);
});

router.post('/', (req, res) => {
  const { name, startDate, endDate, goal, releaseId, parentId, affectedFolderIds, affectedItemIds, tags } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const sprint = createSprint({
    name: name.trim(),
    startDate: startDate || new Date().toISOString().slice(0, 10),
    endDate: endDate || null,
    goal: goal ?? '',
    releaseId: releaseId || null,
    parentId: parentId || null,
    affectedFolderIds: affectedFolderIds ?? [],
    affectedItemIds: affectedItemIds ?? [],
    tags: tags ?? []
  });
  res.json(sprint);
});

router.put('/:id', (req, res) => {
  const { name, startDate, endDate, goal, releaseId, parentId, affectedFolderIds, affectedItemIds, tags } = req.body ?? {};
  const sprint = updateSprint(req.params.id, {
    name,
    startDate,
    endDate,
    goal,
    releaseId,
    parentId,
    affectedFolderIds,
    affectedItemIds,
    tags
  });
  if (!sprint) {
    return res.status(404).json({ error: 'sprint not found' });
  }
  res.json(sprint);
});

export default router;
