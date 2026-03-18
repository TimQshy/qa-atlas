import express from 'express';
import cors from 'cors';
import { init } from './db/database.js';
import productRoutes from './routes/product.js';
import mutationRoutes from './routes/mutations.js';
import folderRoutes from './routes/folders.js';
import releaseRoutes from './routes/releases.js';
import sprintRoutes from './routes/sprints.js';

init();

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
