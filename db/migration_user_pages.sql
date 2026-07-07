-- ============================================================
--  Migration: user_pages — ปุ่ม/หน้าที่ตัวแทนแต่ละคนสร้างเองได้
--  (ส่วน "เลือกแผนที่เหมาะกับคุณ" ในโปรไฟล์ของแต่ละ user)
--
--  1 แถว = 1 ปุ่ม = 1 หน้า
--    button_text  = ข้อความบนปุ่ม
--    button_image = รูปบนปุ่ม (path เช่น /uploads/userpages/xxx.jpg)
--    content      = เนื้อหาในหน้าที่เปิดเมื่อกดปุ่ม (เจ้าของแก้ผ่าน toolbar ได้)
--  จำนวนปุ่มของ user = จำนวนแถวที่ user_id นั้นมี (เพิ่มได้ไม่จำกัด)
--
--  วิธีรัน: phpMyAdmin -> เลือก database -> tab SQL -> วางทั้งหมด -> Go
--  ต้องมีตาราง users อยู่ก่อน (รัน db/schema.sql แล้ว)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_pages (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,          -- เจ้าของปุ่ม/หน้า (ตัวแทน)
  button_text  VARCHAR(120) NOT NULL,          -- ข้อความบนปุ่ม
  button_image VARCHAR(255) NULL,              -- รูปบนปุ่ม (path)
  content      MEDIUMTEXT   NULL,              -- เนื้อหาในหน้า (เปิดเมื่อกดปุ่ม)
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_pages_user (user_id, sort_order),
  CONSTRAINT fk_user_pages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
