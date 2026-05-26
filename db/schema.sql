-- FWD platform - MySQL schema
-- Run this once on your HostAtom database via phpMyAdmin หรือ MySQL CLI

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(128) NULL,
  email         VARCHAR(128) NULL,
  role          ENUM('admin','agent','user') NOT NULL DEFAULT 'user',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตัวอย่าง seed admin (password = "admin1234" ที่ถูก hash bcrypt แล้ว)
-- หลัง deploy ครั้งแรกควรลบ user นี้ออก หรือเปลี่ยน password
-- INSERT INTO users (username, password_hash, full_name, role)
-- VALUES ('admin', '$2b$10$replaceWithBcryptHash', 'Administrator', 'admin');
