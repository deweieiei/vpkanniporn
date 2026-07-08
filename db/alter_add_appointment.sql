-- ============================================================
--  เพิ่มคอลัมน์รองรับ "นัดหมายออนไลน์" ให้ตาราง contact_inquiries
--    kind           = 'contact' (ติดต่อสอบถาม) หรือ 'appointment' (นัดหมาย)
--    appointment_at = วันเวลานัดหมายที่ลูกค้าเลือก (แสดงเด่นในหน้าแจ้งเตือน)
--
--  ▶ ใช้เฉพาะกรณี "สร้างตาราง contact_inquiries ไปแล้ว"
--    ถ้ายังไม่ได้สร้าง → รัน migration_contact_inquiries.sql ตัวเต็มพอ (มีคอลัมน์นี้แล้ว)
--
--  วิธีรัน: phpMyAdmin → เลือก database → แท็บ SQL → วาง → Go
-- ============================================================

ALTER TABLE contact_inquiries
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'contact' AFTER note,
  ADD COLUMN appointment_at DATETIME NULL AFTER kind;
