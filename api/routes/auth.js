import { Router } from 'express';
import { generateToken } from '../auth.js';

const router = Router();

function loginHandler(expectedUsername, expectedPassword, role) {
  return (req, res) => {
    const { username, password } = req.body || {};
    if (username !== expectedUsername || password !== expectedPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = { name: username, role, username };
    const token = generateToken(user);
    res.json({ token, user });
  };
}

router.post('/login', loginHandler(process.env.ATTENDEE_USERNAME, process.env.ATTENDEE_PASSWORD, 'attendee'));
router.post('/admin-login', loginHandler(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD, 'admin'));

export default router;
