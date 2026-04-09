import express from "express";

import { applyAdminAiPromptRoutes } from "./admin/ai-prompts.js";
import { applyAdminAnnouncementRoutes } from "./admin/announcements.js";
import { applyAdminBannerRoutes } from "./admin/banners.js";
import { applyAdminCategoryRoutes } from "./admin/categories.js";
import { applyAdminComplaintRoutes } from "./admin/complaints.js";
import { applyAdminDictRoutes } from "./admin/dicts.js";
import { applyAdminEvaluationRoutes } from "./admin/evaluations.js";
import { applyAdminFavoriteRoutes } from "./admin/favorites.js";
import { applyAdminLogRoutes } from "./admin/logs.js";
import { applyAdminOrderRoutes } from "./admin/orders.js";
import { applyAdminProductRoutes } from "./admin/products.js";
import { applyAdminStatsRoutes } from "./admin/stats.js";
import { applyAdminUserRoutes } from "./admin/users.js";

export function createAdminRouter({
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
}) {
  const router = express.Router();

  applyAdminAiPromptRoutes(router, { db, adminRequired });
  applyAdminUserRoutes(router, { db, adminRequired, hashPassword });
  applyAdminStatsRoutes(router, { db, adminRequired });
  applyAdminAnnouncementRoutes(router, { db, adminRequired });
  applyAdminBannerRoutes(router, {
    db,
    adminRequired,
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
  });
  applyAdminCategoryRoutes(router, { db, adminRequired });
  applyAdminDictRoutes(router, { db, adminRequired });
  applyAdminProductRoutes(router, { db, adminRequired });
  applyAdminOrderRoutes(router, { db, adminRequired });
  applyAdminComplaintRoutes(router, { db, adminRequired });
  applyAdminLogRoutes(router, { db, adminRequired });
  applyAdminEvaluationRoutes(router, { db, adminRequired });
  applyAdminFavoriteRoutes(router, { db, adminRequired });

  return router;
}

