import express from 'express';
import cors from 'cors';
import { load } from './store/graph.js';
import { load as loadFolders } from './store/folders.js';
import { load as loadReleases } from './store/releases.js';
import { load as loadSprints } from './store/sprints.js';
import productRoutes from './routes/product.js';
import mutationRoutes from './routes/mutations.js';
import folderRoutes from './routes/folders.js';
import releaseRoutes from './routes/releases.js';
import sprintRoutes from './routes/sprints.js';

load();
loadFolders();
loadReleases();
loadSprints();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/product', productRoutes);
app.use('/api', mutationRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/sprints', sprintRoutes);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`QA Atlas API running on http://localhost:${PORT}`);
});
