import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'product.json');

let state = {
  productName: 'My Product',
  modules: []
};

function getDefaultState() {
  return {
    productName: 'My Product',
    modules: []
  };
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
    console.error('Error loading graph:', err);
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
    console.error('Error saving graph:', err);
  }
}

export function getProduct() {
  return { ...state };
}

export function getModule(id) {
  return state.modules.find(m => m.id === id);
}

export function getFeature(id) {
  for (const module of state.modules) {
    const feature = module.features.find(f => f.id === id);
    if (feature) return feature;
  }
  return null;
}

export function resolveModule(moduleOrId) {
  if (typeof moduleOrId === 'string') {
    const byId = state.modules.find(m => m.id === moduleOrId);
    if (byId) return byId;
    const byName = state.modules.find(m => m.name === moduleOrId);
    if (byName) return byName;
  }
  return getModule(moduleOrId);
}

export function ensureModule(name) {
  if (!name || typeof name !== 'string') return null;
  const existing = state.modules.find(m => m.name === name.trim());
  if (existing) return existing;
  const module = {
    id: uuid(),
    name: name.trim(),
    features: []
  };
  state.modules.push(module);
  return module;
}

export function ensureFeature(moduleId, name) {
  if (!name || typeof name !== 'string') return null;
  const mod = getModule(moduleId);
  if (!mod) return null;
  const existing = mod.features.find(f => f.name === name.trim());
  if (existing) return existing;
  const feature = {
    id: uuid(),
    name: name.trim(),
    moduleId,
    coverage: 0,
    testCases: [],
    tickets: [],
    bugs: [],
    automation: []
  };
  mod.features.push(feature);
  return feature;
}

export function findFeatureByModuleAndName(moduleNameOrId, featureName) {
  const mod = resolveModule(moduleNameOrId);
  if (!mod) return null;
  return mod.features.find(f => f.name === featureName.trim());
}

export function getProductTree() {
  const product = getProduct();
  const root = {
    name: product.productName,
    attributes: { type: 'product' },
    children: product.modules.map(mod => ({
      name: mod.name,
      attributes: { type: 'module', moduleId: mod.id },
      children: mod.features.map(f => {
        const childNodes = [
          ...(f.testCases ?? []).map(tc => ({
            name: typeof tc === 'string' ? tc : tc.name,
            attributes: { type: 'testCase', automated: tc.automated ?? false }
          })),
          ...(f.tickets ?? []).map(t => ({
            name: typeof t === 'string' ? t : t.key,
            attributes: { type: 'ticket' }
          })),
          ...(f.bugs ?? []).map(b => ({
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
