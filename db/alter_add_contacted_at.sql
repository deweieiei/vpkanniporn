-- ============================================================
--  เพิ่มคอลัมน์ contacted_at ให้ตาราง contact_inquiries
--    contacted_at = เวลาที่ตัวแทนกด "ติดต่อกลับแล้ว"
--                   NULL = ยังไม่ติดต่อกลับ = รายการใหม่ (ขึ้น badge ที่ปุ่มฟันเฟือง)
--
--  ▶ ใช้เฉพาะกรณี "สร้างตาราง contact_inquiries ไปแล้ว" (รัน migration_contact_inquiries.sql ก่อนหน้านี้)
--    ถ้ายังไม่ได้สร้างตาราง → รัน migration_contact_inquiries.sql ตัวเต็มพอ (มีคอลัมน์นี้อยู่แล้ว) ไม่ต้องรันไฟล์นี้
--
--  วิธีรัน: phpMyAdmin → เลือก database → แท็บ SQL → วาง → Go
-- ============================================================

ALTER TABLE contact_inquiries
  ADD COLUMN contacted_at DATETIME NULL AFTER is_read;
