-- 初始化脚本（推荐用于全新环境一键部署）
-- 约定：
-- - 图片字段（users.avatar / products.image_url / products.images / banners.image）推荐存“相对路径”
--   例如：/uploads/xxx.jpg 或 /api/oss/object?key=xxx
-- - 由前端/网关根据当前环境域名拼接成可访问 URL

DROP DATABASE IF EXISTS `second_hand`;
CREATE DATABASE `second_hand`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `second_hand`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `email` VARCHAR(255),
  `name` VARCHAR(255),
  `nickname` VARCHAR(255),
  `avatar` VARCHAR(512),
  `phone` VARCHAR(20),
  `gender` ENUM('male', 'female', 'other') DEFAULT 'other',
  `bio` TEXT,
  `role` ENUM('user', 'admin') DEFAULT 'user',
  `status` ENUM('active', 'banned') DEFAULT 'active',
  `password_hash` VARCHAR(255),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商品表
CREATE TABLE `products` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `title` VARCHAR(255),
  `description` TEXT,
  `price` DECIMAL(10, 2),
  `image_url` VARCHAR(255),
  `images` JSON,
  `condition` VARCHAR(50),
  `category_id` VARCHAR(50),
  `campus` VARCHAR(100),
  `owner_id` INT,
  `status` ENUM('pending', 'approved', 'rejected', 'down', 'deleted') DEFAULT 'approved',
  `reject_reason` TEXT,
  `views` INT DEFAULT 0,
  `favorites` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_products_owner_id` (`owner_id`),
  INDEX `idx_products_status` (`status`),
  INDEX `idx_products_category_id` (`category_id`),
  CONSTRAINT `fk_products_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 收藏表
CREATE TABLE `favorites` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `product_id` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_favorites_user_product` (`user_id`, `product_id`),
  INDEX `idx_favorites_user_id` (`user_id`),
  INDEX `idx_favorites_product_id` (`product_id`),
  CONSTRAINT `fk_favorites_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_favorites_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订单表
CREATE TABLE `orders` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `orderNo` VARCHAR(50),
  `buyer_id` INT,
  `seller_id` INT,
  `product_id` INT,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  `amount` DECIMAL(10, 2),
  `deliveryAddress` VARCHAR(255),
  `deliveryTime` VARCHAR(50),
  `timeline` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_buyer_id` (`buyer_id`),
  INDEX `idx_orders_seller_id` (`seller_id`),
  INDEX `idx_orders_product_id` (`product_id`),
  INDEX `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_buyer_id` FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_orders_seller_id` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_orders_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 地址表
CREATE TABLE `addresses` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `contact` VARCHAR(50),
  `phone` VARCHAR(20),
  `campus` VARCHAR(100),
  `building` VARCHAR(100),
  `detail` VARCHAR(255),
  `isDefault` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_addresses_user_id` (`user_id`),
  CONSTRAINT `fk_addresses_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 评价表
