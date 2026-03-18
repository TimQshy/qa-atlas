import { getDb } from '../db/database.js';
import { v4 as uuid } from 'uuid';

function rowToModule(row) {
  return { id: row.id, name: row.name, features: [] };
}

function rowToFeature(row) {
  return {
    id: row.id,
    name: row.name,
    moduleId: row.module_id,
    coverage: row.coverage ?? 0,
    testCases: JSON.parse(row.test_cases || '[]'),
    tickets: JSON.parse(row.tickets || '[]'),
    bugs: JSON.parse(row.bugs || '[]'),
    automation: JSON.parse(row.automation || '[]')
  };
}

export function load() {
  // No-op: SQLite loads on init
}

export function save() {
  // No-op: SQLite persists on each write
}

export function getProduct() {
  const db = getDb();
  const settings = db.prepare('SELECT product_name FROM product_settings WHERE id = 1').get();
  const modules = db.prepare('SELECT id, name FROM modules ORDER BY name').all();
  const features = db.prepare('SELECT * FROM features').all();
  const featureMap = new Map();
  for (const f of features) {
    featureMap.set(f.id, rowToFeature(f));
  }
  const result = {
    productName: settings?.product_name || 'My Product',
    modules: modules.map((m) => {
      const mod = rowToModule(m);
      mod.features = features.filter((f) => f.module_id === m.id).map((f) => rowToFeature(f));
      return mod;
    })
  };
  return result;
}

export function getModule(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
  if (!row) return null;
  const features = db.prepare('SELECT * FROM features WHERE module_id = ?').all(id);
  return {
    id: row.id,
    name: row.name,
    features: features.map(rowToFeature)
  };
}

export function getFeature(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM features WHERE id = ?').get(id);
  return row ? rowToFeature(row) : null;
}

export function resolveModule(moduleOrId) {
  const db = getDb();
  if (typeof moduleOrId === 'string') {
    const byId = db.prepare('SELECT * FROM modules WHERE id = ?').get(moduleOrId);
    if (byId) return getModule(byId.id);
    const byName = db.prepare('SELECT * FROM modules WHERE name = ?').get(moduleOrId);
    if (byName) return getModule(byName.id);
  }
  return getModule(moduleOrId?.id ?? moduleOrId);
}

export function ensureModule(name) {
  if (!name || typeof name !== 'string') return null;
  const db = getDb();
  const trimmed = name.trim();
  let row = db.prepare('SELECT * FROM modules WHERE name = ?').get(trimmed);
  if (row) return getModule(row.id);
  const id = uuid();
  db.prepare('INSERT INTO modules (id, name) VALUES (?, ?)').run(id, trimmed);
  return getModule(id);
}

export function ensureFeature(moduleId, name) {
  if (!name || typeof name !== 'string') return null;
  const mod = getModule(moduleId);
  if (!mod) return null;
  const db = getDb();
  const trimmed = name.trim();
  let row = db.prepare('SELECT * FROM features WHERE module_id = ? AND name = ?').get(moduleId, trimmed);
  if (row) return rowToFeature(row);
  const id = uuid();
  db.prepare(
    'INSERT INTO features (id, name, module_id, coverage, test_cases, tickets, bugs, automation) VALUES (?, ?, ?, 0, ?, ?, ?, ?)'
  ).run(id, trimmed, moduleId, '[]', '[]', '[]', '[]');
  return getFeature(id);
}

export function findFeatureByModuleAndName(moduleNameOrId, featureName) {
  const mod = resolveModule(moduleNameOrId);
  if (!mod) return null;
  return mod.features.find((f) => f.name === featureName.trim()) ?? null;
}

export function getProductTree() {
  const product = getProduct();
  const root = {
    name: product.productName,
    attributes: { type: 'product' },
    children: product.modules.map((mod) => ({
      name: mod.name,
      attributes: { type: 'module', moduleId: mod.id },
      children: mod.features.map((f) => {
        const childNodes = [
          ...(f.testCases ?? []).map((tc) => ({
            name: typeof tc === 'string' ? tc : tc.name,
            attributes: { type: 'testCase', automated: tc.automated ?? false }
          })),
          ...(f.tickets ?? []).map((t) => ({
            name: typeof t === 'string' ? t : t.key,
            attributes: { type: 'ticket' }
          })),
          ...(f.bugs ?? []).map((b) => ({
            name: typeof b === 'string' ? b : b.title ?? b.key,
            attributes: { type: 'bug' }
          }))
        ];
        return {
          name: f.name,
          attributes: {
            type: 'feature',
            featureId: f.id,
            moduleId: f.moduleId,
            coverage: f.coverage ?? 0,
            bugCount: (f.bugs ?? []).length
          },
          ...(childNodes.length > 0 ? { children: childNodes } : {})
        };
      })
    }))
  };
  return root;
}

export function updateFeatureTestCases(featureId, testCases) {
  const db = getDb();
  db.prepare('UPDATE features SET test_cases = ? WHERE id = ?').run(JSON.stringify(testCases), featureId);
}

export function updateFeatureTickets(featureId, tickets) {
  const db = getDb();
  db.prepare('UPDATE features SET tickets = ? WHERE id = ?').run(JSON.stringify(tickets), featureId);
}

export function updateFeatureBugs(featureId, bugs) {
  const db = getDb();
  db.prepare('UPDATE features SET bugs = ? WHERE id = ?').run(JSON.stringify(bugs), featureId);
}

export function updateFeatureAutomation(featureId, automation) {
  const db = getDb();
  db.prepare('UPDATE features SET automation = ? WHERE id = ?').run(JSON.stringify(automation), featureId);
}

export function updateFeatureCoverage(featureId, coverage) {
  const db = getDb();
  db.prepare('UPDATE features SET coverage = ? WHERE id = ?').run(Math.min(100, Math.max(0, coverage)), featureId);
}
