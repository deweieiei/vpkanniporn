-- ============================================================
--  Migration: บล็อกโพสต์ของตัวแทน (ฟีดแบบ Facebook — ไม่มีไลก์/คอมเมนต์)
--
--  ตัวแทนสร้างโพสต์ (ข้อความ + รูป) แล้วเลือกได้ว่าจะแสดงโพสต์ไหน
--  แสดงในหน้าโปรไฟล์ (ใต้ "เลือกแผนที่เหมาะกับคุณ")
--
--    user_id    = ตัวแทนเจ้าของโพสต์
--    content    = ข้อความโพสต์
--    image_path = รูปประกอบ 1 รูป (ไม่ใส่ก็ได้)
--    is_visible = แสดง(1)/ซ่อน(0) โพสต์นี้บนหน้าเว็บ
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_posts (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED  NOT NULL,
  content     TEXT          NULL,
  image_path  VARCHAR(255)  NULL,
  is_visible  TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agent_posts_user (user_id, created_at),
  CONSTRAINT fk_agent_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
