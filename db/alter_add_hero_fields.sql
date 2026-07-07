-- ============================================================
--  Migration: เพิ่มฟิลด์ Hero ให้แต่ละตัวแทนแก้ข้อความ + ภาพพื้นหลังหน้าแรกได้เอง
--  (ส่วน "วางแผนวันนี้ เพื่ออนาคตที่คุณเลือกได้" ในหน้าโปรไฟล์)
--
--    hero_heading = หัวข้อใหญ่   (ถ้า NULL = ใช้ข้อความเดิมในหน้า)
--    hero_tagline = ข้อความรอง (Plan Today, Live Your Future)
--    hero_sub     = คำโปรยล่าง
--    hero_image   = ภาพพื้นหลัง hero 1 รูป (ถ้า NULL = ใช้ภาพปก/พื้นหลังเดิม)
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

ALTER TABLE users
  ADD COLUMN hero_heading VARCHAR(255) NULL,
  ADD COLUMN hero_tagline VARCHAR(255) NULL,
  ADD COLUMN hero_sub     VARCHAR(255) NULL,
  ADD COLUMN hero_image   VARCHAR(255) NULL;
