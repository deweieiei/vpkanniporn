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
  awards_visible   TINYINT(1)   NOT NULL DEFAULT 1,  -- แสดง(1)/ซ่อน(0) ส่วน "ความสำเร็จและรางวัล"
  cover_images     JSON         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_name (last_name, first_name),
  KEY idx_users_province (province)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 3: แบบประกัน — ดูรายละเอียด/seed ข้อมูลที่ db/migration_insurance_plans.sql
-- (แยกไฟล์ไว้เพื่อให้รันกับ DB เก่าที่มี users อยู่แล้วได้โดยไม่ชน)
CREATE TABLE IF NOT EXISTS insurance_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(32)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  icon        VARCHAR(8)   NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insurance_plans (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  category_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(255) NOT NULL,
  summary       VARCHAR(500) NULL,
  content_html  MEDIUMTEXT   NULL,
  cover_image   VARCHAR(255) NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  view_count    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_plans_user (user_id),
  KEY idx_plans_category (category_id),
  CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_plans_category FOREIGN KEY (category_id) REFERENCES insurance_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO insurance_categories (slug, name, icon, sort_order) VALUES
  ('health',     'ประกันสุขภาพ',     '🏥', 1),
  ('life',       'ประกันชีวิต',       '🛡️', 2),
  ('savings',    'ประกันสะสมทรัพย์', '💰', 3),
  ('retirement', 'ประกันบำนาญ',      '👴', 4),
  ('group',      'ประกันกลุ่ม',       '🏢', 5),
  ('legacy',     'วางแผนมรดก',       '📜', 6);
