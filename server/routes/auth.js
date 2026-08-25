import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { generateToken } from '../utils/token.js';
import { fallbackStore } from '../data/fallbackStore.js';

const router = express.Router();

const getSafeUser = (user) => ({
  id: user.id || user._id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  loginCount: user.loginCount || 0,
  lastLoginAt: user.lastLoginAt || null,
  preferences: user.preferences || { theme: 'dark', tone: 'friendly' }
});

const resolveAdminRole = (email, password) => {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (email && adminEmail && email.toLowerCase() === adminEmail) {
    if (!adminPassword || password === adminPassword) {
      return 'admin';
    }
  }

  return 'user';
};

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: resolveAdminRole(email, password),
        preferences: { theme: 'dark', tone: 'friendly' }
      });

      const token = generateToken(user);
      return res.status(201).json({
        token,
        user: getSafeUser(user)
      });
    }

    const existingUser = fallbackStore.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: `user_${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: resolveAdminRole(email, password),
      loginCount: 0,
      lastLoginAt: null,
      preferences: { theme: 'dark', tone: 'friendly' },
      createdAt: new Date()
    };

    fallbackStore.users.push(user);
    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: getSafeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to register user.', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLoginAt = new Date();
      user.role = user.role === 'admin' || resolveAdminRole(email, password) === 'admin' ? 'admin' : 'user';
      await user.save();

      const token = generateToken(user);
      return res.status(200).json({
        token,
        user: getSafeUser(user)
      });
    }

    const user = fallbackStore.users.find((record) => record.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLoginAt = new Date();
    user.role = user.role === 'admin' || resolveAdminRole(email, password) === 'admin' ? 'admin' : 'user';

    const token = generateToken(user);
    return res.status(200).json({
      token,
      user: getSafeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in.', error: error.message });
  }
});

export default router;
