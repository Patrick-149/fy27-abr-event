import { Router } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getRestaurantCollection } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const collection = getRestaurantCollection();
    const data = await collection.findOne({});
    if (!data) {
      // Return default structure if no data exists
      return res.json({ name: '', location: '', timing: '', qrFile: '', qrName: '' });
    }
    res.json({
      name: data.name || '',
      location: data.location || '',
      timing: data.timing || '',
      qrFile: data.qrFile || '',
      qrName: data.qrName || ''
    });
  } catch (err) {
    next(err);
  }
});

router.get('/qr', async (req, res, next) => {
  try {
    const collection = getRestaurantCollection();
    const data = await collection.findOne({});
    if (!data || !data.qrFile) {
      return res.status(404).json({ message: 'No QR code uploaded' });
    }
    
    // Check if qrFile is base64 data (starts with data:)
    if (data.qrFile.startsWith('data:')) {
      // Extract the base64 data and mime type
      const matches = data.qrFile.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return res.status(500).json({ message: 'Invalid QR code data format' });
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Use inline for display, attachment for download
      const isDisplay = req.query.display === 'true';
      res.setHeader('Content-Disposition', `${isDisplay ? 'inline' : 'attachment'}; filename="${data.qrName || 'qrcode'}"`);
      res.setHeader('Content-Type', mimeType);
      res.send(buffer);
    } else {
      // Fallback to file-based storage (for backward compatibility)
      const filePath = join(process.cwd(), 'uploads', 'qrcodes', data.qrFile);
      const file = await readFile(filePath);
      const ext = data.qrFile.split('.').pop().toLowerCase();
      const contentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
      const isDisplay = req.query.display === 'true';
      res.setHeader('Content-Disposition', `${isDisplay ? 'inline' : 'attachment'}; filename="${data.qrName || 'qrcode'}"`);
      res.setHeader('Content-Type', contentType);
      res.send(file);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
