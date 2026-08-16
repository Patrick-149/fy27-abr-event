import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import scheduleRoutes from './routes/schedule.js';
import restaurantRoutes from './routes/restaurant.js';
import restroomRoutes from './routes/restrooms.js';
import registrationRoutes from './routes/registration.js';
import pocRoutes from './routes/poc.js';
import adminRoutes from './routes/admin.js';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = resolve(__dirname, '..', 'web', 'dist');

app.use(cors({
  origin: process.env.WEB_URL || '*',
  credentials: false
}));
app.use(morgan('tiny'));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/restrooms', restroomRoutes);
app.use('/api/register', registrationRoutes);
app.use('/api/poc', pocRoutes);
app.use('/api/admin', adminRoutes);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && fs.existsSync(distPath)) {
    res.sendFile(join(distPath, 'index.html'));
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FY27 ABR API listening on http://localhost:${PORT}`);
});
