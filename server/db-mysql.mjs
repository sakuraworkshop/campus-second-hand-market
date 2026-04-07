import mysql from 'mysql2/promise';

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'second_hand',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 数据库操作方法
export const mysqlDb = {
  pool: null,
  async initDatabase() {
    try {
      // 创建数据库连接池
      this.pool = mysql.createPool(dbConfig);
      
      const connection = await this.pool.getConnection();
      
      // 创建用户表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(255),
          name VARCHAR(255),
          nickname VARCHAR(255),
          avatar VARCHAR(255),
          phone VARCHAR(20),
          studentId VARCHAR(20),
          gender ENUM('male', 'female', 'other') DEFAULT 'other',
          grade VARCHAR(50),
          major VARCHAR(100),
          bio TEXT,
          role ENUM('user', 'admin') DEFAULT 'user',
          status ENUM('active', 'banned') DEFAULT 'active',
          password_hash VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 创建商品表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS products (
          id INT PRIMARY KEY AUTO_INCREMENT,
          title VARCHAR(255),
          description TEXT,
          price DECIMAL(10, 2),
          image_url VARCHAR(255),
          images JSON,
          condition VARCHAR(50),
          category_id VARCHAR(50),
          campus VARCHAR(100),
          owner_id INT,
          status ENUM('pending', 'approved', 'rejected', 'down', 'deleted') DEFAULT 'pending',
          reject_reason TEXT,
          views INT DEFAULT 0,
          favorites INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users(id)
        )
      `);
      
      // 创建收藏表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          product_id INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      
      // 创建订单表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          orderNo VARCHAR(50),
          buyer_id INT,
          seller_id INT,
          product_id INT,
          status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
          amount DECIMAL(10, 2),
          deliveryAddress VARCHAR(255),
          deliveryTime VARCHAR(50),
          timeline JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (buyer_id) REFERENCES users(id),
          FOREIGN KEY (seller_id) REFERENCES users(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      
      // 创建地址表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS addresses (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          contact VARCHAR(50),
          phone VARCHAR(20),
          campus VARCHAR(100),
          building VARCHAR(100),
          detail VARCHAR(255),
          isDefault BOOLEAN DEFAULT false,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      // 创建评价表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS evaluations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT,
          user_id INT,
          target_id INT,
          target_type ENUM('buyer', 'seller'),
          rating INT,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (target_id) REFERENCES users(id)
        )
      `);
      
      // 创建投诉表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS complaints (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT,
          type VARCHAR(50),
          target_id INT,
          content TEXT,
          evidence JSON,
          status ENUM('pending', 'processed') DEFAULT 'pending',
          result TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      // 创建通知表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(50) PRIMARY KEY,
          user_id INT,
          type VARCHAR(50),
          title VARCHAR(255),
          content TEXT,
          is_read BOOLEAN DEFAULT false,
          order_id INT,
          product_id INT,
          complaint_id INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (complaint_id) REFERENCES complaints(id)
        )
      `);
      
      // 创建操作日志表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id VARCHAR(50) PRIMARY KEY,
          user_id INT,
          action VARCHAR(100),
          module VARCHAR(100),
          content TEXT,
          ip VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      // 创建公告表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255),
          content TEXT,
          isTop BOOLEAN DEFAULT false,
          status ENUM('published', 'draft') DEFAULT 'published',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 创建轮播图表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS banners (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(255),
          image VARCHAR(255),
          link VARCHAR(255),
          sort INT,
          active BOOLEAN DEFAULT true,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 创建分类表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100),
          parentId VARCHAR(50),
          sort INT,
          enabled BOOLEAN DEFAULT true
        )
      `);
      
      // 创建商品标签表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS product_tags (
          id INT PRIMARY KEY AUTO_INCREMENT,
          product_id INT,
          tag_name VARCHAR(50),
          INDEX idx_product (product_id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      
      // 创建用户兴趣权重表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_tags (
          user_id INT,
          tag_name VARCHAR(50),
          weight INT DEFAULT 1,
          update_time DATETIME,
          PRIMARY KEY (user_id, tag_name),
          INDEX idx_user (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      // 创建预计算推荐结果表
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_recommend (
          user_id INT,
          product_id INT,
          score DECIMAL(5,2),
          create_time DATETIME,
          PRIMARY KEY (user_id, product_id),
          INDEX idx_user (user_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      
      // 检查是否需要插入初始数据
      const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
      if (users[0].count === 0) {
        // 插入演示用户
        await connection.query(`
          INSERT INTO users (email, name, nickname, avatar, phone, studentId, role, status, password_hash)
          VALUES 
          ('alice@example.com', 'Alice', '数码小王子', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix', '13800000001', '2021001', 'user', 'active', 'demo'),
          ('admin@example.com', 'Admin', '管理员', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin', '13800000002', '2022002', 'admin', 'active', 'demo')
        `);
        
        // 插入初始分类
        await connection.query(`
          INSERT INTO categories (id, name, parentId, sort, enabled)
          VALUES 
          ('c1', '数码产品', NULL, 1, true),
          ('c1-1', '手机', 'c1', 1, true),
          ('c1-2', '平板电脑', 'c1', 2, true),
          ('c2', '教材书籍', NULL, 2, true),
          ('c2-1', '公共课教材', 'c2', 1, true)
        `);
        
        // 插入初始公告
        await connection.query(`
          INSERT INTO announcements (id, title, content, isTop, status)
          VALUES 
          (CONCAT('ann_', UNIX_TIMESTAMP(), '_1'), '🎉 平台上线公告', '校园二手交易平台已上线，欢迎体验！', true, 'published'),
          (CONCAT('ann_', UNIX_TIMESTAMP(), '_2'), '⚠️ 交易安全提醒', '请优先选择校内当面交易，不要站外转账。', false, 'published')
        `);
        
        // 插入初始轮播图
        await connection.query(`
          INSERT INTO banners (id, title, image, link, sort, active)
          VALUES 
          (CONCAT('ban_', UNIX_TIMESTAMP(), '_1'), '毕业季闲置大甩卖', 'https://images.unsplash.com/photo-1523050854058-8df90110c476?w=1200&h=400&fit=crop', '/products', 1, true),
          (CONCAT('ban_', UNIX_TIMESTAMP(), '_2'), '教材书籍专区', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=400&fit=crop', '/products', 2, true)
        `);
      }
      
      connection.release();
      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  },
  async query(sql, params) {
    if (!this.pool) {
      throw new Error('数据库连接池未初始化');
    }
    const connection = await this.pool.getConnection();
    try {
      const [results] = await connection.query(sql, params);
      return results;
    } finally {
      connection.release();
    }
  },
  async getById(table, id) {
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    const results = await this.query(sql, [id]);
    return results[0] || null;
  },
  async insert(table, data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?');
    const values = Object.values(data);
    const sql = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await this.query(sql, values);
    return result.insertId;
  },
  async update(table, id, data) {
    const fields = Object.keys(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(data), id];
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    await this.query(sql, values);
  },
  async delete(table, id) {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    await this.query(sql, [id]);
  },
  async now() {
    const [result] = await this.query('SELECT NOW() as now');
    return result[0].now;
  }
};
