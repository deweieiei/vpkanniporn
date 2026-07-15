-- ============================================================
--  Migration: ตารางตั้งค่าเว็บ (key-value) สำหรับแอดมิน
--    home_featured_agent_id = id ตัวแทนที่จะโชว์ในส่วน "รู้จักที่ปรึกษาของคุณ" หน้า Home
--    (ว่าง = ใช้ข้อมูลค่าเริ่มต้นในไฟล์ home.html)
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go (รันซ้ำได้)
-- ============================================================

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(64) NOT NULL,
  setting_value TEXT        NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
  ('home_featured_agent_id', NULL);
