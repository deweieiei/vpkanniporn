const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

// วัตถุประสงค์ที่อนุญาต (ตรงกับ checkbox ในฟอร์ม) — กันค่าแปลกปลอมหลุดเข้า DB
const ALLOWED_PURPOSES = [
  'คุ้มครองชีวิต',
  'ค่ารักษาพยาบาล',
  'โรคร้ายแรง',
  'สะสมทรัพย์',
  'วางแผนเกษียณ',
  'ลดหย่อนภาษี',
  'วางแผนมรดก',
];

// ===== POST /api/contact — สาธารณะ: ผู้สนใจกรอกฟอร์มติดต่อถึงตัวแทน =====
router.post('/contact', express.json(), async (req, res, next) => {
  try {
    const b = req.body || {};

    const userId = Number(b.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'ไม่พบตัวแทนปลายทาง' });
    }
    // ตรวจว่าตัวแทนมีจริงและเปิดใช้งาน
    const [u] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
    if (u.length === 0) return res.status(404).json({ error: 'ไม่พบตัวแทนรายนี้' });

    const fullName = String(b.full_name || '').trim();
    const phone = String(b.phone || '').trim();
    const birthdate = String(b.birthdate || '').trim();
    const purposes = Array.isArray(b.purposes)
      ? b.purposes.filter(p => ALLOWED_PURPOSES.includes(p))
      : [];
    const budget = b.budget != null && String(b.budget).trim() ? String(b.budget).trim().slice(0, 100) : null;
    const note = b.note != null && String(b.note).trim() ? String(b.note).trim().slice(0, 2000) : null;
    const consent = b.consent === true || b.consent === 1 || b.consent === '1';

    // ตรวจข้อมูลบังคับ
    if (!fullName) return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
    if (!phone) return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์' });
    if (!/^[0-9+\-\s()]{6,30}$/.test(phone)) return res.status(400).json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return res.status(400).json({ error: 'กรุณาเลือกวันเดือนปีเกิด' });
    if (purposes.length === 0) return res.status(400).json({ error: 'กรุณาเลือกวัตถุประสงค์อย่างน้อย 1 ข้อ' });
    if (!consent) return res.status(400).json({ error: 'กรุณายินยอมให้ติดต่อกลับก่อนส่งข้อมูล' });

    await pool.query(
      `INSERT INTO contact_inquiries
         (user_id, full_name, phone, birthdate, purposes, budget, note, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName.slice(0, 150), phone.slice(0, 30), birthdate, JSON.stringify(purposes), budget, note, consent ? 1 : 0]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== GET /api/contact/mine — เจ้าของ: รายการผู้ติดต่อของตัวเอง (ไว้ต่อหน้าจัดการทีหลัง) =====
router.get('/contact/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, phone, birthdate, purposes, budget, note, consent, is_read, created_at
         FROM contact_inquiries WHERE user_id = ? ORDER BY created_at DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, inquiries: rows });
  } catch (err) { next(err); }
});

module.exports = router;
