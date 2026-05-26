const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, full_name, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username และ password ห้ามว่าง' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'username นี้ถูกใช้แล้ว' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, email) VALUES (?, ?, ?, ?)',
      [username, hash, full_name || null, email || null]
    );

    req.session.userId = result.insertId;
    req.session.username = username;
    res.json({ ok: true, id: result.insertId, username });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก username และ password' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash, full_name FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'username หรือ password ไม่ถูกต้อง' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'username หรือ password ไม่ถูกต้อง' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ ok: true, id: user.id, username: user.username, full_name: user.full_name });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('fwd.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      id: req.session.userId,
      username: req.session.username,
    });
  }
  res.json({ authenticated: false });
});

module.exports = router;
