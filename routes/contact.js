const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

// วัตถุประสงค์ที่อนุญาต (โหมดติดต่อ) — กันค่าแปลกปลอมหลุดเข้า DB
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

// ช่วงเวลานัด (โหมดนัดหมาย): ค่าที่ส่งมา (เวลาเริ่ม) → ป้ายข้อความที่เก็บ/แสดง
const SLOT_LABELS = {
  '09:00': '09:00–10:00 น.',
  '10:00': '10:00–11:00 น.',
  '13:00': '13:00–14:00 น.',
  '14:00': '14:00–15:00 น.',
  '16:00': '16:00–17:00 น.',
  '19:00': '19:00–20:00 น.',
};
// ช่องทางนัด: ค่าที่ส่งมา → ป้ายข้อความ
const CHANNELS = {
  phone: '📞 โทรศัพท์',
  linecall: '💬 LINE Call',
  meet: '🎥 Google Meet',
  zoom: '💻 Zoom',
};

// ===== POST /api/contact — สาธารณะ: ฟอร์มติดต่อ (kind='contact') หรือ นัดหมาย (kind='appointment') =====
router.post('/contact', express.json(), async (req, res, next) => {
  try {
    const b = req.body || {};

    const userId = Number(b.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'ไม่พบตัวแทนปลายทาง' });
    const [u] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
    if (u.length === 0) return res.status(404).json({ error: 'ไม่พบตัวแทนรายนี้' });

    const kind = ['appointment', 'recruit'].includes(b.kind) ? b.kind : 'contact';
    const fullName = String(b.full_name || '').trim();
    const phone = String(b.phone || '').trim();
    const consent = b.consent === true || b.consent === 1 || b.consent === '1';
    const note = b.note != null && String(b.note).trim() ? String(b.note).trim().slice(0, 2000) : null;

    // ตรวจร่วมทั้งสองโหมด
    if (!fullName) return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
    if (!phone) return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์' });
    if (!/^[0-9+\-\s()]{6,30}$/.test(phone)) return res.status(400).json({ error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
    if (!consent) return res.status(400).json({ error: 'กรุณายินยอมก่อนส่งข้อมูล' });

    // ค่าที่จะบันทึก (ต่างกันตามโหมด)
    let lineId = null, birthdate = null, purposesJson = null, purposeOther = null,
        budget = null, appointmentAt = null, timeSlot = null, channel = null;

    if (kind === 'recruit') {
      // สมัครเป็นตัวแทน: ต้องการแค่ ชื่อ+เบอร์+ยินยอม (ตรวจไว้ด้านบนแล้ว) + LINE/หมายเหตุ (ไม่บังคับ)
      lineId = b.line_id != null && String(b.line_id).trim() ? String(b.line_id).trim().slice(0, 64) : null;
    } else if (kind === 'appointment') {
      lineId = b.line_id != null && String(b.line_id).trim() ? String(b.line_id).trim().slice(0, 64) : null;
      const date = String(b.appointment_date || '').trim();
      const slot = String(b.time_slot || '').trim();
      const ch = String(b.channel || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'กรุณาเลือกวันนัดหมาย' });
      if (!SLOT_LABELS[slot]) return res.status(400).json({ error: 'กรุณาเลือกเวลาที่สะดวก' });
      if (!CHANNELS[ch]) return res.status(400).json({ error: 'กรุณาเลือกช่องทางการนัดหมาย' });
      appointmentAt = `${date} ${slot}:00`;
      timeSlot = SLOT_LABELS[slot];
      channel = CHANNELS[ch];
    } else {
      birthdate = String(b.birthdate || '').trim();
      const purposes = Array.isArray(b.purposes) ? b.purposes.filter(p => ALLOWED_PURPOSES.includes(p)) : [];
      purposeOther = (purposes.includes('อื่นๆ') && b.purpose_other != null && String(b.purpose_other).trim())
        ? String(b.purpose_other).trim().slice(0, 255) : null;
      budget = b.budget != null && String(b.budget).trim() ? String(b.budget).trim().slice(0, 100) : null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return res.status(400).json({ error: 'กรุณาเลือกวันเดือนปีเกิด' });
      if (purposes.length === 0) return res.status(400).json({ error: 'กรุณาเลือกวัตถุประสงค์อย่างน้อย 1 ข้อ' });
      if (purposes.includes('อื่นๆ') && !purposeOther) return res.status(400).json({ error: 'กรุณาระบุวัตถุประสงค์ "อื่นๆ"' });
      purposesJson = JSON.stringify(purposes);
    }

    await pool.query(
      `INSERT INTO contact_inquiries
         (user_id, full_name, phone, line_id, birthdate, purposes, purpose_other, budget, note, kind, appointment_at, time_slot, channel, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName.slice(0, 150), phone.slice(0, 30), lineId, birthdate || null, purposesJson, purposeOther, budget, note, kind, appointmentAt, timeSlot, channel, consent ? 1 : 0]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== GET /api/contact/mine — เจ้าของ: รายการผู้ติดต่อของตัวเอง (รายการใหม่ = ยังไม่ติดต่อกลับ) =====
router.get('/contact/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, phone, line_id, birthdate, purposes, purpose_other, budget, note, kind, appointment_at, time_slot, channel, consent, contacted_at, created_at
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
