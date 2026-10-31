const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../services/database');

const router = express.Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 10 * 60 * 1000;
const sessions = new Map();
const resetRequests = new Map();
const USERS_FILE = path.join(__dirname, '../data/users.json');

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    console.error('Auth: failed to read users.json', err.message);
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeIdentifier(method, identifier) {
  const raw = String(identifier || '').trim();
  if (method === 'phone') return raw.replace(/\D/g, '').slice(-10);
  return raw.toLowerCase();
}

function validIdentifier(method, identifier) {
  if (method === 'phone') return /^[6-9]\d{9}$/.test(identifier);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(value)) return 'Password needs at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password needs at least one lowercase letter.';
  if (!/\d/.test(value)) return 'Password needs at least one number.';
  return '';
}

function hashPassword(password, saltHex = null) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return {
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
  };
}

function verifyPassword(password, user) {
  if (!user.passwordSalt || !user.passwordHash) return false;
  const candidate = hashPassword(password, user.passwordSalt).hash;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(user.passwordHash, 'hex')
    );
  } catch (_) {
    return false;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    method: user.method,
    identifier: user.identifier,
    createdAt: user.createdAt,
  };
}

function getToken(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function getSessionUser(req) {
  cleanExpired();
  const token = getToken(req);
  const session = token ? sessions.get(token) : null;
  if (!session) return null;

  const users = loadUsers();
  const user = users.find(u => u.id === session.userId);
  return user ? publicUser(user) : null;
}

function cleanExpired() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [token, reset] of resetRequests.entries()) {
    if (reset.expiresAt <= now) resetRequests.delete(token);
  }
}

function findUser(users, role, method, identifier) {
  return users.find(
    u => u.role === role && u.method === method && u.identifier === identifier
  );
}

function ensureDemoUsers() {
  const users = loadUsers();
  const demos = [
    {
      role: 'artisan',
      method: 'email',
      identifier: 'artisan@kalasetu.demo',
      name: 'Sunita Devi',
      password: 'KalaSetu@123',
    },
    {
      role: 'consumer',
      method: 'email',
      identifier: 'consumer@kalasetu.demo',
      name: 'Aarav Sharma',
      password: 'KalaSetu@123',
    },
    {
      role: 'artisan',
      method: 'phone',
      identifier: '9876543210',
      name: 'Sunita Devi',
      password: 'KalaSetu@123',
    },
    {
      role: 'consumer',
      method: 'phone',
      identifier: '9876543211',
      name: 'Aarav Sharma',
      password: 'KalaSetu@123',
    },
  ];

  let changed = false;
  for (const demo of demos) {
    if (!findUser(users, demo.role, demo.method, demo.identifier)) {
      const pw = hashPassword(demo.password);
      users.push({
        id: `${demo.role[0]}_${Date.now()}_${crypto.randomInt(100, 999)}`,
        name: demo.name,
        role: demo.role,
        method: demo.method,
        identifier: demo.identifier,
        passwordSalt: pw.salt,
        passwordHash: pw.hash,
        createdAt: new Date().toISOString(),
        isDemo: true,
      });
      changed = true;
    }
  }
  if (changed) saveUsers(users);
}

ensureDemoUsers();

router.get('/config', (req, res) => {
  res.json({
    mode: 'password',
    forgotPassword: 'reset-link-demo',
    passwordPolicy: {
      minLength: 8,
      uppercase: true,
      lowercase: true,
      number: true,
    },
  });
});

