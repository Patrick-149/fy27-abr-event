import { Router } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { authenticate, requireAdmin } from '../auth.js';
import { readJson, writeJson } from '../utils.js';

const router = Router();

const uploadDir = join(process.cwd(), 'uploads', 'schedules');
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

const menuUploadDir = join(process.cwd(), 'uploads', 'menus');
mkdirSync(menuUploadDir, { recursive: true });

const menuUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, menuUploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  })
});

function getData(file) {
  return async (req, res, next) => {
    try {
      const data = await readJson(file);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
}

function putData(file) {
  return async (req, res, next) => {
    try {
      await writeJson(file, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}

router.get('/schedule', authenticate, requireAdmin, getData('schedule.json'));
router.put('/schedule', authenticate, requireAdmin, putData('schedule.json'));

router.post('/schedule/upload', authenticate, requireAdmin, upload.single('schedule'), async (req, res, next) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const schedule = rows.slice(1).filter((r) => r.length >= 1).map((r, i) => ({
      id: `${i + 1}`,
      duration: String(r[0] ?? ''),
      topic: String(r[1] ?? ''),
      presenter: String(r[2] ?? '')
    }));
    await writeJson('schedule.json', schedule);
    res.json({ success: true, count: schedule.length, schedule });
  } catch (err) {
    next(err);
  }
});

router.get('/restaurant', authenticate, requireAdmin, getData('restaurant.json'));
router.put('/restaurant', authenticate, requireAdmin, putData('restaurant.json'));

router.post('/restaurant/menu', authenticate, requireAdmin, menuUpload.single('menu'), async (req, res, next) => {
  try {
    const restaurant = await readJson('restaurant.json');
    restaurant.menuFile = req.file.filename;
    restaurant.menuName = req.file.originalname;
    await writeJson('restaurant.json', restaurant);
    res.json({ success: true, menuFile: req.file.filename, menuName: req.file.originalname });
  } catch (err) {
    next(err);
  }
});

router.get('/restrooms', authenticate, requireAdmin, getData('restrooms.json'));
router.put('/restrooms', authenticate, requireAdmin, putData('restrooms.json'));

router.get('/poc', authenticate, requireAdmin, getData('poc.json'));
router.put('/poc', authenticate, requireAdmin, putData('poc.json'));

router.get('/registrations', authenticate, requireAdmin, getData('registrations.json'));

router.get('/registrations/export', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const rows = (await readJson('registrations.json')).map((r) => ({
      'Full Name': r.fullName,
      'Email': r.email,
      'Country': r.country,
      'DSP': r.dsp,
      'Submitted At': r.createdAt
    }));
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
