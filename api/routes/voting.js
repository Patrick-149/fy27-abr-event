import { Router } from 'express';
import { getRegistrationsCollection, getVotingGroupsCollection, getVotesCollection } from '../db.js';

const router = Router();

router.get('/config', async (req, res, next) => {
  try {
    const votingGroups = await getVotingGroupsCollection().findOne({ _id: 'config' });
    const groups = votingGroups?.groups || [];
    const enabled = votingGroups?.enabled || false;
    const timerEnd = votingGroups?.timerEnd || null;
    res.json({ groups, enabled, timerEnd });
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
    const config = await getVotingGroupsCollection().findOne({ _id: 'config' });
    if (!config?.enabled) {
      return res.status(403).json({ message: 'Voting is not available' });
    }
    if (config.timerEnd && new Date() > new Date(config.timerEnd)) {
      return res.status(403).json({ message: 'Voting has ended' });
    }
    const registration = await getRegistrationsCollection().findOne({ email: email.trim().toLowerCase() });
    if (!registration) {
      return res.status(400).json({ message: 'Email not found in registration list' });
    }
    const existingVote = await getVotesCollection().findOne({ email: email.trim().toLowerCase() });
    if (existingVote) {
      return res.status(400).json({ message: 'You have already voted' });
    }
    const group = config.groups.find((g) => g.id === groupId);
    if (!group) {
      return res.status(400).json({ message: 'Invalid group selection' });
    }
    await getVotesCollection().insertOne({
      email: email.trim().toLowerCase(),
      groupId,
      groupName: group.name,
      votedAt: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
