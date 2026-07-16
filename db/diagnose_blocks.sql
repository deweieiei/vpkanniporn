/* ============================================================
   ตรวจอาการ ระบบบลอค — อ่านอย่างเดียว ไม่แก้ไขอะไรทั้งสิ้น
   แก้ 2026-07-16: เลิกใช้ information_schema

   เดิมไฟล์นี้อ่านจาก information_schema แล้วเจอ
   #1044 Access denied for user 'vpkann_database'@'localhost'
   เพราะ HostAtom ไม่ให้ DB user อ่าน information_schema
   ตอนนี้เปลี่ยนมาใช้ SHOW ซึ่งใช้สิทธิ์ปกติ

   วิธีใช้: phpMyAdmin -> เลือก database -> แท็บ SQL -> วางทั้งไฟล์ -> Go
   ============================================================ */


/* 1) ตารางของระบบบลอค มีอะไรบ้าง (ควรเห็น page_blocks และ block_images) */
SHOW TABLES LIKE '%block%';


/* 2) คอลัมน์ user_id ยอมให้เป็น NULL ไหม
      ดูคอลัมน์ Null ต้องเป็น YES
      ถ้าเป็น NO แปลว่าตารางถูกสร้างด้วยไฟล์เวอร์ชันเก่า -> ต้องรัน repair_blocks.sql */
SHOW COLUMNS FROM page_blocks LIKE 'user_id';


/* 3) ตอนนี้มีบลอคอะไรอยู่บ้าง */
SELECT id, user_id, parent_id, type AS `ชนิดบลอค`, sort_order AS `ลำดับ`, is_visible AS `แสดง`,
       LEFT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.heading')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.text')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.button_text')), '-'), 40) AS `หัวข้อ`
FROM page_blocks ORDER BY id;


/* 4) บลอคอยู่ที่ user_id ไหนบ้าง
      ที่ถูกต้อง: บลอคหน้าแรกต้องเป็น NULL ทั้งหมด
      ถ้าเห็นตัวเลข (เช่น 4) แปลว่าผูกกับบัญชี admin ผิด -> หน้าเว็บจะว่างเปล่า */
SELECT COALESCE(CAST(user_id AS CHAR), 'NULL = หน้าแรกของเว็บ') AS `อยู่ที่ user_id`, COUNT(*) AS `จำนวนบลอค`
FROM page_blocks GROUP BY user_id;


/* 5) รูปที่อัปไว้ (hero ควรมีได้ถึง 18 = 6 ภาพ x 3 อุปกรณ์) */
SELECT b.type AS `บลอค`, bi.variant AS `อุปกรณ์`, COUNT(*) AS `จำนวนรูป`
FROM block_images bi JOIN page_blocks b ON b.id = bi.block_id
GROUP BY b.type, bi.variant;
