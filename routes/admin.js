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

// ===== เอาออกแล้ว 2026-07-16 (พี่ดิวสั่ง): ระบบ "หน้า Home — เลือกบัญชี + แก้ไขเนื้อหา" =====
//   ของเดิมที่เอาออก:
//     GET/PUT /api/admin/settings        → เลือกบัญชีที่เป็นหน้า Home (home_featured_agent_id)
//     POST    /api/admin/impersonate/:id → แอดมินสวมสิทธิ์บัญชีนั้นเพื่อไปกดแก้หน้า Home
//     POST    /api/admin/impersonate/stop
//   ทำไมถึงไม่ต้องใช้แล้ว:
//     หน้า Home ไม่ใช่ "โปรไฟล์ของบัญชีใดบัญชีหนึ่ง" อีกต่อไป — เป็นระบบบลอค (page_blocks)
//     SupperAdmin แก้หน้า Home ได้ตรงๆ ที่ / ด้วยสิทธิ์ตัวเอง ผ่าน /api/blocks
//     ไม่ต้องสวมสิทธิ์เป็นใครอีก (ปลอดภัยขึ้นด้วย — ไม่มีทางกลายเป็นผู้ใช้คนอื่นแล้ว)
//   ตัวแทนที่จะโชว์บนหน้าแรก → เลือกในบลอค 'agents' บนหน้า / ได้เลย

module.exports = router;
