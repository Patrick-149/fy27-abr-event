import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { readJson, writeJson } from '../utils.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { fullName, email, country, dsp } = req.body || {};
    if (!fullName || !email || !country || !dsp) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const registrations = await readJson('registrations.json');
    const entry = {
      id: uuidv4(),
      fullName,
      email,
      country,
      dsp,
      createdAt: new Date().toISOString()
    };
    registrations.push(entry);
    await writeJson('registrations.json', registrations);
    res.status(201).json({ success: true, id: entry.id });
  } catch (err) {
    next(err);
  }
});

export default router;
