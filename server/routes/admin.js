import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { fallbackStore } from '../data/fallbackStore.js';

const router = express.Router();

const isAdmin = (req) => req.user && req.user.email && req.user.email.toLowerCase() === (process.env.ADMIN_EMAIL || '').toLowerCase();

router.get('/overview', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    if (mongoose.connection.readyState === 1) {
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      const totalUsers = users.length;
      const totalLogins = users.reduce((sum, user) => sum + (user.loginCount || 0), 0);

      return res.json({
        totalUsers,
        totalLogins,
        users: users.map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          loginCount: user.loginCount || 0,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }))
      });
    }

    const users = fallbackStore.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      loginCount: user.loginCount || 0,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    }));

    return res.json({
      totalUsers: users.length,
      totalLogins: users.reduce((sum, user) => sum + (user.loginCount || 0), 0),
      users
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load admin overview.', error: error.message });
  }
});

export default router;
