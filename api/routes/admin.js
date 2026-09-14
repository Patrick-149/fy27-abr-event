import { Router } from 'express';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import multer from 'multer';
import xlsx from 'xlsx';
import { ObjectId } from 'mongodb';
import { authenticate, requireAdmin } from '../auth.js';
import { readJson, writeJson } from '../utils.js';
import { getRegistrationsCollection, getGroupsCollection, getVotingSessionsCollection, getVotesCollection, getRestaurantCollection } from '../db.js';

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

const qrUploadDir = join(process.cwd(), 'uploads', 'qrcodes');
mkdirSync(qrUploadDir, { recursive: true });

const qrUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, qrUploadDir),
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

router.get('/restaurant', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const collection = getRestaurantCollection();
    const data = await collection.findOne({});
    if (!data) {
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

router.put('/restaurant', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const collection = getRestaurantCollection();
    const { name, location, timing, qrFile, qrName } = req.body || {};
    const updateData = {
      name: name || '',
      location: location || '',
      timing: timing || '',
      qrFile: qrFile || '',
      qrName: qrName || ''
    };
    await collection.updateOne(
      {},
      { $set: updateData },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/restaurant/qr', authenticate, requireAdmin, qrUpload.single('qr'), async (req, res, next) => {
  try {
    const collection = getRestaurantCollection();
    const existing = await collection.findOne({});
    
    // Read file and convert to base64
    const fileData = readFileSync(req.file.path);
    const base64Data = fileData.toString('base64');
    const mimeType = req.file.mimetype;
    
    const updateData = {
      qrFile: `data:${mimeType};base64,${base64Data}`,
      qrName: req.file.originalname
    };
    
    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        { $set: updateData }
      );
    } else {
      await collection.insertOne({
        name: '',
        location: '',
        timing: '',
        ...updateData
      });
    }
    
    res.json({ success: true, qrFile: updateData.qrFile, qrName: req.file.originalname });
  } catch (err) {
    next(err);
  }
});

router.get('/restrooms', authenticate, requireAdmin, getData('restrooms.json'));
router.put('/restrooms', authenticate, requireAdmin, putData('restrooms.json'));

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
      table: r.table || '',
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
      'Table': r.table || '',
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
      group: g.group,
      table: g.table || ''
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
      const table = item.table ? item.table.trim() : '';
      await collection.updateOne(
        { dsp },
        { $set: { group, table } },
        { upsert: true }
      );
      await registrationsCollection.updateMany(
        { dsp },
        { $set: { group, table } }
      );
    }
    const dspSet = new Set(valid.map((item) => item.dsp.trim()));
    await collection.deleteMany({ dsp: { $nin: [...dspSet] } });
    await registrationsCollection.updateMany(
      { dsp: { $nin: [...dspSet] } },
      { $set: { group: '', table: '' } }
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
        { $set: { group: '', table: '' } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/voting-sessions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const sessions = await getVotingSessionsCollection().find().sort({ createdAt: -1 }).toArray();
    
    // Count votes for each session individually to ensure accuracy
    const sessionsWithCounts = await Promise.all(sessions.map(async (session) => {
      const sessionId = session._id.toString();
      const voteCount = await getVotesCollection().countDocuments({ sessionId });
      return {
        ...session,
        totalVotes: voteCount
      };
    }));
    
    res.json(sessionsWithCounts.map((s) => ({
      id: s._id.toString(),
      sessionDescription: s.sessionDescription,
      groups: s.groups,
      enabled: s.enabled,
      timerEnd: s.timerEnd,
      remainingMinutes: s.remainingMinutes,
      createdAt: s.createdAt,
      totalVotes: s.totalVotes
    })));
  } catch (err) {
    console.error('Voting sessions error:', err);
    next(err);
  }
});

router.post('/voting-sessions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { sessionDescription, groups } = req.body || {};
    if (!sessionDescription) {
      return res.status(400).json({ message: 'Session description is required' });
    }
    const session = {
      sessionDescription,
      groups: groups || [],
      enabled: false,
      timerEnd: null,
      createdAt: new Date()
    };
    const { insertedId } = await getVotingSessionsCollection().insertOne(session);
    res.json({ success: true, id: insertedId.toString() });
  } catch (err) {
    next(err);
  }
});

router.put('/voting-sessions/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessionDescription, groups, enabled } = req.body || {};
    const update = {};
    if (sessionDescription !== undefined) update.sessionDescription = sessionDescription;
    if (groups !== undefined) update.groups = groups;
    if (enabled !== undefined) update.enabled = !!enabled;
    await getVotingSessionsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/voting-sessions/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await getVotingSessionsCollection().deleteOne({ _id: new ObjectId(id) });
    await getVotesCollection().deleteMany({ sessionId: id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/voting-sessions/:id/timer', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durationMinutes, paused } = req.body || {};
    const duration = Number(durationMinutes) || 0;
    
    if (paused) {
      // Pause: clear timerEnd but store remaining time
      await getVotingSessionsCollection().updateOne(
        { _id: new ObjectId(id) },
        { $set: { timerEnd: null, remainingMinutes: duration } }
      );
      res.json({ success: true, timerEnd: null, remainingMinutes: duration });
    } else {
      // Start or continue: set timerEnd based on duration
      const timerEnd = duration > 0 ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
      await getVotingSessionsCollection().updateOne(
        { _id: new ObjectId(id) },
        { $set: { timerEnd, remainingMinutes: null } }
      );
      res.json({ success: true, timerEnd });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/voting-sessions/:id/reset', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await getVotesCollection().deleteMany({ sessionId: id });
    await getVotingSessionsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { timerEnd: null, remainingMinutes: null } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/voting-sessions/:id/reset-timer', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await getVotingSessionsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { timerEnd: null, remainingMinutes: null } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/voting-sessions/:id/results', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await getVotingSessionsCollection().findOne({ _id: new ObjectId(id) });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    const groups = session.groups || [];
    const votes = await getVotesCollection().find({ sessionId: id }).toArray();
    const voteCounts = new Map();
    votes.forEach((v) => {
      const count = voteCounts.get(v.groupId) || 0;
      voteCounts.set(v.groupId, count + 1);
    });
    const results = groups.map((g) => ({
      id: g.id,
      name: g.name,
      votes: voteCounts.get(g.id) || 0
    }));
    res.json({ results, timerEnd: session.timerEnd, totalVotes: votes.length });
  } catch (err) {
    next(err);
  }
});

router.get('/voting-sessions/:id/export', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await getVotingSessionsCollection().findOne({ _id: new ObjectId(id) });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    const votes = await getVotesCollection().find({ sessionId: id }).sort({ votedAt: 1 }).toArray();
    const groupMap = new Map((session.groups || []).map((g) => [g.id, g.description || '']));
    const rows = votes.map((v) => ({
      'Email': v.email,
      'Group': v.groupName,
      'Group Description': groupMap.get(v.groupId) || '',
      'Voted At': v.votedAt instanceof Date ? v.votedAt.toISOString() : v.votedAt
    }));
    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Votes');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="votes.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
