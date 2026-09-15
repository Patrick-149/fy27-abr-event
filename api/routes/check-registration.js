import { Router } from 'express';
import { getRegistrationsCollection } from '../db.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    
    const collection = getRegistrationsCollection();
    const normalizedEmail = email.trim().toLowerCase();
    
    const registration = await collection.findOne({ email: normalizedEmail });
    
    if (!registration) {
      return res.status(404).json({ 
        message: 'Email address not found in registration. Please complete the registration form first.' 
      });
    }
    
    res.json({
      fullName: registration.fullName,
      email: registration.email,
      dsp: registration.dsp,
      group: registration.group || '',
      table: registration.table || ''
    });
  } catch (err) {
    next(err);
  }
});

export default router;
