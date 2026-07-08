-- ============================================================
--  เพิ่มคอลัมน์ purpose_other ให้ตาราง contact_inquiries
--    purpose_other = ข้อความที่ลูกค้ากรอกเมื่อเลือกวัตถุประสงค์ "อื่นๆ"
--
--  ▶ ใช้เฉพาะกรณี "สร้างตาราง contact_inquiries ไปแล้ว"
--    ถ้ายังไม่ได้สร้าง → รัน migration_contact_inquiries.sql ตัวเต็มพอ (มีคอลัมน์นี้แล้ว)
--
--  วิธีรัน: phpMyAdmin → เลือก database → แท็บ SQL → วาง → Go
-- ============================================================

ALTER TABLE contact_inquiries
  ADD COLUMN purpose_other VARCHAR(255) NULL AFTER purposes;
