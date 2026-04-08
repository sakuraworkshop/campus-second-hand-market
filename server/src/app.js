import "dotenv/config";
import express from "express";
import cors from "cors";
import { mysqlDb, sqliteDb, jsonDb, seedIfEmpty } from "./db/index.js";
import crypto from "node:crypto";
import axios from "axios";
import WebSocket from "ws";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createPublicRouter } from "./routes/public-routes.js";
import { createProductRouter } from "./routes/product-routes.js";
import { createUserRouter } from "./routes/user-routes.js";
import { createTradeRouter } from "./routes/trade-routes.js";

// 数据库连接状态
let db = mysqlDb;
let useJsonDb = false;

// JSON 数据库适配器
function createJsonDbAdapter(jsonDb) {
  return {
    initDatabase: async () => {
      // 初始化本地 JSON 数据
      seedIfEmpty();
    },
    query: async (sql, params = []) => {
      // 解析 SQL 查询，转换为 JSON 操作
      // 这里只实现了一些基本的查询，用于支持应用的核心功能
      const data = jsonDb.read();
      
      // 处理 SELECT 查询
      if (sql.startsWith('SELECT')) {
        // 简单的 SELECT 查询处理
        if (sql.includes('FROM users')) {
          let users = data.users;
          // 处理 WHERE 条件
          if (sql.includes('WHERE')) {
            if (sql.includes('email = ?')) {
              const email = params[0];
              users = users.filter(user => user.email === email);
            } else if (sql.includes('id = ?')) {
              const id = params[0];
              users = users.filter(user => user.id === id);
            }
          }
          return users;
        } else if (sql.includes('FROM products')) {
          let products = data.products;
          
          // 处理 WHERE 条件
          if (sql.includes('WHERE')) {
            if (sql.includes('id = ?')) {
              const id = params[0];
              products = products.filter(product => product.id === id);
            } else if (sql.includes('owner_id = ?')) {
              const ownerId = params[0];
              products = products.filter(product => product.owner_id === ownerId);
            } else if (sql.includes('status <> \'deleted\'')) {
              // 过滤掉已删除的商品
              products = products.filter(product => product.status !== 'deleted');
            }
          }
          
          // 处理 LEFT JOIN users，添加 owner_name 字段
          if (sql.includes('LEFT JOIN users')) {
            products = products.map(product => {
              const user = data.users.find(u => u.id === product.owner_id);
              return {
                ...product,
                owner_name: user ? user.name : '未知用户'
              };
            });
          }
          
          // 处理 ORDER BY
          if (sql.includes('ORDER BY p.created_at DESC')) {
            products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          }
          
          return products;
        } else if (sql.includes('FROM categories')) {
          let categories = data.categories || [];
          
          // 处理 WHERE 条件
          if (sql.includes('WHERE enabled = true')) {
            categories = categories.filter(category => category.enabled === true);
          }
          
          // 处理 ORDER BY
          if (sql.includes('ORDER BY sort ASC')) {
            categories.sort((a, b) => (a.sort || 0) - (b.sort || 0));
          }
          
          return categories;
        } else if (sql.includes('FROM announcements')) {
          let announcements = data.announcements || [];
          
          // 处理 WHERE 条件
          if (sql.includes('WHERE status = \'published\'')) {
            announcements = announcements.filter(announcement => announcement.status === 'published');
          }
          
          // 处理 ORDER BY
          if (sql.includes('ORDER BY isTop DESC, created_at DESC')) {
            announcements.sort((a, b) => {
              // 先按 isTop 降序排序
              if ((a.isTop || false) !== (b.isTop || false)) {
                return (b.isTop ? 1 : 0) - (a.isTop ? 1 : 0);
              }
              // 再按 created_at 降序排序
              return new Date(b.created_at) - new Date(a.created_at);
            });
          }
          
          return announcements;
        }
      }
      
      // 处理 UPDATE 查询
      if (sql.startsWith('UPDATE')) {
        const data = jsonDb.read();
        if (sql.includes('users SET')) {
          const id = params[params.length - 1];
          const user = data.users.find(user => user.id === id);
          if (user) {
            const updateData = params[0];
            Object.assign(user, updateData);
            jsonDb.write(data);
          }
        } else if (sql.includes('products SET')) {
          const id = params[params.length - 1];
          const product = data.products.find(product => product.id === id);
          if (product) {
            const updateData = params[0];
            Object.assign(product, updateData);
            jsonDb.write(data);
          }
        }
        return [];
      }
      
      // 处理 INSERT 查询
      if (sql.startsWith('INSERT')) {
        const data = jsonDb.read();
        if (sql.includes('INTO users')) {
          const userData = params[0];
          userData.id = jsonDb.nextId(data, 'users');
          data.users.push(userData);
          jsonDb.write(data);
          return { insertId: userData.id };
        } else if (sql.includes('INTO products')) {
          const productData = params[0];
          productData.id = jsonDb.nextId(data, 'products');
          data.products.push(productData);
          jsonDb.write(data);
          return { insertId: productData.id };
        }
        return { insertId: 1 };
      }
      
      // 处理 DELETE 查询
      if (sql.startsWith('DELETE')) {
        const data = jsonDb.read();
        if (sql.includes('FROM products')) {
          const id = params[0];
          data.products = data.products.filter(product => product.id !== id);
          jsonDb.write(data);
        }
        return [];
      }
      
      return [];
    },
    getById: async (table, id) => {
      const data = jsonDb.read();
      const items = data[table] || [];
      return items.find(item => item.id === id) || null;
    },
    insert: async (table, dataObj) => {
      const data = jsonDb.read();
      const items = data[table] || [];
      dataObj.id = jsonDb.nextId(data, table);
      items.push(dataObj);
      data[table] = items;
      jsonDb.write(data);
      return dataObj.id;
    },
    update: async (table, id, dataObj) => {
      const data = jsonDb.read();
      const items = data[table] || [];
      const item = items.find(item => item.id === id);
      if (item) {
        Object.assign(item, dataObj);
        data[table] = items;
        jsonDb.write(data);
      }
    },
    delete: async (table, id) => {
      const data = jsonDb.read();
      const items = data[table] || [];
      data[table] = items.filter(item => item.id !== id);
      jsonDb.write(data);
    },
    now: async () => {
      return jsonDb.now();
    }
  };
}

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN_SECRET = process.env.TOKEN_SECRET;
const PASSWORD_SALT = process.env.PASSWORD_SALT;
if (!TOKEN_SECRET || !PASSWORD_SALT) {
  throw new Error("Missing required env vars: TOKEN_SECRET and PASSWORD_SALT");
}

