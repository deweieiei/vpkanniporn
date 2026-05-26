-- รันคำสั่งนี้บน HostAtom phpMyAdmin (สำหรับ DB ที่มี users table อยู่แล้ว)
-- เลือก database vpkann_database -> tab SQL -> paste -> Go

ALTER TABLE users
  ADD COLUMN phone            VARCHAR(20)  NULL,
  ADD COLUMN position         VARCHAR(64)  NULL,
  ADD COLUMN company          VARCHAR(128) NULL,
  ADD COLUMN branch           VARCHAR(64)  NULL,
  ADD COLUMN license_number   VARCHAR(32)  NULL,
  ADD COLUMN license_number_2 VARCHAR(32)  NULL,
  ADD COLUMN bio              TEXT         NULL,
  ADD COLUMN quote            VARCHAR(255) NULL,
  ADD COLUMN facebook_url     VARCHAR(255) NULL,
  ADD COLUMN line_id          VARCHAR(64)  NULL,
  ADD COLUMN instagram_url    VARCHAR(255) NULL,
  ADD COLUMN awards           JSON         NULL;
