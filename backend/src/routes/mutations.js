import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import {
  ensureModule,
  ensureFeature,
  resolveModule,
  findFeatureByModuleAndName,
  updateFeatureTestCases,
  updateFeatureTickets,
  updateFeatureBugs,
  updateFeatureAutomation,
  updateFeatureCoverage
} from '../store/graph.js';

const router = Router();

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

router.post('/module', (req, res) => {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const module = ensureModule(name.trim());
  res.json({ module });
});

router.post('/feature', (req, res) => {
  const { module: moduleRef, name } = req.body ?? {};
  if (!moduleRef || !name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'module and name are required' });
  }
  const mod = resolveModule(moduleRef);
  if (!mod) {
    return res.status(400).json({ error: 'module not found' });
  }
  const feature = ensureFeature(mod.id, name.trim());
  res.json({ feature });
});

router.post('/testcase', (req, res) => {
  const { module: moduleRef, feature: featureName, testCase, automated } = req.body ?? {};
  if (!moduleRef || !featureName || !testCase || typeof testCase !== 'string' || !testCase.trim()) {
    return res.status(400).json({ error: 'module, feature, and testCase are required' });
  }
  const feature = findFeatureByModuleAndName(moduleRef, featureName);
  if (!feature) {
    return res.status(400).json({ error: 'feature not found' });
  }
  const tc = {
    id: uuid(),
    name: testCase.trim(),
    automated: !!automated
  };
  const testCases = feature.testCases ?? [];
  testCases.push(tc);
  let automation = feature.automation ?? [];
  if (tc.automated) automation.push(tc.name);
  updateFeatureTestCases(feature.id, testCases);
  updateFeatureAutomation(feature.id, automation);
  res.json({ feature: { ...feature, testCases, automation } });
});

router.post('/ticket', (req, res) => {
  const { module: moduleRef, feature: featureName, ticket } = req.body ?? {};
  if (!moduleRef || !featureName || !ticket || typeof ticket !== 'string' || !ticket.trim()) {
    return res.status(400).json({ error: 'module, feature, and ticket are required' });
  }
  const feature = findFeatureByModuleAndName(moduleRef, featureName);
  if (!feature) {
    return res.status(400).json({ error: 'feature not found' });
  }
  const tickets = feature.tickets ?? [];
  tickets.push({ key: ticket.trim() });
  updateFeatureTickets(feature.id, tickets);
  res.json({ feature: { ...feature, tickets } });
});

router.post('/bug', (req, res) => {
  const { module: moduleRef, feature: featureName, bug } = req.body ?? {};
  if (!moduleRef || !featureName || !bug || typeof bug !== 'string' || !bug.trim()) {
    return res.status(400).json({ error: 'module, feature, and bug are required' });
  }
  const feature = findFeatureByModuleAndName(moduleRef, featureName);
  if (!feature) {
    return res.status(400).json({ error: 'feature not found' });
  }
  const bugs = feature.bugs ?? [];
  bugs.push(bug.trim());
  updateFeatureBugs(feature.id, bugs);
  res.json({ feature: { ...feature, bugs } });
});

router.post('/coverage', (req, res) => {
  const { module: moduleRef, feature: featureName, coverage } = req.body ?? {};
  if (!moduleRef || !featureName || coverage == null) {
    return res.status(400).json({ error: 'module, feature, and coverage are required' });
  }
  const num = Number(coverage);
  if (isNaN(num)) {
    return res.status(400).json({ error: 'coverage must be a number' });
  }
  const feature = findFeatureByModuleAndName(moduleRef, featureName);
  if (!feature) {
    return res.status(400).json({ error: 'feature not found' });
  }
  const value = clamp(num, 0, 100);
  updateFeatureCoverage(feature.id, value);
  res.json({ feature: { ...feature, coverage: value } });
});

export default router;