router.post('/signup', async (req, res) => {
  const role =
    req.body.role === 'artisan'
      ? 'artisan'
      : req.body.role === 'consumer'
      ? 'consumer'
      : null;

  const method =
    req.body.method === 'phone'
      ? 'phone'
      : req.body.method === 'email'
      ? 'email'
      : null;

  const name = String(req.body.name || '').trim();
  const identifier = method
    ? normalizeIdentifier(method, req.body.identifier)
    : '';
  const password = String(req.body.password || '');

  if (!role || !method) {
    return res.status(400).json({ error: 'Choose Artisan/Consumer and Phone/Email.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!validIdentifier(method, identifier)) {
    return res.status(400).json({
      error:
        method === 'phone'
          ? 'Enter a valid 10-digit Indian mobile number.'
          : 'Enter a valid email address.',
    });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const users = loadUsers();
  if (findUser(users, role, method, identifier)) {
    return res.status(409).json({
      error: 'An account already exists for this role and login ID. Please sign in.',
    });
  }

  const pw = hashPassword(password);
  const user = {
    id: `${role[0]}_${Date.now()}`,
    name,
    role,
    method,
    identifier,
    passwordSalt: pw.salt,
    passwordHash: pw.hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  try {
    await db.upsertProfile(publicUser(user));
  } catch (err) {
    console.warn('Profile database sync skipped:', err.message);
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.status(201).json({
    success: true,
    token,
    expiresInSeconds: SESSION_TTL_MS / 1000,
    user: publicUser(user),
  });
});

router.post('/login', async (req, res) => {
  cleanExpired();

  const role =
    req.body.role === 'artisan'
      ? 'artisan'
      : req.body.role === 'consumer'
      ? 'consumer'
      : null;

  const method =
    req.body.method === 'phone'
      ? 'phone'
      : req.body.method === 'email'
      ? 'email'
      : null;

  const identifier = method
    ? normalizeIdentifier(method, req.body.identifier)
    : '';
  const password = String(req.body.password || '');

  if (!role || !method || !validIdentifier(method, identifier) || !password) {
    return res.status(400).json({ error: 'Enter your login ID and password.' });
  }

  const users = loadUsers();
  const user = findUser(users, role, method, identifier);

  // Same response for missing user and wrong password avoids account enumeration.
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({
      error: 'Incorrect login details. Check your role, phone/email and password.',
    });
  }

  try {
    await db.upsertProfile(publicUser(user));
  } catch (err) {
    console.warn('Profile database sync skipped:', err.message);
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.json({
    success: true,
    token,
    expiresInSeconds: SESSION_TTL_MS / 1000,
    user: publicUser(user),
  });
});

router.post('/forgot-password', (req, res) => {
  cleanExpired();

  const role =
    req.body.role === 'artisan'
      ? 'artisan'
      : req.body.role === 'consumer'
      ? 'consumer'
      : null;

  const method =
    req.body.method === 'phone'
      ? 'phone'
      : req.body.method === 'email'
      ? 'email'
      : null;

  const identifier = method
    ? normalizeIdentifier(method, req.body.identifier)
    : '';

  if (!role || !method || !validIdentifier(method, identifier)) {
    return res.status(400).json({ error: 'Enter your registered phone number or email.' });
  }

  const users = loadUsers();
  const user = findUser(users, role, method, identifier);

  // Generic response keeps account existence private.
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account matches these details, password recovery can continue.',
      available: false,
    });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  resetRequests.set(resetToken, {
    userId: user.id,
    expiresAt: Date.now() + RESET_TTL_MS,
  });

  // SIH/local prototype: token is passed directly to the frontend and is NOT shown.
  // Production: email/SMS a reset URL containing the token instead.
  res.json({
    success: true,
    available: true,
    resetToken,
    expiresInSeconds: RESET_TTL_MS / 1000,
    delivery: 'local-demo',
    message: 'Recovery verified for this prototype. Create a new password.',
  });
});

router.post('/reset-password', (req, res) => {
  cleanExpired();

  const resetToken = String(req.body.resetToken || '').trim();
  const newPassword = String(req.body.newPassword || '');
  const passwordError = validatePassword(newPassword);

  if (!resetToken) {
    return res.status(400).json({ error: 'Reset session is missing. Start Forgot Password again.' });
  }
  if (passwordError) return res.status(400).json({ error: passwordError });

  const reset = resetRequests.get(resetToken);
  if (!reset || reset.expiresAt <= Date.now()) {
    resetRequests.delete(resetToken);
    return res.status(401).json({ error: 'Password reset session expired. Please try again.' });
  }

  const users = loadUsers();
  const user = users.find(u => u.id === reset.userId);
  if (!user) {
    resetRequests.delete(resetToken);
    return res.status(404).json({ error: 'Account was not found.' });
  }

  const pw = hashPassword(newPassword);
  user.passwordSalt = pw.salt;
  user.passwordHash = pw.hash;
  user.passwordUpdatedAt = new Date().toISOString();
  saveUsers(users);

  resetRequests.delete(resetToken);

  // Revoke old sessions for the account.
  for (const [token, session] of sessions.entries()) {
    if (session.userId === user.id) sessions.delete(token);
  }

  res.json({
    success: true,
    message: 'Password changed successfully. You can now sign in.',
  });
});

router.get('/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
  res.json({ user, database: db.status() });
});

router.post('/logout', (req, res) => {
  const token = getToken(req);
  if (token) sessions.delete(token);
  res.json({ success: true });
});

router.getSessionUser = getSessionUser;
module.exports = router;
