-- Mock/种子数据脚本（可重复执行）
-- 说明：
-- - 不包含建库/建表；请先执行 schema.init.sql
-- - 图片字段建议用相对路径（/uploads/... 或 /api/oss/object?key=...）
-- - 本脚本会清理表数据后再插入，便于开发联调反复执行

USE `second_hand`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 清理（按外键依赖顺序）
TRUNCATE TABLE `chat_messages`;
TRUNCATE TABLE `chat_conversation_members`;
TRUNCATE TABLE `chat_conversations`;
TRUNCATE TABLE `favorites`;
TRUNCATE TABLE `evaluations`;
TRUNCATE TABLE `complaints`;
TRUNCATE TABLE `notifications`;
TRUNCATE TABLE `logs`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `product_tags`;
TRUNCATE TABLE `user_recommend`;
TRUNCATE TABLE `user_tags`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `banners`;
TRUNCATE TABLE `announcements`;
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `dict_items`;
TRUNCATE TABLE `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- 用户
INSERT INTO `users` (`id`, `email`, `name`, `nickname`, `avatar`, `phone`, `gender`, `bio`, `role`, `status`, `password_hash`)
VALUES
  (1, 'alice@example.com', 'Alice', '数码小王子', '/uploads/avatars/alice.svg', '13800000001', 'female', '爱数码，爱折腾。', 'user', 'active', 'demo'),
  (2, 'bob@example.com',   'Bob',   '书籍搬运工', '/uploads/avatars/bob.svg',   '13800000002', 'male',   '教材/考研资料出清。', 'user', 'active', 'demo'),
  (3, 'admin@example.com', 'Admin', '管理员',     '/uploads/avatars/admin.svg', '13800000003', 'other',  '系统管理员账号', 'admin', 'active', 'demo');

-- 分类
INSERT INTO `categories` (`id`, `name`, `parentId`, `sort`, `enabled`)
VALUES
  ('c1',   '数码产品', NULL, 1, TRUE),
  ('c1-1', '手机',     'c1', 1, TRUE),
  ('c1-2', '平板电脑', 'c1', 2, TRUE),
  ('c1-3', '电脑配件', 'c1', 3, TRUE),
  ('c2',   '教材书籍', NULL, 2, TRUE),
  ('c2-1', '公共课教材', 'c2', 1, TRUE),
  ('c2-2', '考研资料',   'c2', 2, TRUE),
  ('c3',   '生活用品', NULL, 3, TRUE),
  ('c3-1', '宿舍用品', 'c3', 1, TRUE);

-- 字典（校区 / 成色）
INSERT INTO `dict_items` (`id`, `dict_type`, `value`, `label`, `sort`, `enabled`)
VALUES
  ('dict_seed_campus_1', 'campus', '东校区', '东校区', 1, TRUE),
  ('dict_seed_campus_2', 'campus', '西校区', '西校区', 2, TRUE),
  ('dict_seed_campus_3', 'campus', '南校区', '南校区', 3, TRUE),
  ('dict_seed_campus_4', 'campus', '北校区', '北校区', 4, TRUE),
  ('dict_seed_condition_1', 'condition', '全新', '全新', 1, TRUE),
  ('dict_seed_condition_2', 'condition', '几乎全新', '几乎全新', 2, TRUE),
  ('dict_seed_condition_3', 'condition', '轻微使用', '轻微使用', 3, TRUE),
  ('dict_seed_condition_4', 'condition', '明显使用', '明显使用', 4, TRUE);

-- 公告
INSERT INTO `announcements` (`id`, `title`, `content`, `isTop`, `status`, `created_at`)
VALUES
  ('ann_seed_1', '平台上线公告', '校园二手交易平台已上线，欢迎体验！', TRUE,  'published', NOW()),
  ('ann_seed_2', '交易安全提醒', '建议校内当面交易，谨防诈骗。',         FALSE, 'published', NOW()),
  ('ann_seed_3', '维护通知',     '今晚 23:00-23:30 系统维护，期间可能无法下单。', FALSE, 'draft', NOW());

-- 轮播图（可用相对路径；实际图片可由你在 uploads/ 下补齐）
INSERT INTO `banners` (`id`, `title`, `image`, `link`, `sort`, `active`, `created_at`)
VALUES
  ('ban_seed_1', '毕业季闲置大甩卖', '/uploads/banners/ban_seed_1.jpg', '/products', 1, TRUE, NOW()),
  ('ban_seed_2', '教材书籍专区',     '/uploads/banners/ban_seed_2.jpg', '/products?category=c2', 2, TRUE, NOW()),
  ('ban_seed_3', '数码好物推荐',     '/uploads/banners/ban_seed_3.jpg', '/products?category=c1', 3, TRUE, NOW());

-- 商品
INSERT INTO `products` (
  `id`, `title`, `description`, `price`, `image_url`, `images`, `condition`, `category_id`, `campus`,
  `owner_id`, `status`, `views`, `favorites`, `created_at`, `updated_at`
)
VALUES
  (
    1,
    'iPad Air 5 256G WiFi',
    '99新，无拆无修，带原盒与充电器。可小刀。',
    2999.00,
    '/uploads/products/ipad_air_5.jpg',
    JSON_ARRAY('/uploads/products/ipad_air_5.jpg', '/uploads/products/ipad_air_5_2.jpg'),
    '几乎全新',
    'c1-2',
    '东校区',
    1,
    'approved',
    23,
    2,
    NOW(),
    NOW()
  ),
  (
    2,
    '小米 13 256G 黑色',
    '轻微使用痕迹，电池健康良好，送保护壳。',
    1899.00,
    '/uploads/products/mi13.jpg',
    JSON_ARRAY('/uploads/products/mi13.jpg'),
    '轻微使用',
    'c1-1',
    '西校区',
    1,
    'approved',
    58,
    5,
    NOW(),
    NOW()
  ),
  (
    3,
    '高数（同济版）上下册',
    '几乎全新，基本没翻过。',
    35.00,
    '/uploads/products/math_book.jpg',
    JSON_ARRAY('/uploads/products/math_book.jpg'),
    '几乎全新',
    'c2-1',
    '南校区',
    2,
    'approved',
    12,
    1,
    NOW(),
    NOW()
  ),
  (
    4,
    '宿舍小风扇（可夹式）',
    '夏天神器，静音，三档风力。',
    25.00,
    '/uploads/products/fan.jpg',
    JSON_ARRAY('/uploads/products/fan.jpg'),
    '明显使用',
    'c3-1',
    '北校区',
    2,
    'approved',
    9,
    0,
    NOW(),
    NOW()
  );

-- 收藏
INSERT INTO `favorites` (`user_id`, `product_id`, `created_at`)
VALUES
  (1, 3, NOW()),
  (2, 1, NOW()),
  (2, 2, NOW());

-- 聊天（示例数据）
INSERT INTO `chat_conversations` (
  `id`, `user1_id`, `user2_id`, `product_id`,
  `last_message_content`, `last_message_type`, `last_message_at`,
  `created_at`, `updated_at`
)
VALUES
  (1, 1, 2, 1, '可以便宜点吗？', 'text', NOW(), NOW(), NOW());

INSERT INTO `chat_conversation_members` (`conversation_id`, `user_id`, `last_read_at`, `created_at`, `updated_at`)
VALUES
  (1, 1, NOW(), NOW(), NOW()),
  (1, 2, NOW(), NOW(), NOW());

INSERT INTO `chat_messages` (`conversation_id`, `sender_id`, `type`, `content`, `created_at`)
VALUES
  (1, 2, 'text', '你好，这个 iPad 还在吗？', DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
  (1, 1, 'text', '在的，成色很好。', DATE_SUB(NOW(), INTERVAL 8 MINUTE)),
  (1, 2, 'text', '可以便宜点吗？', DATE_SUB(NOW(), INTERVAL 5 MINUTE));