// 科大讯飞星火认知大模型 API 配置
const xfAppId = process.env.XF_APP_ID || "";
const xfApiKey = process.env.XF_API_KEY || "";
const xfApiSecret = process.env.XF_API_SECRET || "";
const xfWsUrl = "wss://spark-api.xf-yun.com/v4.0/chat";

// S3 协议 OSS 配置（兼容 MinIO / 阿里云 OSS S3 兼容 / 腾讯云 COS S3 兼容 / Ceph 等）
const OSS_PROVIDER = process.env.OSS_PROVIDER || "s3-compatible";
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "";
const OSS_SECRET_ACCESS_KEY = process.env.OSS_SECRET_ACCESS_KEY || "";
const OSS_BUCKET = process.env.OSS_BUCKET || "";
const OSS_REGION = process.env.OSS_REGION || "us-east-1";
const OSS_ENDPOINT = process.env.OSS_ENDPOINT || process.env.OSS_EXTERNAL_ENDPOINT || "";
const OSS_PUBLIC_BASE_URL = process.env.OSS_PUBLIC_BASE_URL || process.env.OSS_EXTERNAL_ENDPOINT || "";
const OSS_FORCE_PATH_STYLE = String(process.env.OSS_FORCE_PATH_STYLE || "true").toLowerCase() !== "false";
const OSS_UPLOAD_EXPIRES = Number(process.env.OSS_UPLOAD_EXPIRES || 600);

const ossReady = Boolean(OSS_ACCESS_KEY_ID && OSS_SECRET_ACCESS_KEY && OSS_BUCKET && OSS_ENDPOINT);
const s3Client = ossReady
  ? new S3Client({
      region: OSS_REGION,
      endpoint: OSS_ENDPOINT,
      forcePathStyle: OSS_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: OSS_ACCESS_KEY_ID,
        secretAccessKey: OSS_SECRET_ACCESS_KEY,
      },
    })
  : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// 由于使用了 xf-spark-api SDK，不再需要手动生成签名
// 该函数已废弃，保留仅为向后兼容

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString();
}

