-- ============================================================
--  สร้างบัญชี SupperAdmin (role = 'admin') — รันไฟล์นี้ไฟล์เดียวก็พอ
--  ใช้เมื่อ: สร้างตาราง users ไปแล้ว แต่ยังไม่มีบัญชี admin
--  วิธีรัน: phpMyAdmin -> เลือก database -> tab SQL -> วางทั้งหมด -> Go
--
--  ล็อกอินที่ /support-admin ด้วย   ชื่อผู้ใช้: admin   รหัสผ่าน: 1234
--  (password_hash = bcrypt ของ '1234' — เข้ารหัสแล้ว)
-- ============================================================

-- เผื่อ enum role ยังไม่มีค่า 'admin' (ปกติมีอยู่แล้ว รันซ้ำได้ ไม่เสียหาย)
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','agent','user','support_admin')
  NOT NULL DEFAULT 'user';

-- สร้างบัญชี admin ถ้ายังไม่มี (ถ้ามีอยู่แล้วจะข้าม ไม่ทับของเดิม)
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES ('admin', '$2a$10$8HXHIHfo6XK9qmxnTZzTKukDhwCwe2P750L7iswVTkGrBJs17Vx0.', 'Supper', 'Admin', 'admin', 1);

-- ── ถ้าเคยมี user 'admin' อยู่แล้วแต่ล็อกอินไม่ได้ (ลืมรหัส/รหัสไม่ตรง) ──
-- เอาคอมเมนต์ 3 บรรทัดล่างออก แล้วรัน เพื่อรีเซ็ตให้เป็น role admin + รหัส 1234:
-- UPDATE users
--   SET password_hash = '$2a$10$8HXHIHfo6XK9qmxnTZzTKukDhwCwe2P750L7iswVTkGrBJs17Vx0.',
--       role = 'admin', is_active = 1
--   WHERE email = 'admin';

-- ตรวจผลลัพธ์
SELECT id, email, role, is_active FROM users WHERE email = 'admin';
