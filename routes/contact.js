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
  'อื่นๆ',
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
    // ข้อความ "อื่นๆ" — เก็บเฉพาะเมื่อเลือก "อื่นๆ" ไว้จริง
    const purposeOther = (purposes.includes('อื่นๆ') && b.purpose_other != null && String(b.purpose_other).trim())
      ? String(b.purpose_other).trim().slice(0, 255) : null;
    const budget = b.budget != null && String(b.budget).trim() ? String(b.budget).trim().slice(0, 100) : null;
    const note = b.note != null && String(b.note).trim() ? String(b.note).trim().slice(0, 2000) : null;
    const consent = b.consent === true || b.consent === 1 || b.consent === '1';

    // ตรวจข้อมูลบังคับ
    if (!fullName) return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
    if (!phone) return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์' });
    if (!/^[0-9+\-\s()]{6,30}$/.test(phone)) return res.status(400).json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return res.status(400).json({ error: 'กรุณาเลือกวันเดือนปีเกิด' });
    if (purposes.length === 0) return res.status(400).json({ error: 'กรุณาเลือกวัตถุประสงค์อย่างน้อย 1 ข้อ' });
    if (purposes.includes('อื่นๆ') && !purposeOther) return res.status(400).json({ error: 'กรุณาระบุวัตถุประสงค์ "อื่นๆ"' });
    if (!consent) return res.status(400).json({ error: 'กรุณายินยอมให้ติดต่อกลับก่อนส่งข้อมูล' });

    await pool.query(
      `INSERT INTO contact_inquiries
         (user_id, full_name, phone, birthdate, purposes, purpose_other, budget, note, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName.slice(0, 150), phone.slice(0, 30), birthdate, JSON.stringify(purposes), purposeOther, budget, note, consent ? 1 : 0]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== GET /api/contact/mine — เจ้าของ: รายการผู้ติดต่อของตัวเอง (รายการใหม่ = ยังไม่ติดต่อกลับ) =====
router.get('/contact/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, phone, birthdate, purposes, purpose_other, budget, note, consent, contacted_at, created_at
         FROM contact_inquiries WHERE user_id = ?
        ORDER BY (contacted_at IS NULL) DESC, created_at DESC`,
      [req.session.userId]
    );
    const newCount = rows.filter(r => r.contacted_at == null).length;
    res.json({ ok: true, inquiries: rows, total: rows.length, new_count: newCount });
  } catch (err) { next(err); }
});

// ===== POST /api/contact/:id/contacted — เจ้าของ: บันทึกว่า "ติดต่อกลับแล้ว" (หรือยกเลิกด้วย undo) =====
router.post('/contact/:id/contacted', requireAuth, express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT user_id FROM contact_inquiries WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของรายการนี้' });

    const undo = req.body && (req.body.undo === true || req.body.undo === 1 || req.body.undo === '1');
    if (undo) {
      await pool.query('UPDATE contact_inquiries SET contacted_at = NULL WHERE id = ?', [id]);
      return res.json({ ok: true, contacted_at: null });
    }
    await pool.query('UPDATE contact_inquiries SET contacted_at = NOW() WHERE id = ?', [id]);
    const [after] = await pool.query('SELECT contacted_at FROM contact_inquiries WHERE id = ? LIMIT 1', [id]);
    res.json({ ok: true, contacted_at: after[0].contacted_at });
  } catch (err) { next(err); }
});

module.exports = router;
