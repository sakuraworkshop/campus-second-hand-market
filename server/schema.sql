-- 自动初始化（由 server/src/db/mysql.js 在启动时执行）
-- 约定：仅放“增量且幂等”的建表语句（不要 DROP DATABASE/表）

CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user1_id` INT NOT NULL,
  `user2_id` INT NOT NULL,
  `product_id` INT NULL,
  `last_message_content` TEXT,
  `last_message_type` ENUM('text', 'image', 'product-card') DEFAULT 'text',
  `last_message_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_chat_conv_users_product` (`user1_id`, `user2_id`, `product_id`),
  INDEX `idx_chat_conv_user1` (`user1_id`),
  INDEX `idx_chat_conv_user2` (`user2_id`),
  INDEX `idx_chat_conv_product` (`product_id`),
  INDEX `idx_chat_conv_last_at` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_conversation_members` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `user_id` INT NOT NULL,
  `last_read_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_chat_conv_member` (`conversation_id`, `user_id`),
  INDEX `idx_chat_member_user` (`user_id`),
  INDEX `idx_chat_member_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `sender_id` INT NOT NULL,
  `type` ENUM('text', 'image', 'product-card') DEFAULT 'text',
  `content` TEXT,
  `extra` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_chat_msg_conv_created` (`conversation_id`, `created_at`),
  INDEX `idx_chat_msg_sender` (`sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