CREATE TABLE `evaluations` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `order_id` INT,
  `user_id` INT,
  `target_id` INT,
  `target_type` ENUM('buyer', 'seller'),
  `rating` INT,
  `content` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_evaluations_order_id` (`order_id`),
  INDEX `idx_evaluations_user_id` (`user_id`),
  INDEX `idx_evaluations_target_id` (`target_id`),
  CONSTRAINT `fk_evaluations_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
  CONSTRAINT `fk_evaluations_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_evaluations_target_id` FOREIGN KEY (`target_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 投诉表
CREATE TABLE `complaints` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `type` VARCHAR(50),
  `target_id` INT,
  `content` TEXT,
  `evidence` JSON,
  `status` ENUM('pending', 'processed') DEFAULT 'pending',
  `result` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_complaints_user_id` (`user_id`),
  INDEX `idx_complaints_status` (`status`),
  CONSTRAINT `fk_complaints_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通知表
CREATE TABLE `notifications` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` INT,
  `type` VARCHAR(50),
  `title` VARCHAR(255),
  `content` TEXT,
  `is_read` BOOLEAN DEFAULT FALSE,
  `order_id` INT,
  `product_id` INT,
  `complaint_id` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_user_id` (`user_id`),
  INDEX `idx_notifications_order_id` (`order_id`),
  INDEX `idx_notifications_product_id` (`product_id`),
  INDEX `idx_notifications_complaint_id` (`complaint_id`),
  CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_notifications_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
  CONSTRAINT `fk_notifications_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_notifications_complaint_id` FOREIGN KEY (`complaint_id`) REFERENCES `complaints`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE `logs` (
  `id` VARCHAR(50) PRIMARY KEY,
  `user_id` INT,
  `action` VARCHAR(100),
  `module` VARCHAR(100),
  `content` TEXT,
  `ip` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_logs_user_id` (`user_id`),
  INDEX `idx_logs_created_at` (`created_at`),
  CONSTRAINT `fk_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告表
CREATE TABLE `announcements` (
  `id` VARCHAR(50) PRIMARY KEY,
  `title` VARCHAR(255),
  `content` TEXT,
  `isTop` BOOLEAN DEFAULT FALSE,
  `status` ENUM('published', 'draft') DEFAULT 'published',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_announcements_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 轮播图表
CREATE TABLE `banners` (
  `id` VARCHAR(50) PRIMARY KEY,
  `title` VARCHAR(255),
  `image` VARCHAR(255),
  `link` VARCHAR(255),
  `sort` INT,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_banners_sort` (`sort`),
  INDEX `idx_banners_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类表
CREATE TABLE `categories` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100),
  `parentId` VARCHAR(50),
  `sort` INT,
  `enabled` BOOLEAN DEFAULT TRUE,
  INDEX `idx_categories_parentId` (`parentId`),
  INDEX `idx_categories_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 字典表（校区/成色等可配置选项）
CREATE TABLE `dict_items` (
  `id` VARCHAR(64) PRIMARY KEY,
  `dict_type` VARCHAR(50) NOT NULL,
  `value` VARCHAR(100) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `sort` INT DEFAULT 0,
  `enabled` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_dict_type_value` (`dict_type`, `value`),
  INDEX `idx_dict_type_sort` (`dict_type`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI 中心：提示词管理
CREATE TABLE `ai_prompts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `scene` VARCHAR(100) NOT NULL,
  `content` TEXT NOT NULL,
  `enabled` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ai_prompts_scene` (`scene`),
  INDEX `idx_ai_prompts_enabled` (`enabled`),
  INDEX `idx_ai_prompts_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 商品标签
CREATE TABLE `product_tags` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `product_id` INT,
  `tag_name` VARCHAR(50),
  UNIQUE KEY `uk_product_tags_product_tag` (`product_id`, `tag_name`),
  INDEX `idx_product_tags_product_id` (`product_id`),
  INDEX `idx_product_tags_tag_name` (`tag_name`),
  CONSTRAINT `fk_product_tags_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户标签
CREATE TABLE `user_tags` (
  `user_id` INT,
  `tag_name` VARCHAR(50),
  `weight` INT DEFAULT 1,
  `update_time` DATETIME,
  PRIMARY KEY (`user_id`, `tag_name`),
  INDEX `idx_user_tags_user_id` (`user_id`),
  CONSTRAINT `fk_user_tags_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户推荐
CREATE TABLE `user_recommend` (
  `user_id` INT,
  `product_id` INT,
  `score` DECIMAL(5, 2),
  `create_time` DATETIME,
  PRIMARY KEY (`user_id`, `product_id`),
  INDEX `idx_user_recommend_user_id` (`user_id`),
  INDEX `idx_user_recommend_product_id` (`product_id`),
  CONSTRAINT `fk_user_recommend_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_user_recommend_product_id` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天会话
CREATE TABLE `chat_conversations` (
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
  INDEX `idx_chat_conv_last_at` (`last_message_at`),
  CONSTRAINT `fk_chat_conv_user1` FOREIGN KEY (`user1_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_chat_conv_user2` FOREIGN KEY (`user2_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_chat_conv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话成员（用于未读统计/权限）
CREATE TABLE `chat_conversation_members` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `user_id` INT NOT NULL,
  `last_read_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_chat_conv_member` (`conversation_id`, `user_id`),
  INDEX `idx_chat_member_user` (`user_id`),
  INDEX `idx_chat_member_conv` (`conversation_id`),
  CONSTRAINT `fk_chat_member_conv` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_member_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 聊天消息
CREATE TABLE `chat_messages` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `conversation_id` BIGINT NOT NULL,
  `sender_id` INT NOT NULL,
  `type` ENUM('text', 'image', 'product-card') DEFAULT 'text',
  `content` TEXT,
  `extra` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_chat_msg_conv_created` (`conversation_id`, `created_at`),
  INDEX `idx_chat_msg_sender` (`sender_id`),
  CONSTRAINT `fk_chat_msg_conv` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_msg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
