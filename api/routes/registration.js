import { Router } from 'express';
import { getRegistrationsCollection, getGroupsCollection } from '../db.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { fullName, email, dsp } = req.body || {};
    if (!fullName || !email || !dsp) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const collection = getRegistrationsCollection();
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if email already exists
    const existingRegistration = await collection.findOne({ email: normalizedEmail });
    if (existingRegistration) {
      return res.status(409).json({ message: 'This email address has already been registered.' });
    }
    
    const groupDoc = await getGroupsCollection().findOne({ dsp });
    const group = groupDoc?.group || '';
    const table = groupDoc?.table || '';
    const entry = { fullName, email: normalizedEmail, dsp, group, table, createdAt: new Date() };
    const { insertedId } = await collection.insertOne(entry);
    res.status(201).json({ success: true, id: insertedId.toString(), group, table });
  } catch (err) {
    next(err);
  }
});

export default router;
