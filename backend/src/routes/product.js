import { Router } from 'express';
import { getProduct, getProductTree, load } from '../store/graph.js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.get('/', (req, res) => {
  res.json(getProduct());
});

router.get('/tree', (req, res) => {
  res.json(getProductTree());
});

router.get('/seed', (req, res) => {
  try {
    execSync('node src/seed.js', { cwd: path.join(__dirname, '../..') });
    load();
    res.json({ ok: true, message: 'Seeded mock data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
