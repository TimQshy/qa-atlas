import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'sprints.json');

let state = {
  sprints: []
};

function getDefaultState() {
  return { sprints: [] };
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
    console.error('Error loading sprints:', err);
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
    console.error('Error saving sprints:', err);
  }
}

export function getSprints() {
  return [...state.sprints];
}

export function getSprint(id) {
  return state.sprints.find((s) => s.id === id) ?? null;
}

export function createSprint({ name, startDate, endDate, goal = '', affectedFolderIds = [], affectedItemIds = [], tags = [] }) {
  const sprint = {
    id: uuid(),
    name: (name ?? '').trim(),
    startDate: startDate || new Date().toISOString().slice(0, 10),
    endDate: endDate || null,
    goal: (goal ?? '').trim(),
    affectedFolderIds: Array.isArray(affectedFolderIds) ? affectedFolderIds : [],
    affectedItemIds: Array.isArray(affectedItemIds) ? affectedItemIds : [],
    tags: Array.isArray(tags) ? tags : []
  };
  state.sprints.push(sprint);
  return sprint;
}

export function updateSprint(id, patch) {
  const sprint = getSprint(id);
  if (!sprint) return null;
  if (patch.name !== undefined) sprint.name = String(patch.name).trim();
  if (patch.startDate !== undefined) sprint.startDate = patch.startDate;
  if (patch.endDate !== undefined) sprint.endDate = patch.endDate;
  if (patch.goal !== undefined) sprint.goal = String(patch.goal);
  if (patch.affectedFolderIds !== undefined) sprint.affectedFolderIds = Array.isArray(patch.affectedFolderIds) ? patch.affectedFolderIds : sprint.affectedFolderIds;
  if (patch.affectedItemIds !== undefined) sprint.affectedItemIds = Array.isArray(patch.affectedItemIds) ? patch.affectedItemIds : sprint.affectedItemIds;
  if (patch.tags !== undefined) sprint.tags = Array.isArray(patch.tags) ? patch.tags : sprint.tags;
  return sprint;
}
