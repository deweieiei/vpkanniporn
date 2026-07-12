-- ============================================================
--  Migration: เพิ่มช่องทางโซเชียล TikTok และ X (Twitter) ให้ตัวแทน
--
--    tiktok_url = ลิงก์โปรไฟล์ TikTok (เช่น https://www.tiktok.com/@username)
--    x_url      = ลิงก์โปรไฟล์ X / Twitter (เช่น https://x.com/username)
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

ALTER TABLE users
  ADD COLUMN tiktok_url VARCHAR(255) NULL,
  ADD COLUMN x_url      VARCHAR(255) NULL;
