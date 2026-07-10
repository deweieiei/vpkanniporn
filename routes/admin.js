const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const router = express.Router();

// ===== สิทธิ์: SupperAdmin (role = 'admin') เท่านั้น =====
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  return res.status(403).json({ error: 'ต้องเข้าสู่ระบบเป็น SupperAdmin ก่อน' });
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ALLOWED_ROLES = ['agent', 'user', 'admin'];

const LIST_COLUMNS = `
  id, email, first_name, last_name, role, is_active,
  phone, province, position, avatar_path, created_at
`;

// GET /api/admin/users — รายชื่อผู้ใช้ทั้งหมด
router.get('/users', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${LIST_COLUMNS} FROM users ORDER BY created_at DESC`);
    res.json({ ok: true, users: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users — เพิ่มผู้ใช้ใหม่ (ตัวแทน)
router.post('/users', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const {
      email, password, first_name, last_name,
      phone, province, position, role,
    } = req.body || {};

    if (!isValidEmail(email)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    if (!first_name || !last_name) return res.status(400).json({ error: 'กรุณากรอกชื่อและนามสกุล' });

    const useRole = ALLOWED_ROLES.includes(role) ? role : 'agent';

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });

    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, province, position, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        email, hash, String(first_name).trim(), String(last_name).trim(),
        phone || null, province || null, position || null, useRole,
      ]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id — แก้ข้อมูลผู้ใช้ (+ เปลี่ยนรหัส/สถานะ/บทบาท ได้)
router.put('/users/:id', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const b = req.body || {};
    const updates = {};
    for (const k of ['first_name', 'last_name', 'phone', 'province', 'position']) {
      if (k in b) updates[k] = b[k] === '' ? null : b[k];
    }
    if ('role' in b) {
      if (!ALLOWED_ROLES.includes(b.role)) return res.status(400).json({ error: 'บทบาทไม่ถูกต้อง' });
      updates.role = b.role;
    }
    if ('is_active' in b) updates.is_active = b.is_active ? 1 : 0;
    if (b.password) {
      if (String(b.password).length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
      updates.password_hash = await bcrypt.hash(String(b.password), 10);
    }

    // กันปิดใช้งาน/ลดบทบาทตัวเอง จนล็อกตัวเองออกจากระบบ
    if (id === req.session.userId && (('is_active' in updates && !updates.is_active) || updates.role === 'agent' || updates.role === 'user')) {
      return res.status(400).json({ error: 'ห้ามปิดใช้งานหรือลดสิทธิ์บัญชีของตัวเอง' });
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' });

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(id);
    const [r] = await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, values);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== โหมดสวมสิทธิ์ (Impersonate) =====
// แอดมินเข้าดู/แก้ dashboard แทนผู้ใช้แต่ละคน โดยเก็บตัวตนแอดมินไว้ใน session เพื่อกลับมาได้

// POST /api/admin/impersonate/stop — ออกจากโหมดสวมสิทธิ์ กลับเป็นแอดมิน
// (ต้องประกาศก่อน /impersonate/:id ไม่งั้น 'stop' จะถูกจับเป็น :id)
// หมายเหตุ: ใช้ requireAdmin ไม่ได้ เพราะระหว่างสวมสิทธิ์ role ใน session เป็นของผู้ใช้
router.post('/impersonate/stop', async (req, res, next) => {
  try {
    if (!req.session || !req.session.adminId) {
      return res.status(400).json({ error: 'ไม่ได้อยู่ในโหมดดูแทนผู้ใช้' });
    }
    const [rows] = await pool.query(
      `SELECT id, email FROM users WHERE id = ? AND role = 'admin' AND is_active = 1 LIMIT 1`,
      [req.session.adminId]
    );
    if (rows.length === 0) {
      // บัญชีแอดมินเดิมถูกลบ/ระงับไปแล้ว — จบ session ทิ้งเพื่อความปลอดภัย
      return req.session.destroy(() => {
        res.clearCookie('fwd.sid');
        res.status(403).json({ error: 'บัญชีแอดมินไม่สามารถใช้งานได้แล้ว' });
      });
    }
    req.session.userId = rows[0].id;
    req.session.email = rows[0].email;
    req.session.role = 'admin';
    delete req.session.adminId;
    delete req.session.adminEmail;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/impersonate/:id — เข้าสู่โหมดดู dashboard แทนผู้ใช้คนนั้น
router.post('/impersonate/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    if (id === req.session.userId) {
      return res.status(400).json({ error: 'บัญชีนี้เป็นบัญชีของคุณเอง' });
    }

    const [rows] = await pool.query(
      'SELECT id, email, role FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const target = rows[0];
    if (target.role === 'admin') {
      return res.status(400).json({ error: 'ไม่สามารถเข้าดูบัญชี SupperAdmin ด้วยกันได้' });
    }

    // เก็บตัวตนแอดมินไว้ก่อนสลับ session เป็นผู้ใช้เป้าหมาย
    req.session.adminId = req.session.userId;
    req.session.adminEmail = req.session.email;
    req.session.userId = target.id;
    req.session.email = target.email;
    req.session.role = target.role;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id — ลบผู้ใช้
router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    if (id === req.session.userId) return res.status(400).json({ error: 'ห้ามลบบัญชีของตัวเอง' });

    const [r] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
