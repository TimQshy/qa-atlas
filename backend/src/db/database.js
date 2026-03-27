import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'qa-atlas.db');

let db = null;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
}

export function init() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    -- Product graph
    CREATE TABLE IF NOT EXISTS product_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      product_name TEXT NOT NULL DEFAULT 'My Product'
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      module_id TEXT NOT NULL REFERENCES modules(id),
      coverage INTEGER NOT NULL DEFAULT 0,
      test_cases TEXT NOT NULL DEFAULT '[]',
      tickets TEXT NOT NULL DEFAULT '[]',
      bugs TEXT NOT NULL DEFAULT '[]',
      automation TEXT NOT NULL DEFAULT '[]'
    );

    -- Folders & items
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      release_id TEXT
    );

    CREATE TABLE IF NOT EXISTS folder_comments (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL REFERENCES folders(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      scope_type TEXT,
      scope_id TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_id TEXT NOT NULL REFERENCES folders(id),
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'To Do',
      tags TEXT NOT NULL DEFAULT '[]',
      parent_id TEXT,
      tickets TEXT NOT NULL DEFAULT '[]',
      bugs TEXT NOT NULL DEFAULT '[]',
      release_id TEXT,
      is_stable INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_comments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      scope_type TEXT,
      scope_id TEXT
    );

    -- Releases
    CREATE TABLE IF NOT EXISTS releases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      parent_id TEXT,
      affected_folder_ids TEXT NOT NULL DEFAULT '[]',
      affected_item_ids TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS release_folder_overrides (
      release_id TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      name TEXT,
      parent_id TEXT,
      tags TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (release_id, folder_id)
    );

    INSERT OR IGNORE INTO product_settings (id, product_name) VALUES (1, 'My Product');
  `);

  // Sprint feature removed permanently
  db.exec(`DROP TABLE IF EXISTS sprints;`);

  ensureColumn('folders', 'release_id', 'TEXT');
  ensureColumn('items', 'release_id', 'TEXT');
  ensureColumn('items', 'is_stable', 'INTEGER NOT NULL DEFAULT 0');

  migrateFromJson();
  return db;
}

function migrateFromJson() {
  const productFile = path.join(DATA_DIR, 'product.json');
  const foldersFile = path.join(DATA_DIR, 'folders.json');
  const releasesFile = path.join(DATA_DIR, 'releases.json');

  const productCount = db.prepare('SELECT COUNT(*) as c FROM modules').get();
  if (productCount.c > 0) return;

  if (fs.existsSync(productFile)) {
    const data = JSON.parse(fs.readFileSync(productFile, 'utf-8'));
    db.prepare('UPDATE product_settings SET product_name = ? WHERE id = 1').run(data.productName || 'My Product');
    const insMod = db.prepare('INSERT OR IGNORE INTO modules (id, name) VALUES (?, ?)');
    const insFeat = db.prepare(
      'INSERT OR IGNORE INTO features (id, name, module_id, coverage, test_cases, tickets, bugs, automation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const mod of data.modules || []) {
      insMod.run(mod.id, mod.name);
      for (const f of mod.features || []) {
        const tc = JSON.stringify(f.testCases || []);
        const tk = JSON.stringify(f.tickets || []);
        const bg = JSON.stringify(f.bugs || []);
        const auto = JSON.stringify(f.automation || []);
        insFeat.run(f.id, f.name, f.moduleId, f.coverage ?? 0, tc, tk, bg, auto);
      }
    }
    console.log('Migrated product.json to SQLite');
  }

  const folderCount = db.prepare('SELECT COUNT(*) as c FROM folders').get();
  if (folderCount.c === 0 && fs.existsSync(foldersFile)) {
    const data = JSON.parse(fs.readFileSync(foldersFile, 'utf-8'));
    const insFolder = db.prepare('INSERT OR IGNORE INTO folders (id, name, parent_id, tags) VALUES (?, ?, ?, ?)');
    const insItem = db.prepare(
      'INSERT OR IGNORE INTO items (id, name, folder_id, description, status, tags, parent_id, tickets, bugs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insFc = db.prepare(
      'INSERT OR IGNORE INTO folder_comments (id, folder_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insIc = db.prepare(
      'INSERT OR IGNORE INTO item_comments (id, item_id, text, created_at, updated_at, scope_type, scope_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const f of data.folders || []) {
      insFolder.run(f.id, f.name, f.parentId || null, JSON.stringify(f.tags || []));
      for (const c of f.comments || []) {
        insFc.run(c.id, f.id, c.text || '', c.createdAt || new Date().toISOString(), c.updatedAt || null, c.scopeType || null, c.scopeId || null);
      }
    }
    for (const i of data.items || []) {
      insItem.run(
        i.id,
        i.name,
        i.folderId,
        i.description || '',
        i.status || 'To Do',
        JSON.stringify(i.tags || []),
        i.parentId || null,
        JSON.stringify(i.tickets || []),
        JSON.stringify(i.bugs || [])
      );
      for (const c of i.comments || []) {
        insIc.run(c.id, i.id, c.text || '', c.createdAt || new Date().toISOString(), c.updatedAt || null, c.scopeType || null, c.scopeId || null);
      }
    }
    console.log('Migrated folders.json to SQLite');
  }

  const releaseCount = db.prepare('SELECT COUNT(*) as c FROM releases').get();
  if (releaseCount.c === 0 && fs.existsSync(releasesFile)) {
    const data = JSON.parse(fs.readFileSync(releasesFile, 'utf-8'));
    const ins = db.prepare(
      'INSERT OR IGNORE INTO releases (id, name, date, parent_id, affected_folder_ids, affected_item_ids, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const r of data.releases || []) {
      ins.run(
        r.id,
        r.name,
        r.date || new Date().toISOString().slice(0, 10),
        r.parentId || null,
        JSON.stringify(r.affectedFolderIds || []),
        JSON.stringify(r.affectedItemIds || []),
        JSON.stringify(r.tags || [])
      );
    }
    console.log('Migrated releases.json to SQLite');
  }

}

function hasColumn(tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

export function close() {
  if (db) {
    db.close();
    db = null;
  }
}
