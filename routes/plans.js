const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PLAN_COVERS_DIR = path.join(PUBLIC_DIR, 'uploads', 'plans');
fs.mkdirSync(PLAN_COVERS_DIR, { recursive: true });

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

function userSubdir(userId) {
  const dir = path.join(PLAN_COVERS_DIR, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// แปลง web path (/uploads/plans/...) -> disk path ปลอดภัย ป้องกัน path traversal
function webPathToDisk(webPath) {
  if (typeof webPath !== 'string' || !webPath.startsWith('/uploads/plans/')) return null;
  const candidate = path.resolve(PUBLIC_DIR, '.' + webPath);
  if (!candidate.startsWith(PLAN_COVERS_DIR + path.sep)) return null;
  return candidate;
}
function safeUnlink(webPath) {
  const diskPath = webPathToDisk(webPath);
  if (!diskPath) return;
  fs.unlink(diskPath, (err) => {
    if (err && err.code !== 'ENOENT') console.warn('unlink failed:', diskPath, err.message);
  });
}
// multer เขียนไฟล์ลง disk ก่อน handler จะรันเสมอ — ต้องลบทิ้งถ้า validation fail ทีหลัง
// (บทเรียนจาก bug เดียวกันใน routes/auth.js PUT /profile — ดู AI_Memory/05_ทำแล้ว.txt รอบ 7)
function cleanupUploadedFile(req) {
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      if (err && err.code !== 'ENOENT') console.warn('cleanup upload failed:', req.file.path, err.message);
    });
  }
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => cb(null, userSubdir(req.session.userId)),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
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

const PLAN_SELECT = `
  SELECT p.id, p.user_id, p.title, p.summary, p.content_html,
         p.cover_image, p.is_active, p.view_count, p.created_at, p.updated_at,
         u.first_name AS agent_first_name, u.last_name AS agent_last_name, u.avatar_path AS agent_avatar_path
  FROM insurance_plans p
  JOIN users u ON u.id = p.user_id
`;

// GET /api/plans?category=slug&user_id=1  — list (public, เฉพาะ is_active)
router.get('/plans', async (req, res, next) => {
  try {
    const conditions = ['p.is_active = 1'];
    const params = [];
    if (req.query.user_id) {
      const uid = Number(req.query.user_id);
      if (!Number.isInteger(uid) || uid <= 0) {
        return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
      }
      conditions.push('p.user_id = ?');
      params.push(uid);
    }
    const [rows] = await pool.query(
      `${PLAN_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.created_at DESC`,
      params
    );
    res.json({ ok: true, plans: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans/mine — แบบประกันของตัวเอง (รวมที่ปิดใช้งาน) สำหรับหน้าจัดการ
router.get('/plans/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${PLAN_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, plans: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/plans/:id — รายละเอียด (public, นับ view)
router.get('/plans/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    }
    const [rows] = await pool.query(`${PLAN_SELECT} WHERE p.id = ? AND p.is_active = 1 LIMIT 1`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบแบบประกันนี้' });
    }
    pool.query('UPDATE insurance_plans SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {});
    res.json({ ok: true, plan: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans — สร้างใหม่
router.post('/plans', requireAuth, upload.single('cover_image'), async (req, res, next) => {
  try {
    const { title, summary, content_html } = req.body;

    if (!title || !title.trim()) {
      cleanupUploadedFile(req);
      return res.status(400).json({ error: 'กรุณากรอกชื่อแบบประกัน' });
    }

    const coverPath = req.file ? `/uploads/plans/${req.session.userId}/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO insurance_plans (user_id, title, summary, content_html, cover_image)
       VALUES (?, ?, ?, ?, ?)`,
      [req.session.userId, title.trim(), summary || null, content_html || null, coverPath]
    );

    const [rows] = await pool.query(`${PLAN_SELECT} WHERE p.id = ? LIMIT 1`, [result.insertId]);
    res.json({ ok: true, plan: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/plans/:id — แก้ไข (ต้องเป็นเจ้าของ)
router.put('/plans/:id', requireAuth, upload.single('cover_image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      cleanupUploadedFile(req);
      return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    }
    const [existing] = await pool.query('SELECT user_id, cover_image FROM insurance_plans WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      cleanupUploadedFile(req);
      return res.status(404).json({ error: 'ไม่พบแบบประกันนี้' });
    }
    if (existing[0].user_id !== req.session.userId) {
      cleanupUploadedFile(req);
      return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขแบบประกันนี้' });
    }

    const updates = {};
    if ('title' in req.body) {
      if (!req.body.title.trim()) {
        cleanupUploadedFile(req);
        return res.status(400).json({ error: 'กรุณากรอกชื่อแบบประกัน' });
      }
      updates.title = req.body.title.trim();
    }
    if ('summary' in req.body) updates.summary = req.body.summary || null;
    if ('content_html' in req.body) updates.content_html = req.body.content_html || null;
    if ('is_active' in req.body) updates.is_active = req.body.is_active === '1' || req.body.is_active === 'true' ? 1 : 0;

    let oldCoverToDelete = null;
    if (req.file) {
      updates.cover_image = `/uploads/plans/${req.session.userId}/${req.file.filename}`;
      if (existing[0].cover_image) oldCoverToDelete = existing[0].cover_image;
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      cleanupUploadedFile(req);
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องอัพเดต' });
    }
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => updates[k]);
    values.push(id);
    await pool.query(`UPDATE insurance_plans SET ${setClause} WHERE id = ?`, values);

    if (oldCoverToDelete) safeUnlink(oldCoverToDelete);

    const [rows] = await pool.query(`${PLAN_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
    res.json({ ok: true, plan: rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plans/:id — ลบ (ต้องเป็นเจ้าของ)
router.delete('/plans/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    }
    const [existing] = await pool.query('SELECT user_id, cover_image FROM insurance_plans WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'ไม่พบแบบประกันนี้' });
    }
    if (existing[0].user_id !== req.session.userId) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบแบบประกันนี้' });
    }
    await pool.query('DELETE FROM insurance_plans WHERE id = ?', [id]);
    if (existing[0].cover_image) safeUnlink(existing[0].cover_image);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
