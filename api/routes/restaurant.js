import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readJson } from '../utils.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await readJson('restaurant.json');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/menu', async (req, res, next) => {
  try {
    const data = await readJson('restaurant.json');
    if (!data.menuFile) {
      return res.status(404).json({ message: 'No menu uploaded' });
    }
    const filePath = join(process.cwd(), 'uploads', 'menus', data.menuFile);
    const file = await readFile(filePath);
    const ext = data.menuFile.split('.').pop().toLowerCase();
    const contentType =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === 'xls'
        ? 'application/vnd.ms-excel'
        : 'application/octet-stream';
    res.setHeader('Content-Disposition', `attachment; filename="${data.menuName || 'menu'}"`);
    res.setHeader('Content-Type', contentType);
    res.send(file);
  } catch (err) {
    next(err);
  }
});

export default router;
