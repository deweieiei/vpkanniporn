require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cors = require('cors');

const { pool, ping } = require('./db/pool');

// ===== Session store (MySQL — ไม่ใช้ MemoryStore) =====
// เหตุผล: MemoryStore เก็บ session ไว้ใน RAM ของ process เดียว
// พอ process restart (deploy ใหม่, crash, หรือ `node --watch` ตอน dev) session หายหมด
// ผู้ใช้ต้อง login ใหม่ทั้งที่ cookie ยังไม่หมดอายุ (30 วัน)
// ใช้ pool เดิมจาก db/pool.js เพื่อไม่ต้องเปิด connection ซ้ำ
const sessionStore = new MySQLStore(
  {
    expiration: 30 * 24 * 60 * 60 * 1000, // ตรงกับ cookie.maxAge ด้านล่าง
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
  },
  pool
);
// ป้องกัน process crash ถ้า DB ต่อไม่ได้ตอน boot (EventEmitter 'error' ที่ไม่มี listener ทำให้ Node throw)
sessionStore.on('error', (err) => {
  console.warn('[session-store]', err.message);
});

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// ===== Trust proxy (เผื่อรันหลัง reverse proxy เช่น Plesk/Nginx) =====
app.set('trust proxy', 1);

// ===== CORS (ใช้เฉพาะกรณีมี frontend คนละ origin) =====
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
}

// ===== Body parsers =====
// auth.js mount express.json() per-route สำหรับ login เพื่อไม่ให้ชน multer ใน register
app.use(express.urlencoded({ extended: true }));

// ===== Session (cookie name 'fwd.sid' ตรงกับ res.clearCookie ใน auth.js) =====
app.use(
  session({
    name: 'fwd.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-me-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 วัน
      httpOnly: true,
      secure: IS_PROD, // production ใช้ HTTPS เท่านั้น
      sameSite: 'lax',
    },
  })
);

// ===== Static files (public/) =====
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: IS_PROD ? '1h' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// ===== Health checks =====
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: Date.now() });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await ping();
    res.json({ ok: true, db: 'reachable' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== API Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// ===== HTML Pages =====
app.use('/', require('./routes/pages'));

// ===== 404 (fall through to landing page สำหรับ unknown path) =====
app.use((req, res) => {
  // path /api/* ที่ไม่เจอ → ส่ง JSON 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'ไม่พบ endpoint นี้' });
  }
  // path อื่นๆ → ส่งหน้าแรก (SPA-style fallback)
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== Error handler =====
app.use((err, req, res, _next) => {
  // multer file size error
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'ไฟล์ใหญ่เกิน 5MB' });
  }

  console.error('[ERROR]', req.method, req.path, '-', err.message);
  if (res.headersSent) return;

  res.status(err.status || 500).json({
    error: IS_PROD ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : err.message,
  });
});

// ===== Graceful shutdown =====
async function shutdown(signal) {
  console.log(`\n[${signal}] กำลังปิดเซิร์ฟเวอร์...`);
  try {
    await sessionStore.close(); // หยุด timer เคลียร์ session หมดอายุ (ไม่ปิด pool เพราะใช้ pool ร่วมกับ query อื่น)
  } catch (e) {
    console.warn('ปิด session store ผิดพลาด:', e.message);
  }
  try {
    await pool.end();
    console.log('✓ ปิด MySQL pool แล้ว');
  } catch (e) {
    console.warn('ปิด pool ผิดพลาด:', e.message);
  }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ===== Start =====
app.listen(PORT, () => {
  console.log(`\n✓ FWD Agent Office (${process.env.NODE_ENV || 'development'})`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → DB: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306} / ${process.env.DB_NAME || '(unset)'}`);
});
