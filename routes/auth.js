const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const router = express.Router();

const AVATARS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
const COVERS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'covers');
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, file.fieldname === 'cover_images' ? COVERS_DIR : AVATARS_DIR);
  },
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

const profileUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover_images', maxCount: 6 },
]);

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const FULL_USER_COLUMNS = `
  id, email, first_name, last_name, birthdate, gender, province, avatar_path,
  role, is_active, created_at, updated_at,
  phone, position, company, branch, license_number, license_number_2,
  bio, quote, facebook_url, line_id, instagram_url, awards, cover_images
`;

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
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
      `SELECT ${FULL_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
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

// แก้ไขข้อมูลโปรไฟล์ (รองรับ avatar + 6 covers)
router.put('/profile', requireAuth, profileUpload, async (req, res, next) => {
  try {
    const allowed = [
      'first_name', 'last_name', 'birthdate', 'gender', 'province',
      'phone', 'position', 'company', 'branch',
      'license_number', 'license_number_2',
      'bio', 'quote',
      'facebook_url', 'line_id', 'instagram_url',
    ];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) {
        const v = req.body[k];
        updates[k] = v === '' ? null : v;
      }
    }

    if ('awards' in req.body) {
      try {
        const parsed = typeof req.body.awards === 'string'
          ? JSON.parse(req.body.awards)
          : req.body.awards;
        updates.awards = Array.isArray(parsed) ? JSON.stringify(parsed) : null;
      } catch (e) {
        return res.status(400).json({ error: 'awards ต้องเป็น JSON array' });
      }
    }

    // Avatar (single file)
    if (req.files && req.files.avatar && req.files.avatar[0]) {
      updates.avatar_path = `/uploads/avatars/${req.files.avatar[0].filename}`;
    }

    // Cover images (up to 6): keep existing + new uploads, max 6
    const hasNewCovers = !!(req.files && req.files.cover_images && req.files.cover_images.length > 0);
    const hasKeepInstruction = 'cover_images_keep' in req.body;

    if (hasNewCovers || hasKeepInstruction) {
      let kept = [];
      if (hasKeepInstruction) {
        try {
          const parsed = typeof req.body.cover_images_keep === 'string'
            ? JSON.parse(req.body.cover_images_keep)
            : req.body.cover_images_keep;
          kept = Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
        } catch (e) {
          return res.status(400).json({ error: 'cover_images_keep ต้องเป็น JSON array' });
        }
      }
      const newPaths = hasNewCovers
        ? req.files.cover_images.map(f => `/uploads/covers/${f.filename}`)
        : [];
      const merged = [...kept, ...newPaths].slice(0, 6);
      updates.cover_images = merged.length > 0 ? JSON.stringify(merged) : null;
    }

    if (updates.gender && !['male', 'female', 'other'].includes(updates.gender)) {
      return res.status(400).json({ error: 'เพศไม่ถูกต้อง' });
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องอัพเดต' });
    }

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(req.session.userId);

    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, values);

    const [rows] = await pool.query(
      `SELECT ${FULL_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [req.session.userId]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
