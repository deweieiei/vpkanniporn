const express = require('express');
const path = require('path');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/login');
}

function requireSupportAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  return res.redirect('/support-admin');
}

router.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/profile');
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// profile.html ถูกยุบรวมเข้า dashboard.html แล้ว (2026-07-03)
// dashboard.html เดี๋ยวนี้ทำหน้าที่ 2 โหมดในไฟล์เดียว ผ่าน URL:
//   /profile, /dashboard  → โหมดตัวเอง (ต้อง login, มีปุ่มแก้ไข)
//   /agent/:id            → โหมดดูคนอื่น (public, read-only)
router.get('/profile', requireAuth, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

router.get('/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

// ดูโปรไฟล์ตัวแทนคนอื่น (สาธารณะ ไม่ต้อง login)
router.get('/agent/:id', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

router.get('/search', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'search.html'));
});

// Phase 3: แบบประกัน (public, ไม่ต้อง login)
router.get('/plans', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'plans.html'));
});

router.get('/plans/:id', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'plan-detail.html'));
});

// SupperAdmin — หน้า login แยก + หน้าจัดการตัวแทน (เพิ่ม/แก้/ลบ ผู้ใช้)
router.get('/support-admin', (req, res) => {
  if (req.session && req.session.role === 'admin') return res.redirect('/support-admin/users');
  res.sendFile(path.join(PUBLIC_DIR, 'supperadmin-login.html'));
});

router.get('/support-admin/users', requireSupportAdmin, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'supperadmin-users.html'));
});

// back-compat: ลิงก์เก่า /support-admin/editor → หน้าจัดการตัวแทน
router.get('/support-admin/editor', (_req, res) => res.redirect('/support-admin/users'));

module.exports = router;
