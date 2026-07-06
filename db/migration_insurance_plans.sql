-- Phase 3: ระบบแบบประกัน (insurance_plans)
-- รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go
-- ปลอดภัยรันซ้ำได้ (CREATE TABLE IF NOT EXISTS + INSERT IGNORE)

CREATE TABLE IF NOT EXISTS insurance_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(32)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  icon        VARCHAR(8)   NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO insurance_categories (slug, name, icon, sort_order) VALUES
  ('health',     'ประกันสุขภาพ',     '🏥', 1),
  ('life',       'ประกันชีวิต',       '🛡️', 2),
  ('savings',    'ประกันสะสมทรัพย์', '💰', 3),
  ('retirement', 'ประกันบำนาญ',      '👴', 4),
  ('group',      'ประกันกลุ่ม',       '🏢', 5),
  ('legacy',     'วางแผนมรดก',       '📜', 6);

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
