import { Router } from 'express';
import { getRegistrationsCollection, getVotingSessionsCollection, getVotesCollection } from '../db.js';

const router = Router();

router.get('/config', async (req, res, next) => {
  try {
    const session = await getVotingSessionsCollection().findOne({ enabled: true, timerEnd: { $ne: null } });
    if (!session) {
      return res.json({ groups: [], enabled: false, timerEnd: null, sessionDescription: '' });
    }
    const now = new Date();
    const timerEnd = new Date(session.timerEnd);
    if (now > timerEnd) {
      return res.json({ groups: [], enabled: false, timerEnd: null, sessionDescription: '' });
    }
    res.json({
      groups: session.groups || [],
      enabled: session.enabled,
      timerEnd: session.timerEnd,
      sessionDescription: session.sessionDescription || ''
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit', async (req, res, next) => {
  try {
    const { email, groupId } = req.body || {};
    if (!email || !groupId) {
      return res.status(400).json({ message: 'Email and group selection are required' });
    }
    const session = await getVotingSessionsCollection().findOne({ enabled: true, timerEnd: { $ne: null } });
    if (!session) {
      return res.status(403).json({ message: 'Voting is not available' });
    }
    const now = new Date();
    const timerEnd = new Date(session.timerEnd);
    if (now > timerEnd) {
      return res.status(403).json({ message: 'Voting has ended' });
    }
    const registration = await getRegistrationsCollection().findOne({ email: email.trim().toLowerCase() });
    if (!registration) {
      return res.status(400).json({ message: 'Email not found in registration list' });
    }
    const existingVote = await getVotesCollection().findOne({ 
      email: email.trim().toLowerCase(),
      sessionId: session._id.toString()
    });
    if (existingVote) {
      return res.status(400).json({ message: 'You have already voted' });
    }
    const group = session.groups.find((g) => g.id === groupId);
    if (!group) {
      return res.status(400).json({ message: 'Invalid group selection' });
    }
    await getVotesCollection().insertOne({
      email: email.trim().toLowerCase(),
      groupId,
      groupName: group.name,
      sessionId: session._id.toString(),
      votedAt: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
