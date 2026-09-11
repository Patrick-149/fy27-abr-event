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

router.get('/qr', async (req, res, next) => {
  try {
    const data = await readJson('restaurant.json');
    if (!data.qrFile) {
      return res.status(404).json({ message: 'No QR code uploaded' });
    }
    const filePath = join(process.cwd(), 'uploads', 'qrcodes', data.qrFile);
    const file = await readFile(filePath);
    const ext = data.qrFile.split('.').pop().toLowerCase();
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    res.setHeader('Content-Disposition', `attachment; filename="${data.qrName || 'qrcode'}"`);
    res.setHeader('Content-Type', contentType);
    res.send(file);
  } catch (err) {
    next(err);
  }
});

export default router;
