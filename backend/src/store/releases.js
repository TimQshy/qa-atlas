import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'releases.json');

let state = {
  releases: []
};

function getDefaultState() {
  return { releases: [] };
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
    console.error('Error loading releases:', err);
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
    console.error('Error saving releases:', err);
  }
}

export function getReleases() {
  return [...state.releases];
}

export function getRelease(id) {
  return state.releases.find((r) => r.id === id) ?? null;
}

export function createRelease({ name, date, affectedFolderIds = [], affectedItemIds = [], tags = [] }) {
  const release = {
    id: uuid(),
    name: (name ?? '').trim(),
    date: date || new Date().toISOString().slice(0, 10),
    affectedFolderIds: Array.isArray(affectedFolderIds) ? affectedFolderIds : [],
    affectedItemIds: Array.isArray(affectedItemIds) ? affectedItemIds : [],
    tags: Array.isArray(tags) ? tags : []
  };
  state.releases.push(release);
  return release;
}

export function updateRelease(id, patch) {
  const release = getRelease(id);
  if (!release) return null;
  if (patch.name !== undefined) release.name = String(patch.name).trim();
  if (patch.date !== undefined) release.date = patch.date;
  if (patch.affectedFolderIds !== undefined) release.affectedFolderIds = Array.isArray(patch.affectedFolderIds) ? patch.affectedFolderIds : release.affectedFolderIds;
  if (patch.affectedItemIds !== undefined) release.affectedItemIds = Array.isArray(patch.affectedItemIds) ? patch.affectedItemIds : release.affectedItemIds;
  if (patch.tags !== undefined) release.tags = Array.isArray(patch.tags) ? patch.tags : release.tags;
  return release;
}
