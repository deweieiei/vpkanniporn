-- ============================================================
--  Migration: ภาพพื้นหลัง hero แยกตามอุปกรณ์ (device)
--
--  เดิม: cover_images (JSON) = สไลด์ภาพปกสูงสุด 6 ภาพ ใช้ทุกจอ
--  เพิ่ม: ภาพ "แทนที่" เฉพาะ iPad / มือถือ อย่างละ 1 รูป
--
--    cover_image_tablet = ภาพพื้นหลังสำหรับ iPad/แท็บเล็ต (แนวตั้ง) — ถ้า NULL ใช้สไลด์ desktop
--    cover_image_mobile = ภาพพื้นหลังสำหรับมือถือ (แนวตั้ง)        — ถ้า NULL ใช้สไลด์ desktop
--
--  ตรรกะแสดงผล (ในหน้า dashboard):
--    จอกว้าง (>1024px)  → ใช้สไลด์ cover_images (desktop) เหมือนเดิม
--    iPad (641–1024px)  → ถ้ามี cover_image_tablet ใช้รูปนั้น ไม่งั้น fallback สไลด์ desktop
--    มือถือ (<=640px)   → ถ้ามี cover_image_mobile ใช้รูปนั้น ไม่งั้น fallback สไลด์ desktop
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

ALTER TABLE users
  ADD COLUMN cover_image_tablet VARCHAR(255) NULL,
  ADD COLUMN cover_image_mobile VARCHAR(255) NULL;
