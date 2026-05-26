const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('อนุญาตเฉพาะรูปภาพ (jpg/png/webp/gif)'));
  },
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', upload.single('avatar'), async (req, res, next) => {
  try {
    const {
      email, password, first_name, last_name,
      birthdate, gender, province,
    } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'password ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อและนามสกุล' });
    }
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.status(400).json({ error: 'เพศไม่ถูกต้อง' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
    }

    const hash = await bcrypt.hash(password, 10);
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO users
       (email, password_hash, first_name, last_name, birthdate, gender, province, avatar_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        hash,
        first_name.trim(),
        last_name.trim(),
        birthdate || null,
        gender || null,
        province || null,
        avatarPath,
      ]
    );

    req.session.userId = result.insertId;
    req.session.email = email;
    res.json({ ok: true, id: result.insertId, email });
  } catch (err) {
    next(err);
  }
});

router.post('/login', express.json(), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, avatar_path, is_active
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    res.json({
      ok: true,
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_path: user.avatar_path,
    });
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

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ authenticated: false });
    }
    const [rows] = await pool.query(
      `SELECT id, email, first_name, last_name, birthdate, gender, province, avatar_path, role
       FROM users WHERE id = ? LIMIT 1`,
      [req.session.userId]
    );
    if (rows.length === 0) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }
    res.json({ authenticated: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
