-- ============================================================
--  ปรับตาราง contact_inquiries รองรับฟอร์ม "นัดปรึกษาออนไลน์" แบบใหม่
--    - birthdate เปลี่ยนเป็น NULL ได้ (โหมดนัดหมายไม่ต้องกรอกวันเกิด)
--    - line_id   = LINE ID ผู้นัด
--    - time_slot = ช่วงเวลาที่เลือก เช่น "09:00–10:00 น."
--    - channel   = ช่องทางนัด (โทรศัพท์ / LINE Call / Google Meet / Zoom)
--
--  ▶ ใช้เฉพาะกรณี "สร้างตาราง contact_inquiries ไปแล้ว"
--    ถ้ายังไม่ได้สร้าง → รัน migration_contact_inquiries.sql ตัวเต็มพอ (มีครบแล้ว)
--
--  หมายเหตุ: ต้องรัน alter_add_appointment.sql (kind, appointment_at) มาก่อนหน้านี้แล้ว
--  วิธีรัน: phpMyAdmin → เลือก database → แท็บ SQL → วาง → Go
-- ============================================================

ALTER TABLE contact_inquiries
  MODIFY COLUMN birthdate DATE NULL,
  ADD COLUMN line_id   VARCHAR(64) NULL AFTER phone,
  ADD COLUMN time_slot VARCHAR(30) NULL AFTER appointment_at,
  ADD COLUMN channel   VARCHAR(40) NULL AFTER time_slot;
