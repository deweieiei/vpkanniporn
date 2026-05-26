-- FWD platform - MySQL schema
-- รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go

CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email            VARCHAR(128) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  first_name       VARCHAR(64)  NOT NULL,
  last_name        VARCHAR(64)  NOT NULL,
  birthdate        DATE         NULL,
  gender           ENUM('male','female','other') NULL,
  province         VARCHAR(64)  NULL,
  avatar_path      VARCHAR(255) NULL,
  role             ENUM('admin','agent','user') NOT NULL DEFAULT 'user',
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- ข้อมูลโปรไฟล์ตัวแทน FWD
  phone            VARCHAR(20)  NULL,
  position         VARCHAR(64)  NULL,
  company          VARCHAR(128) NULL,
  branch           VARCHAR(64)  NULL,
  license_number   VARCHAR(32)  NULL,
  license_number_2 VARCHAR(32)  NULL,
  bio              TEXT         NULL,
  quote            VARCHAR(255) NULL,
  facebook_url     VARCHAR(255) NULL,
  line_id          VARCHAR(64)  NULL,
  instagram_url    VARCHAR(255) NULL,
  awards           JSON         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_name (last_name, first_name),
  KEY idx_users_province (province)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