function createToken(payload) {
  // 这里用一个轻量 token 实现（非生产级 JWT），仅用于项目开发联调
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7天
  const body = { ...payload, exp };
  const tokenBody = base64UrlEncode(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(tokenBody)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${tokenBody}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [tokenBody, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(tokenBody)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(tokenBody));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPasswordMD5(password) {
  return `md5:${crypto.createHash("md5").update(`${PASSWORD_SALT}:${password}`).digest("hex")}`;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const m = String(header).match(/^Bearer (.+)$/i);
  const token = m?.[1] || "";
  const payload = verifyToken(token);
  if (!payload?.uid) return res.status(401).json({ message: "未登录或 token 无效" });

  // 从数据库获取用户信息
  db.getById('users', payload.uid).then((user) => {
    if (!user) return res.status(401).json({ message: "用户不存在" });
    if (user.status === "banned") return res.status(403).json({ message: "账号已封禁" });

    req.auth = { uid: user.id, role: user.role, user };
    next();
  }).catch((error) => {
    console.error('获取用户信息失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.auth.role !== "admin") return res.status(403).json({ message: "需要管理员权限" });
    next();
  });
}

app.use(cors());
app.use(express.json());
app.use(
  "/api/auth",
  createAuthRouter({
    db,
    createToken,
    hashPasswordMD5,
    authRequired,
  })
);
app.use(
  "/api",
  createProductRouter({
    db,
    authRequired,
  })
);
app.use(
  "/api",
  createUserRouter({
    db,
    hashPasswordMD5,
    authRequired,
  })
);
app.use(
  "/api",
  createTradeRouter({
    db,
    authRequired,
  })
);
app.use("/api", createPublicRouter({ db }));

app.get("/api/oss/config", authRequired, (_req, res) => {
  res.json({
    enabled: ossReady,
    provider: OSS_PROVIDER,
    bucket: OSS_BUCKET || null,
    uploadExpires: OSS_UPLOAD_EXPIRES,
  });
});

app.post("/api/oss/presign-upload", authRequired, async (req, res) => {
  if (!ossReady || !s3Client) {
    return res.status(400).json({ message: "OSS 未配置完整" });
  }

  try {
    const { filename, contentType, folder } = req.body ?? {};
    if (!filename || !contentType) {
      return res.status(400).json({ message: "filename 和 contentType 为必填" });
    }

    const safeFolder = String(folder || "uploads")
      .replace(/^\/*/, "")
      .replace(/\/*$/, "")
      .replace(/\.\./g, "");
    const ext = String(filename).includes(".") ? String(filename).split(".").pop() : "";
    const key = `${safeFolder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext ? `.${ext}` : ""}`;

    const command = new PutObjectCommand({
      Bucket: OSS_BUCKET,
      Key: key,
      ContentType: String(contentType),
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: OSS_UPLOAD_EXPIRES });

    const publicBase = String(OSS_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const publicUrl = publicBase ? `${publicBase}/${OSS_BUCKET}/${key}` : null;

    res.json({
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": String(contentType) },
      key,
      bucket: OSS_BUCKET,
      publicUrl,
    });
  } catch (error) {
    console.error("生成 OSS 上传签名失败:", error);
    return res.status(500).json({ message: "生成上传签名失败" });
  }
});

app.post("/api/oss/upload", authRequired, upload.single("file"), async (req, res) => {
  if (!ossReady || !s3Client) {
    return res.status(400).json({ message: "OSS 未配置完整" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "file 为必填" });
  }

  try {
    const folder = String(req.body?.folder || "uploads")
      .replace(/^\/*/, "")
      .replace(/\/*$/, "")
      .replace(/\.\./g, "");
    const originalName = req.file.originalname || "upload.bin";
    const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext ? `.${ext}` : ""}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: OSS_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || "application/octet-stream",
      })
    );

    const base = `${req.protocol}://${req.get("host")}`;
    const url = `${base}/api/oss/object?key=${encodeURIComponent(key)}`;
    res.json({ key, bucket: OSS_BUCKET, url });
  } catch (error) {
    console.error("后端代理上传 OSS 失败:", error);
    return res.status(500).json({ message: "后端代理上传失败" });
  }
});

app.get("/api/oss/object", async (req, res) => {
  if (!ossReady || !s3Client) {
    return res.status(400).json({ message: "OSS 未配置完整" });
  }

  const key = String(req.query?.key || "");
  if (!key) {
    return res.status(400).json({ message: "key 为必填" });
  }

  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: OSS_BUCKET,
        Key: key,
      })
    );
    if (result.ContentType) res.setHeader("Content-Type", result.ContentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (result.Body && typeof result.Body.pipe === "function") {
      result.Body.pipe(res);
    } else {
      res.status(500).json({ message: "读取对象失败" });
    }
  } catch (error) {
    console.error("读取 OSS 对象失败:", error);
    return res.status(404).json({ message: "图片不存在或无权限访问" });
  }
});

// 初始化数据库
db.initDatabase();








app.get("/api/admin/users", adminRequired, (req, res) => {
  // 从数据库获取用户列表
  const sql = `
    SELECT u.*, 
           (SELECT COUNT(*) FROM products WHERE owner_id = u.id) as products,
           (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id OR seller_id = u.id) as orders
    FROM users u
  `;

  db.query(sql).then((users) => {
    const list = users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      studentId: u.studentId,
      role: u.role,
      status: u.status,
      createdAt: u.created_at,
      products: u.products,
      orders: u.orders,
    }));
    res.json({ list });
  }).catch((error) => {
    console.error('获取用户列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/users/:userId/role", adminRequired, (req, res) => {
  const userId = Number(req.params.userId);
  const { role } = req.body ?? {};
  if (!role || (role !== "admin" && role !== "user")) {
    return res.status(400).json({ message: "role 必须为 admin 或 user" });
  }

  // 检查用户是否存在
  db.getById('users', userId).then((user) => {
    if (!user) return res.status(404).json({ message: "用户不存在" });

    // 更新用户角色
    return db.update('users', userId, { role });
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新用户角色失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/users/:userId/status", adminRequired, (req, res) => {
  const userId = Number(req.params.userId);
  const { status } = req.body ?? {};
  if (!status || (status !== "active" && status !== "banned")) {
    return res.status(400).json({ message: "status 必须为 active 或 banned" });
  }

  // 检查用户是否存在
  db.getById('users', userId).then((user) => {
    if (!user) return res.status(404).json({ message: "用户不存在" });

    // 更新用户状态
    return db.update('users', userId, { status });
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新用户状态失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.get("/api/admin/stats", adminRequired, (_req, res) => {
  // 获取统计数据
  const statsSql = `
    SELECT
      (SELECT COUNT(*) FROM users) as totalUsers,
      (SELECT COUNT(*) FROM products) as totalProducts,
      (SELECT COUNT(*) FROM orders) as totalOrders,
      (SELECT COUNT(*) FROM favorites) as totalFavorites,
      (SELECT SUM(p.price) FROM orders o JOIN products p ON o.product_id = p.id) as totalAmount
  `;
  
  // 获取收藏最多的商品
  const topFavoritesSql = `
    SELECT p.id, p.title, COUNT(f.id) as favorites
    FROM products p
    LEFT JOIN favorites f ON p.id = f.product_id
    GROUP BY p.id, p.title
    ORDER BY favorites DESC
    LIMIT 10
  `;
  
  Promise.all([
    db.query(statsSql),
    db.query(topFavoritesSql)
  ]).then(([statsResult, topFavoritesResult]) => {
    const stats = statsResult[0];
    const topFavoritedProducts = topFavoritesResult;
    
    res.json({
      stats: {
        totalUsers: stats.totalUsers || 0,
        totalProducts: stats.totalProducts || 0,
        totalOrders: stats.totalOrders || 0,
        totalFavorites: stats.totalFavorites || 0,
        totalAmount: stats.totalAmount || 0,
        topFavoritedProducts,
      },
    });
  }).catch((error) => {
    console.error('获取统计数据失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 公告管理 ---
app.get("/api/admin/announcements", adminRequired, (_req, res) => {
  // 从数据库获取公告列表
  const sql = `
    SELECT * FROM announcements
    ORDER BY created_at DESC
  `;

  db.query(sql).then((announcements) => {
    res.json({ list: announcements });
  }).catch((error) => {
    console.error('获取公告列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.post("/api/admin/announcements", adminRequired, (req, res) => {
  const { title, content, status = "published" } = req.body ?? {};
  if (!title || !content) return res.status(400).json({ message: "title 和 content 为必填" });

  // 创建公告
  const announcementData = {
    id: `ann_${Date.now()}`,
    title,
    content,
    isTop: false,
    status: status === "draft" ? "draft" : "published",
    created_at: new Date().toISOString(),
  };

  db.insert('announcements', announcementData).then(() => {
    res.status(201).json({ item: announcementData });
  }).catch((error) => {
    console.error('创建公告失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.put("/api/admin/announcements/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  const { title, content, status } = req.body ?? {};
  
  // 检查公告是否存在
  const checkSql = "SELECT * FROM announcements WHERE id = ?";
  db.query(checkSql, [id]).then((announcements) => {
    if (announcements.length === 0) {
      return res.status(404).json({ message: "公告不存在" });
    }
    
    // 更新公告
    const updateData = {};
    if (title != null) updateData.title = title;
    if (content != null) updateData.content = content;
    if (status != null) updateData.status = status === "draft" ? "draft" : "published";
    
    return db.update("announcements", id, updateData);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新公告失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/announcements/:id/top", adminRequired, (req, res) => {
  const { id } = req.params;
  const { isTop } = req.body ?? {};
  
  // 检查公告是否存在
  const checkSql = "SELECT * FROM announcements WHERE id = ?";
  db.query(checkSql, [id]).then((announcements) => {
    if (announcements.length === 0) {
      return res.status(404).json({ message: "公告不存在" });
    }
    
    // 更新公告置顶状态
    return db.query("UPDATE announcements SET isTop = ? WHERE id = ?", [Boolean(isTop), id]);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新公告置顶状态失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.delete("/api/admin/announcements/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  
  // 检查公告是否存在
  const checkSql = "SELECT * FROM announcements WHERE id = ?";
  db.query(checkSql, [id]).then((announcements) => {
    if (announcements.length === 0) {
      return res.status(404).json({ message: "公告不存在" });
    }
    
    // 删除公告
    return db.query("DELETE FROM announcements WHERE id = ?", [id]);
  }).then(() => {
    res.status(204).send();
  }).catch((error) => {
    console.error('删除公告失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 轮播图管理 ---
app.get("/api/admin/banners", adminRequired, (_req, res) => {
  // 从数据库获取轮播图列表
  const sql = `
    SELECT * FROM banners
    ORDER BY sort ASC
  `;

  db.query(sql).then((banners) => {
    res.json({ list: banners });
  }).catch((error) => {
    console.error('获取轮播图列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.post("/api/admin/banners", adminRequired, (req, res) => {
  const { title, image, link = "/products" } = req.body ?? {};
  if (!title || !image) return res.status(400).json({ message: "title 和 image 为必填" });
  
  // 获取最大排序值
  const maxSortSql = "SELECT MAX(sort) as maxSort FROM banners";
  db.query(maxSortSql).then((result) => {
    const maxSort = result[0].maxSort || 0;
    
    // 创建轮播图
    const item = {
      id: `ban_${Date.now()}`,
      title,
      image,
      link,
      sort: maxSort + 1,
      active: true,
      created_at: new Date().toISOString(),
    };
    
    return db.insert('banners', item).then(() => item);
  }).then((item) => {
    res.status(201).json({ item });
  }).catch((error) => {
    console.error('创建轮播图失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.put("/api/admin/banners/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  const { title, image, link, sort } = req.body ?? {};
  
  // 检查轮播图是否存在
  const checkSql = "SELECT * FROM banners WHERE id = ?";
  db.query(checkSql, [id]).then((banners) => {
    if (banners.length === 0) {
      return res.status(404).json({ message: "轮播图不存在" });
    }
    
    // 更新轮播图
    const updateData = {};
    if (title != null) updateData.title = title;
    if (image != null) updateData.image = image;
    if (link != null) updateData.link = link;
    if (sort != null) updateData.sort = Number(sort);
    
    return db.update("banners", id, updateData);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新轮播图失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/banners/:id/status", adminRequired, (req, res) => {
  const { id } = req.params;
  const { active } = req.body ?? {};
  
  // 检查轮播图是否存在
  const checkSql = "SELECT * FROM banners WHERE id = ?";
  db.query(checkSql, [id]).then((banners) => {
    if (banners.length === 0) {
      return res.status(404).json({ message: "轮播图不存在" });
    }
    
    // 更新轮播图状态
    return db.query("UPDATE banners SET active = ? WHERE id = ?", [Boolean(active), id]);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新轮播图状态失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/banners/sort", adminRequired, (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids)) return res.status(400).json({ message: "ids 必须为数组" });
  
  // 批量更新轮播图排序
  const updatePromises = ids.map((id, idx) => {
    return db.query("UPDATE banners SET sort = ? WHERE id = ?", [idx + 1, id]);
  });
  
  Promise.all(updatePromises).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新轮播图排序失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.delete("/api/admin/banners/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  
  // 检查轮播图是否存在
  const checkSql = "SELECT * FROM banners WHERE id = ?";
  db.query(checkSql, [id]).then((banners) => {
    if (banners.length === 0) {
      return res.status(404).json({ message: "轮播图不存在" });
    }
    
    // 删除轮播图
    return db.query("DELETE FROM banners WHERE id = ?", [id]);
  }).then(() => {
    res.status(204).send();
  }).catch((error) => {
    console.error('删除轮播图失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 分类管理 ---
app.get("/api/admin/categories", adminRequired, (_req, res) => {
  // 从数据库获取分类列表
  const sql = `
    SELECT * FROM categories
    ORDER BY sort ASC
  `;

  db.query(sql).then((categories) => {
    res.json({ list: categories });
  }).catch((error) => {
    console.error('获取分类列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.post("/api/admin/categories", adminRequired, (req, res) => {
  const { name, parentId = null, enabled = true } = req.body ?? {};
  if (!name) return res.status(400).json({ message: "name 为必填" });
  
  // 获取同级别分类的最大排序值
  const maxSortSql = "SELECT MAX(sort) as maxSort FROM categories WHERE parentId = ?";
  db.query(maxSortSql, [parentId]).then((result) => {
    const maxSort = result[0].maxSort || 0;
    const sort = maxSort + 1;
    
    // 创建分类
    const item = { 
      id: `cat_${Date.now()}`, 
      name, 
      parentId, 
      sort, 
      enabled: Boolean(enabled) 
    };
    
    return db.insert('categories', item).then(() => item);
  }).then((item) => {
    res.status(201).json({ item });
  }).catch((error) => {
    console.error('创建分类失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.put("/api/admin/categories/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  const { name, enabled } = req.body ?? {};
  
  // 检查分类是否存在
  const checkSql = "SELECT * FROM categories WHERE id = ?";
  db.query(checkSql, [id]).then((categories) => {
    if (categories.length === 0) {
      return res.status(404).json({ message: "分类不存在" });
    }
    
    // 更新分类
    const updateData = {};
    if (name != null) updateData.name = name;
    if (enabled != null) updateData.enabled = Boolean(enabled);
    
    return db.update("categories", id, updateData);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('更新分类失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.delete("/api/admin/categories/:id", adminRequired, (req, res) => {
  const { id } = req.params;
  
  // 检查是否有子分类
  db.query("SELECT COUNT(*) as count FROM categories WHERE parentId = ?", [id]).then((result) => {
    if (result[0].count > 0) {
      return res.status(400).json({ message: "存在子分类，无法删除" });
    }
    
    // 检查是否有商品使用该分类
    return db.query("SELECT COUNT(*) as count FROM products WHERE category_id = ?", [id]).then((result) => {
      if (result[0].count > 0) {
        return res.status(400).json({ message: "分类已被商品使用，无法删除" });
      }
      
      // 删除分类
      return db.query("DELETE FROM categories WHERE id = ?", [id]);
    });
  }).then(() => {
    res.status(204).send();
  }).catch((error) => {
    console.error('删除分类失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 商品审核/全量管理 ---
app.get("/api/admin/products", adminRequired, (req, res) => {
  const { status, keyword } = req.query;
  
  // 构建查询条件
  let sql = `
    SELECT p.*, u.nickname as seller_name, u.id as seller_id
    FROM products p
    LEFT JOIN users u ON p.owner_id = u.id
  `;
  
  const params = [];
  let whereClause = [];
  
  if (status) {
    whereClause.push("p.status = ?");
    params.push(status);
  }
  
  if (keyword) {
    whereClause.push("(p.title LIKE ? OR p.description LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (whereClause.length > 0) {
    sql += " WHERE " + whereClause.join(" AND ");
  }
  
  sql += " ORDER BY p.created_at DESC";
  
  db.query(sql, params).then((products) => {
    res.json({ list: products });
  }).catch((error) => {
    console.error('获取商品列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/products/:id/audit", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { action, reason = "" } = req.body ?? {};
  if (!["approve", "reject", "down"].includes(action)) {
    return res.status(400).json({ message: "action 必须为 approve/reject/down" });
  }
  
  // 检查商品是否存在
  db.getById('products', id).then((p) => {
    if (!p) return res.status(404).json({ message: "商品不存在" });
    
    // 更新商品状态
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (action === "approve") updateData.status = "approved";
    if (action === "reject") {
      updateData.status = "rejected";
      updateData.reject_reason = reason;
    }
    if (action === "down") updateData.status = "down";
    
    return db.update('products', id, updateData).then(() => p);
  }).then((p) => {
    // 创建系统通知
    const notification = {
      id: `notif_${Date.now()}`,
      user_id: p.owner_id,
      type: "product_audit",
      title: "商品审核结果",
      content: action === "approve" ? "您的商品已通过审核，已上架" : action === "reject" ? `您的商品审核驳回：${reason}` : "您的商品已被管理员下架",
      is_read: false,
      created_at: new Date().toISOString(),
      product_id: p.id
    };
    
    return db.insert('notifications', notification).then(() => p);
  }).then((p) => {
    // 记录操作日志
    const log = {
      id: `log_${Date.now()}`,
      user_id: req.auth.uid,
      action: `商品${action === "approve" ? "审核通过" : action === "reject" ? "审核驳回" : "强制下架"}`,
      module: "商品管理",
      content: `商品ID: ${p.id}, 商品名称: ${p.title}`,
      ip: req.ip || "unknown",
      created_at: new Date().toISOString()
    };
    
    return db.insert('logs', log);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('审核商品失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 订单全量管理 ---
app.get("/api/admin/orders", adminRequired, (req, res) => {
  const { status, keyword } = req.query;
  
  // 构建查询条件
  let sql = `
    SELECT o.*, 
           p.title as product_title, 
           p.price as product_price, 
           u1.nickname as buyer_name, 
           u2.nickname as seller_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users u1 ON o.buyer_id = u1.id
    LEFT JOIN users u2 ON o.seller_id = u2.id
  `;
  
  const params = [];
  let whereClause = [];
  
  if (status) {
    whereClause.push("o.status = ?");
    params.push(status);
  }
  
  if (keyword) {
    whereClause.push("(o.orderNo LIKE ? OR p.title LIKE ? OR u1.nickname LIKE ? OR u2.nickname LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  if (whereClause.length > 0) {
    sql += " WHERE " + whereClause.join(" AND ");
  }
  
  sql += " ORDER BY o.created_at DESC";
  
  db.query(sql, params).then((orders) => {
    res.json({ list: orders });
  }).catch((error) => {
    console.error('获取订单列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 投诉与纠纷处理 ---
app.get("/api/admin/complaints", adminRequired, (req, res) => {
  const { status, type } = req.query;
  
  // 构建查询条件
  let sql = `
    SELECT c.*, 
           u.nickname as user_name
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
  `;
  
  const params = [];
  let whereClause = [];
  
  if (status) {
    whereClause.push("c.status = ?");
    params.push(status);
  }
  
  if (type) {
    whereClause.push("c.type = ?");
    params.push(type);
  }
  
  if (whereClause.length > 0) {
    sql += " WHERE " + whereClause.join(" AND ");
  }
  
  sql += " ORDER BY c.created_at DESC";
  
  db.query(sql, params).then((complaints) => {
    res.json({ list: complaints });
  }).catch((error) => {
    console.error('获取投诉列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

app.patch("/api/admin/complaints/:id/handle", adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { status, result } = req.body ?? {};
  
  if (!status || !result) {
    return res.status(400).json({ message: "status 和 result 为必填" });
  }
  
  // 检查投诉是否存在
  db.getById('complaints', id).then((complaint) => {
    if (!complaint) return res.status(404).json({ message: "投诉不存在" });
    
    // 更新投诉状态
    const updateData = {
      status,
      result,
      updated_at: new Date().toISOString()
    };
    
    return db.update('complaints', id, updateData).then(() => complaint);
  }).then((complaint) => {
    // 创建系统通知
    const notification = {
      id: `notif_${Date.now()}`,
      user_id: complaint.user_id,
      type: "complaint_result",
      title: "投诉处理结果",
      content: `您的投诉已处理：${result}`,
      is_read: false,
      created_at: new Date().toISOString(),
      complaint_id: complaint.id
    };
    
    return db.insert('notifications', notification).then(() => complaint);
  }).then((complaint) => {
    // 记录操作日志
    const log = {
      id: `log_${Date.now()}`,
      user_id: req.auth.uid,
      action: "处理投诉",
      module: "投诉管理",
      content: `投诉ID: ${complaint.id}, 处理结果: ${result}`,
      ip: req.ip || "unknown",
      created_at: new Date().toISOString()
    };
    
    return db.insert('logs', log);
  }).then(() => {
    res.json({ message: "ok" });
  }).catch((error) => {
    console.error('处理投诉失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 操作日志管理 ---
app.get("/api/admin/logs", adminRequired, (req, res) => {
  const { action, module, startDate, endDate } = req.query;
  
  // 构建查询条件
  let sql = `
    SELECT l.*, 
           u.nickname as user_name
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
  `;
  
  const params = [];
  let whereClause = [];
  
  if (action) {
    whereClause.push("l.action LIKE ?");
    params.push(`%${action}%`);
  }
  
  if (module) {
    whereClause.push("l.module LIKE ?");
    params.push(`%${module}%`);
  }
  
  if (startDate) {
    whereClause.push("l.created_at >= ?");
    params.push(startDate);
  }
  
  if (endDate) {
    whereClause.push("l.created_at <= ?");
    params.push(endDate);
  }
  
  if (whereClause.length > 0) {
    sql += " WHERE " + whereClause.join(" AND ");
  }
  
  sql += " ORDER BY l.created_at DESC";
  
  db.query(sql, params).then((logs) => {
    res.json({ list: logs });
  }).catch((error) => {
    console.error('获取操作日志失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 评价与内容审核 ---
app.get("/api/admin/evaluations", adminRequired, (req, res) => {
  // 从数据库获取评价列表
  const sql = `
    SELECT e.*, 
           u1.nickname as user_name, 
           u2.nickname as target_name,
           o.orderNo as order_no
    FROM evaluations e
    LEFT JOIN users u1 ON e.user_id = u1.id
    LEFT JOIN users u2 ON e.target_id = u2.id
    LEFT JOIN orders o ON e.order_id = o.id
    ORDER BY e.created_at DESC
  `;

  db.query(sql).then((evaluations) => {
    res.json({ list: evaluations });
  }).catch((error) => {
    console.error('获取评价列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// --- Admin: 物品收藏管理 ---
app.get("/api/admin/favorites", adminRequired, (req, res) => {
  const { product_id, user_id } = req.query;
  
  // 构建查询条件
  let sql = `
    SELECT f.*, 
           u.nickname as user_name, 
           p.title as product_title,
           p.price as product_price
    FROM favorites f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN products p ON f.product_id = p.id
  `;
  
  const params = [];
  let whereClause = [];
  
  if (product_id) {
    whereClause.push("f.product_id = ?");
    params.push(product_id);
  }
  
  if (user_id) {
    whereClause.push("f.user_id = ?");
    params.push(user_id);
  }
  
  if (whereClause.length > 0) {
    sql += " WHERE " + whereClause.join(" AND ");
  }
  
  sql += " ORDER BY f.created_at DESC";
  
  db.query(sql, params).then((favorites) => {
    res.json({ list: favorites });
  }).catch((error) => {
    console.error('获取收藏列表失败:', error);
    return res.status(500).json({ message: "服务器内部错误" });
  });
});

// 初始化数据库
async function initDb() {
  try {
    // 优先初始化 MySQL 数据库
    await db.initDatabase();
    console.log('MySQL 数据库初始化成功');
  } catch (mysqlError) {
    console.error('MySQL 数据库初始化失败，尝试切换到 SQLite:', mysqlError.message);
    try {
      db = sqliteDb;
      await db.initDatabase();
      useJsonDb = false;
      console.log('SQLite 数据库初始化成功');
    } catch (sqliteError) {
      console.error('SQLite 数据库初始化失败，切换到本地 JSON 存储:', sqliteError.message);
      db = createJsonDbAdapter(jsonDb);
      useJsonDb = true;
      seedIfEmpty();
      console.log('本地 JSON 存储初始化成功');
    }
  }
}

// AI 生成商品描述和价格估计
app.post('/api/ai/generate-product', async (req, res) => {
  try {
    const { description, images } = req.body;
    
    if (!description && !images) {
      return res.status(400).json({ error: '请提供商品描述或图片' });
    }

    // 构建提示词
    let prompt = `你是一个专业的二手商品描述专家，帮我为以下商品生成一个完整且简练的商品介绍，并根据市场情况估计一个合理的价格。\n\n`;
    
    if (description) {
      prompt += `商品描述：${description}\n\n`;
    }
    
    if (images && images.length > 0) {
      prompt += `商品图片：${images.length}张\n\n`;
      // 如果有图片，提示模型分析图片内容
      prompt += `请仔细分析图片内容，识别商品的类型、品牌、型号、成色等信息，并在生成的描述中体现出来。\n\n`;
    }
    
    prompt += `要求：\n1. 生成的描述要专业、详细，突出商品的特点和优势\n2. 描述结构清晰，包括商品特点、使用情况、转手原因、交易方式等\n3. 价格估计要合理，基于市场情况和商品状况\n4. 自动识别商品的分类和成色，并在描述中明确体现\n5. 输出格式：\n   - 分类：商品分类\n   - 成色：商品成色\n   - 描述：商品描述\n   - 价格估计：¥XXX\n\n请严格按照上述格式输出，不要添加任何其他内容。`;

    try {
      // 检查科大讯飞 API 配置是否完整
      if (!xfAppId || !xfApiKey || !xfApiSecret) {
        throw new Error('科大讯飞 API 配置不完整');
      }

      // 生成 HMAC 签名
      const date = new Date();
      const timestamp = Math.floor(date.getTime() / 1000);
      const dateStr = date.toUTCString();
      const requestPath = "/v1/chat/completions";
      const signatureOrigin = `host: spark-api-open.xf-yun.com\ndate: ${dateStr}\nPOST ${requestPath} HTTP/1.1`;
      const signature = crypto.createHmac('sha256', xfApiSecret)
        .update(signatureOrigin)
        .digest('base64');
      const authorization = `api_key="${xfApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;

      // 构建消息内容
      const messages = [
        {
          role: "system",
          content: "你是一个专业的二手商品描述专家，擅长生成详细、准确的商品介绍和合理的价格估计。你能够根据商品描述和图片识别商品的类型、品牌、型号、成色等信息，并生成专业的商品描述。"
        },
        {
          role: "user",
          content: prompt
        }
      ];

      // 如果有图片，添加图片数据
      if (images && images.length > 0) {
        // 假设 images 是 base64 编码的图片数组
        images.forEach((image, index) => {
          messages.push({
            role: "user",
            content: `图片 ${index + 1}：data:image/jpeg;base64,${image}`
          });
        });
      }

      // 调用科大讯飞星火认知大模型 API (HTTP 接口)
      const response = await axios.post(
        "https://spark-api-open.xf-yun.com/v1/chat/completions",
        {
          model: "4.0Ultra",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Host": "spark-api-open.xf-yun.com",
            "Date": dateStr,
            "Authorization": authorization
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      
      // 提取价格信息
      let estimatedPrice = '3500'; // 默认价格
      const priceMatch = aiResponse.match(/价格[:：]\s*¥?\s*(\d+)/);
      if (priceMatch) {
        estimatedPrice = priceMatch[1].trim();
      }
      
      // 生成商品描述（移除分类、成色和价格信息）
      let generatedDescription = aiResponse
        .split('\n')
        .filter(line => {
          // 移除包含分类、成色和价格的行
          return !line.includes('分类') && !line.includes('成色') && !line.includes('价格');
        })
        .join('\n');
      
      // 移除末尾的换行符
      generatedDescription = generatedDescription.trim();

      res.json({
        description: generatedDescription,
        price: estimatedPrice
      });
    } catch (error) {
      console.error('科大讯飞 API 调用失败，使用模拟数据:', error);
      console.error('错误响应数据:', error.response?.data);
      console.error('错误状态码:', error.response?.status);
      // 当科大讯飞 API 调用失败时，使用模拟数据
      const mockDescriptions = {
        'iPad Air 5 256G 99新，使用3个月': {
          category: '平板电脑',
          condition: '99新',
          description: '【99新 iPad Air 5 256G】\n\n商品特点：\n- 搭载 M1 芯片，性能强劲，流畅运行各种应用\n- 10.9 英寸 Liquid 视网膜显示屏，色彩鲜艳，视觉效果出色\n- 256GB 大容量存储，满足日常使用需求\n- 支持 Apple Pencil 2 代，适合绘画和笔记\n- 支持 Face ID，解锁快捷安全\n\n使用情况：\n- 购买于3个月前，仅轻度使用\n- 无任何划痕或磕碰，成色如新\n- 电池健康度 100%\n- 所有功能正常，无任何问题\n\n转手原因：\n- 升级到了 iPad Pro，故出售\n\n交易方式：\n- 支持当面交易，可验机\n- 支持邮寄，包邮\n- 赠送原装充电器和数据线',
          price: '3500'
        },
        'iPhone 13 Pro 128G 9成新，使用1年': {
          category: '手机',
          condition: '9成新',
          description: '【9成新 iPhone 13 Pro 128G】\n\n商品特点：\n- A15 仿生芯片，性能强大，运行流畅\n- 6.1 英寸 Super Retina XDR 显示屏，支持 ProMotion 自适应刷新率\n- 128GB 存储空间，满足日常使用\n- 三摄系统，支持夜景模式和微距摄影\n- 支持 Face ID，解锁快捷安全\n\n使用情况：\n- 购买于1年前，正常使用\n- 轻微使用痕迹，无重大划痕或磕碰\n- 电池健康度 85%\n- 所有功能正常，无任何问题\n\n转手原因：\n- 升级到了 iPhone 14 Pro，故出售\n\n交易方式：\n- 支持当面交易，可验机\n- 支持邮寄，包邮\n- 赠送原装充电器和数据线',
          price: '4200'
        },
        'MacBook Air M2 8GB+256GB 95新，使用6个月': {
          category: '笔记本电脑',
          condition: '95新',
          description: '【95新 MacBook Air M2 8GB+256GB】\n\n商品特点：\n- M2 芯片，性能强劲，续航出色\n- 13.6 英寸 Liquid 视网膜显示屏，色彩鲜艳\n- 8GB 内存 + 256GB SSD 存储，满足日常办公需求\n- 超薄机身，重量仅 1.24kg，便于携带\n- 支持 Touch ID，解锁快捷安全\n\n使用情况：\n- 购买于6个月前，仅用于办公\n- 无任何划痕或磕碰，成色接近全新\n- 电池循环次数较少\n- 所有功能正常，无任何问题\n\n转手原因：\n- 公司配备了新电脑，故出售\n\n交易方式：\n- 支持当面交易，可验机\n- 支持邮寄，包邮\n- 赠送原装充电器和充电线',
          price: '6500'
        }
      };

      // 查找匹配的模拟数据
      let generatedDescription = '商品描述生成失败，请重试';
      let estimatedPrice = '1000'; // 默认价格
      
      for (const key in mockDescriptions) {
        if (description.includes(key)) {
          generatedDescription = mockDescriptions[key].description;
          estimatedPrice = mockDescriptions[key].price;
          break;
        }
      }

      // 如果没有匹配的模拟数据，使用通用模板
      if (generatedDescription === '商品描述生成失败，请重试') {
        generatedDescription = `【二手${description}】\n\n商品特点：\n- 成色良好，功能正常\n- 性价比高\n- 质量可靠，经久耐用\n- 外观时尚，设计精美\n\n使用情况：\n- 正常使用痕迹，无重大损坏\n- 所有功能正常，无任何问题\n- 定期保养，状态良好\n\n转手原因：\n- 闲置不用，寻找有缘人\n- 升级换代，故出售\n\n交易方式：\n- 支持当面交易，可验机\n- 支持邮寄，包邮\n- 赠送相关配件\n\n温馨提示：\n- 商品一经售出，概不退换\n- 如有任何疑问，欢迎随时咨询`;
      }

      res.json({
        description: generatedDescription,
        price: estimatedPrice
      });
    }
  } catch (error) {
    console.error('AI 生成失败:', error);
    res.status(500).json({ error: 'AI 生成失败，请重试' });
  }
});

// 推荐系统模块

// 内存缓存
const recommendCache = new Map();
const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟

// 记录用户浏览行为
app.post('/api/recommend/record-view', authRequired, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.auth.uid;
    
    if (!productId) {
      return res.status(400).json({ error: '商品 ID 为必填' });
    }
    
    // 从数据库获取商品标签
    const productTags = await db.query('SELECT tag_name FROM product_tags WHERE product_id = ?', [productId]);
    
    if (productTags.length === 0) {
      // 如果商品没有标签，生成默认标签
      const product = await db.getById('products', productId);
      if (product) {
        // 简单的标签生成逻辑
        const title = product.title || '';
        const description = product.description || '';
        const content = `${title} ${description}`;
        
        // 提取关键词作为标签
        const keywords = [
          '手机', '平板', '电脑', '相机', '耳机', '手表',
          '教材', '书籍', '文具', '运动', '健身', '乐器',
          '衣服', '鞋子', '包包', '配件', '其他'
        ];
        
        const tags = keywords.filter(keyword => content.includes(keyword));
        
        // 如果没有匹配的标签，使用默认标签
        if (tags.length === 0) {
          tags.push('其他');
        }
        
        // 插入商品标签
        for (const tagName of tags) {
          await db.query("INSERT OR IGNORE INTO product_tags (product_id, tag_name) VALUES (?, ?)", [productId, tagName]);
        }
        
        // 更新 productTags
        productTags.push(...tags.map(tagName => ({ tag_name: tagName })));
      }
    }
    
    // 更新用户标签权重
    const now = new Date().toISOString();
    for (const { tag_name } of productTags) {
      await db.query(
        "INSERT INTO user_tags (user_id, tag_name, weight, update_time) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, tag_name) DO UPDATE SET weight = user_tags.weight + 1, update_time = excluded.update_time",
        [userId, tag_name, now]
      );
    }
    
    res.json({ success: true, message: '浏览行为记录成功' });
  } catch (error) {
    console.error('记录浏览行为失败:', error);
    res.status(500).json({ error: '记录浏览行为失败' });
  }
});

// 推荐查询接口
app.get('/api/recommend/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    
    // 检查缓存
    const cacheKey = `recommend_${userId}`;
    if (recommendCache.has(cacheKey)) {
      const cachedData = recommendCache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < CACHE_EXPIRE_TIME) {
        return res.json(cachedData.data);
      }
    }
    
    // 查询预计算推荐结果
    const recommendProducts = await db.query(
      'SELECT product_id, score FROM user_recommend WHERE user_id = ? ORDER BY score DESC LIMIT 10'
    , [userId]);
    
    if (recommendProducts.length > 0) {
      // 批量查询商品详情
      const productIds = recommendProducts.map(item => item.product_id);
      const products = await db.query(
        `SELECT p.*, u.name as owner_name 
         FROM products p 
         LEFT JOIN users u ON p.owner_id = u.id 
         WHERE p.id IN (${productIds.map(() => '?').join(', ')}) 
         AND p.status <> 'deleted'`
      , productIds);
      
      // 按推荐分数排序
      const productMap = new Map(products.map(p => [p.id, p]));
      const sortedProducts = recommendProducts
        .map(item => productMap.get(item.product_id))
        .filter(Boolean);
      
      // 缓存结果
      recommendCache.set(cacheKey, {
        data: sortedProducts,
        timestamp: Date.now()
      });
      
      return res.json(sortedProducts);
    } else {
      // 兜底：返回热门商品
      const hotProducts = await db.query(
        `SELECT p.*, u.name as owner_name 
         FROM products p 
         LEFT JOIN users u ON p.owner_id = u.id 
         WHERE p.status <> 'deleted' 
         ORDER BY p.views DESC, p.favorites DESC LIMIT 10`
      );
      
      // 缓存结果
      recommendCache.set(cacheKey, {
        data: hotProducts,
        timestamp: Date.now()
      });
      
      return res.json(hotProducts);
    }
  } catch (error) {
    console.error('获取推荐失败:', error);
    
    // 异常：返回缓存旧数据
    const cacheKey = `recommend_${req.params.userId}`;
    if (recommendCache.has(cacheKey)) {
      return res.json(recommendCache.get(cacheKey).data);
    }
    
    // 缓存与 DB 均不可用：返回空数组
    return res.json([]);
  }
});

// 定时任务：生成推荐结果
async function generateRecommendations() {
  try {
    console.log('开始生成推荐结果...');
    
    // 获取所有用户
    const users = await db.query('SELECT id FROM users');
    
    for (const user of users) {
      const userId = user.id;
      
      // 获取用户标签权重
      const userTags = await db.query(
        'SELECT tag_name, weight FROM user_tags WHERE user_id = ? ORDER BY weight DESC'
      , [userId]);
      
      if (userTags.length > 0) {
        // 构建用户兴趣向量
        const userInterest = new Map();
        userTags.forEach(tag => {
          userInterest.set(tag.tag_name, tag.weight);
        });
        
        // 获取所有商品及其标签
        const products = await db.query('SELECT id FROM products WHERE status <> "deleted"');
        
        const recommendations = [];
        
        for (const product of products) {
          const productId = product.id;
          
          // 获取商品标签
          const productTags = await db.query('SELECT tag_name FROM product_tags WHERE product_id = ?', [productId]);
          
          if (productTags.length > 0) {
            // 计算商品与用户兴趣的匹配度
            let score = 0;
            let totalWeight = 0;
            
            productTags.forEach(tag => {
              const weight = userInterest.get(tag.tag_name) || 0;
              score += weight;
              totalWeight += 1;
            });
            
            if (totalWeight > 0) {
              score = score / totalWeight;
              recommendations.push({ productId, score });
            }
          }
        }
        
        // 按分数排序，取前 10 个
        recommendations.sort((a, b) => b.score - a.score);
        const topRecommendations = recommendations.slice(0, 10);
        
        // 清空旧推荐结果
        await db.query('DELETE FROM user_recommend WHERE user_id = ?', [userId]);
        
        // 插入新推荐结果
        const now = new Date().toISOString();
        for (const rec of topRecommendations) {
          await db.query(
            'INSERT INTO user_recommend (user_id, product_id, score, create_time) VALUES (?, ?, ?, ?)',
            [userId, rec.productId, rec.score, now]
          );
        }
      }
    }
    
    console.log('推荐结果生成完成');
  } catch (error) {
    console.error('生成推荐结果失败:', error);
  }
}

// 测试页面
app.get('/recommend-test', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>推荐系统测试</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          input { margin: 5px; padding: 8px; }
          button { margin: 5px; padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
          button:hover { background: #0069d9; }
          #result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>推荐系统测试</h1>
        
        <div class="test-section">
          <h2>1. 记录浏览行为</h2>
          <input type="number" id="userId" placeholder="用户 ID">
          <input type="number" id="productId" placeholder="商品 ID">
          <button onclick="recordView()">记录浏览</button>
        </div>
        
        <div class="test-section">
          <h2>2. 获取推荐</h2>
          <input type="number" id="recommendUserId" placeholder="用户 ID">
          <button onclick="getRecommend()">获取推荐</button>
        </div>
        
        <div class="test-section">
          <h2>3. 手动生成推荐</h2>
          <button onclick="generateRecommend()">生成推荐</button>
        </div>
        
        <div id="result"></div>
        
        <script>
          async function recordView() {
            const userId = document.getElementById('userId').value;
            const productId = document.getElementById('productId').value;
            
            const response = await fetch('/api/recommend/record-view', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer demo-token'
              },
              body: JSON.stringify({ productId: parseInt(productId) })
            });
            
            const result = await response.json();
            document.getElementById('result').innerHTML = JSON.stringify(result, null, 2);
          }
          
          async function getRecommend() {
            const userId = document.getElementById('recommendUserId').value;
            const response = await fetch('/api/recommend/' + userId);
            const result = await response.json();
            document.getElementById('result').innerHTML = JSON.stringify(result, null, 2);
          }
          
          async function generateRecommend() {
            // 这里需要添加一个 API 接口来触发推荐生成
            document.getElementById('result').innerHTML = '推荐生成任务已启动，请查看服务器日志';
          }
        </script>
      </body>
    </html>
  `);
});

// 启动定时任务（每天凌晨 2:00 执行）
function scheduleGenerateRecommendations() {
  const now = new Date();
  const scheduledTime = new Date(now);
  scheduledTime.setHours(2, 0, 0, 0);
  
  if (scheduledTime < now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }
  
  const delay = scheduledTime - now;
  
  setTimeout(() => {
    generateRecommendations();
    // 每天执行一次
    setInterval(generateRecommendations, 24 * 60 * 60 * 1000);
  }, delay);
}

// 启动定时任务
scheduleGenerateRecommendations();

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDb();
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    // 切换到本地 JSON 存储
    db = createJsonDbAdapter(jsonDb);
    useJsonDb = true;
    // 初始化本地 JSON 数据
    seedIfEmpty();
    console.log('本地 JSON 存储初始化成功');
  }
  
  // 启动服务器
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

export { app, startServer };

