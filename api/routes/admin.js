import { Router } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { ObjectId } from 'mongodb';
import { authenticate, requireAdmin } from '../auth.js';
import { readJson, writeJson } from '../utils.js';
import { getRegistrationsCollection, getGroupsCollection } from '../db.js';

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

router.get('/registrations', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const collection = getRegistrationsCollection();
    const registrations = await collection.find().sort({ createdAt: -1 }).toArray();
    res.json(registrations.map((r) => ({
      id: r._id.toString(),
      fullName: r.fullName,
      email: r.email,
      dsp: r.dsp,
      group: r.group || '',
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/registrations/export', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const collection = getRegistrationsCollection();
    const rows = (await collection.find().sort({ createdAt: -1 }).toArray()).map((r) => ({
      'Full Name': r.fullName,
      'Email': r.email,
      'DSP': r.dsp,
      'Group': r.group || '',
      'Submitted At': r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
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

router.get('/groups', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const groups = await getGroupsCollection().find().toArray();
    res.json(groups.map((g) => ({
      id: g._id.toString(),
      dsp: g.dsp,
      group: g.group
    })));
  } catch (err) {
    next(err);
  }
});

router.put('/groups', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const valid = items.filter((item) => item.dsp && item.group);
    const collection = getGroupsCollection();
    const registrationsCollection = getRegistrationsCollection();
    for (const item of valid) {
      const dsp = item.dsp.trim();
      const group = item.group.trim();
      await collection.updateOne(
        { dsp },
        { $set: { group } },
        { upsert: true }
      );
      await registrationsCollection.updateMany(
        { dsp },
        { $set: { group } }
      );
    }
    const dspSet = new Set(valid.map((item) => item.dsp.trim()));
    await collection.deleteMany({ dsp: { $nin: [...dspSet] } });
    await registrationsCollection.updateMany(
      { dsp: { $nin: [...dspSet] } },
      { $set: { group: '' } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/registrations', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ message: 'No valid ids provided' });
    }
    await getRegistrationsCollection().deleteMany({ _id: { $in: objectIds } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/groups', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ message: 'No valid ids provided' });
    }
    const collection = getGroupsCollection();
    const docs = await collection.find({ _id: { $in: objectIds } }).toArray();
    const dspSet = new Set(docs.map((d) => d.dsp));
    await collection.deleteMany({ _id: { $in: objectIds } });
    if (dspSet.size > 0) {
      await getRegistrationsCollection().updateMany(
        { dsp: { $in: [...dspSet] } },
        { $set: { group: '' } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
