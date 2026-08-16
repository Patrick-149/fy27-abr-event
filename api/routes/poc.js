import { Router } from 'express';
import { readJson } from '../utils.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await readJson('poc.json');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
