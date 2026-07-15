-- ============================================================
--  Migration: โพสต์ตัวแทนรองรับหลายรูป (ไม่จำกัด)
--
--    images = JSON array ของ path รูปในโพสต์ (เรียงตามลำดับที่แสดง)
--             เช่น ["/uploads/posts/a.jpg", "/uploads/posts/b.jpg", ...]
--    (คอลัมน์ image_path เดิมยังอยู่ = รูปแรก/รูปปก ใช้ย้อนหลังกับโพสต์เก่า)
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

ALTER TABLE agent_posts
  ADD COLUMN images JSON NULL AFTER image_path;
