const express = require('express');
const router = express.Router();
const db = require('../services/database');
const authRouter = require('./auth');

function requireConsumer(req, res) {
  const user = authRouter.getSessionUser ? authRouter.getSessionUser(req) : null;
  if (!user) {
    res.status(401).json({ error: 'Login required.' });
    return null;
  }
  if (user.role !== 'consumer') {
    res.status(403).json({ error: 'Consumer account required.' });
    return null;
  }
  return user;
}

router.get('/', async (req, res) => {
  try {
    const user = requireConsumer(req, res);
    if (!user) return;
    const preferences = await db.getConsumerPreferences(user.id);
    res.json({ preferences, database: db.status() });
  } catch (err) {
    res.status(500).json({ error: 'Could not load preferences.', message: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const user = requireConsumer(req, res);
    if (!user) return;

    const preferences = await db.saveConsumerPreferences(user.id, req.body || {});
    res.json({ success: true, preferences, database: db.status() });
  } catch (err) {
    res.status(500).json({ error: 'Could not save preferences.', message: err.message });
  }
});

module.exports = router;
