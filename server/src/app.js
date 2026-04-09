import "dotenv/config";
import express from "express";
import { mysqlDb } from "./db/index.js";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import axios from "axios";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import { createAuthRouter } from "./routes/auth-routes.js";
import { createPublicRouter } from "./routes/public-routes.js";
import { createProductRouter } from "./routes/product-routes.js";
import { createUserRouter } from "./routes/user-routes.js";
import { createTradeRouter } from "./routes/trade-routes.js";
import { createAdminRouter } from "./routes/admin-routes.js";
import { createRecommendRouter } from "./routes/recommend-routes.js";
import { createOssRouter } from "./routes/oss-routes.js";
import { createAiRouter } from "./routes/ai-routes.js";
import { setupAppMiddlewares } from "./setup/app-middlewares.js";
import { buildSmsService } from "./services/sms-service.js";
import bcrypt from "bcryptjs";

// 数据库连接状态
const db = mysqlDb;

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN_SECRET = process.env.TOKEN_SECRET;
const PASSWORD_SALT = process.env.PASSWORD_SALT;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
if (!TOKEN_SECRET) {
  throw new Error("Missing required env var: TOKEN_SECRET");
}
if (!Number.isFinite(BCRYPT_ROUNDS) || BCRYPT_ROUNDS < 8 || BCRYPT_ROUNDS > 15) {
  throw new Error("Invalid env var: BCRYPT_ROUNDS (recommended 10-12)");
}

// 科大讯飞星火认知大模型 API 配置
const xfWsUrl = process.env.XF_WS_URL || "wss://spark-api.xf-yun.com/v4.0/chat";
const xfDomain = process.env.XF_DOMAIN || "4.0Ultra";
const xfAppId = process.env.XF_APP_ID || "";
const xfApiKey = process.env.XF_API_KEY || "";
const xfApiSecret = process.env.XF_API_SECRET || "";

// 短信（push.spug.cc）配置
const SPUG_SMS_TEMPLATE_ID = process.env.SPUG_SMS_TEMPLATE_ID || "";
const SPUG_SMS_SIGN_NAME = process.env.SPUG_SMS_SIGN_NAME || "推送助手";
if (!SPUG_SMS_TEMPLATE_ID) {
  throw new Error("Missing required env var: SPUG_SMS_TEMPLATE_ID");
}
const smsService = buildSmsService({
  fetchImpl: globalThis.fetch,
  templateId: SPUG_SMS_TEMPLATE_ID,
  signName: SPUG_SMS_SIGN_NAME,
});

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

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

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
  if (!PASSWORD_SALT) {
    throw new Error("Missing required env var: PASSWORD_SALT (needed for legacy md5 password compatibility)");
  }
  return `md5:${crypto.createHash("md5").update(`${PASSWORD_SALT}:${password}`).digest("hex")}`;
}

async function hashPassword(password) {
  return await bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  const plain = String(password || "");
  const stored = String(passwordHash || "");

  // legacy shortcuts (kept for compatibility with existing db/seed data)
  if (stored === "demo") {
    const ok = plain === "demo";
    return { ok, needsUpgrade: ok };
  }
  if (stored === plain) {
    return { ok: true, needsUpgrade: true };
  }
  if (stored.startsWith("md5:")) {
    return { ok: stored === hashPasswordMD5(plain), needsUpgrade: true };
  }

  // bcrypt hash
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return { ok: await bcrypt.compare(plain, stored), needsUpgrade: false };
  }

  return { ok: false, needsUpgrade: false };
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

setupAppMiddlewares(app, { UPLOADS_DIR });
app.use(
  "/api/auth",
  createAuthRouter({
    db,
    createToken,
    hashPassword,
    verifyPassword,
    authRequired,
    smsService,
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
    hashPassword,
    verifyPassword,
    authRequired,
    smsService,
  })
);
app.use(
  "/api",
  createTradeRouter({
    db,
    authRequired,
  })
);
app.use(
  "/api",
  createAdminRouter({
    db,
    adminRequired,
    hashPassword,
    upload,
    crypto,
    fs,
    path,
    UPLOADS_DIR,
    ossReady,
    s3Client,
    PutObjectCommand,
    OSS_BUCKET,
    OSS_PUBLIC_BASE_URL,
  })
);
app.use(
  "/api",
  createRecommendRouter({
    db,
    authRequired,
    getDb: () => db,
  })
);
app.use("/api", createPublicRouter({ db }));
app.use(
  "/api",
  createOssRouter({
    authRequired,
    upload,
    crypto,
    getSignedUrl,
    PutObjectCommand,
    GetObjectCommand,
    ossReady,
    s3Client,
    OSS_PROVIDER,
    OSS_BUCKET,
    OSS_PUBLIC_BASE_URL,
    OSS_UPLOAD_EXPIRES,
  })
);
app.use(
  "/api",
  createAiRouter({
    db,
    crypto,
    xfWsUrl,
    xfDomain,
    xfAppId,
    xfApiKey,
    xfApiSecret,
  })
);

// 前端静态资源（生产环境 build 后由同一进程托管；开发环境不影响）
const WEB_DIST_DIR = path.resolve("dist");
const WEB_INDEX_HTML = path.join(WEB_DIST_DIR, "index.html");
if (fsSync.existsSync(WEB_DIST_DIR) && fsSync.existsSync(WEB_INDEX_HTML)) {
  app.use(express.static(WEB_DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    return res.sendFile(WEB_INDEX_HTML);
  });
}

// 初始化数据库
async function initDb() {
  // 本项目仅使用 MySQL
  await db.initDatabase();
  console.log("MySQL 数据库初始化成功");
}

// 启动服务器
async function startServer() {
  // 初始化数据库（仅 MySQL）
  await initDb();
  
  // 启动服务器
  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

export { app, startServer };

