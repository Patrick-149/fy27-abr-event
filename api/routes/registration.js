import { Router } from 'express';
import { getRegistrationsCollection } from '../db.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { fullName, email, country, dsp } = req.body || {};
    if (!fullName || !email || !country || !dsp) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const collection = getRegistrationsCollection();
    const entry = { fullName, email, country, dsp, createdAt: new Date() };
    const { insertedId } = await collection.insertOne(entry);
    res.status(201).json({ success: true, id: insertedId.toString() });
  } catch (err) {
    next(err);
  }
});

export default router;
