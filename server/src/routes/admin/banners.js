export function applyAdminBannerRoutes(
  router,
  { db, adminRequired, upload, crypto, fs, path, UPLOADS_DIR, ossReady, s3Client, PutObjectCommand, OSS_BUCKET, OSS_PUBLIC_BASE_URL }
) {
  // --- Admin: 轮播图管理 ---
  router.get("/admin/banners", adminRequired, (_req, res) => {
    const sql = `
    SELECT * FROM banners
    ORDER BY sort ASC
  `;

    db.query(sql)
      .then((banners) => {
        res.json({ list: banners });
      })
      .catch((error) => {
        console.error("获取轮播图列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/banners", adminRequired, (req, res) => {
    const { title, image, link = "/products" } = req.body ?? {};
    if (!title || !image) return res.status(400).json({ message: "title 和 image 为必填" });

    const maxSortSql = "SELECT MAX(sort) as maxSort FROM banners";
    db.query(maxSortSql)
      .then((result) => {
        const maxSort = result[0].maxSort || 0;

        const item = {
          id: `ban_${Date.now()}`,
          title,
          image,
          link,
          sort: maxSort + 1,
          active: true,
          created_at: new Date().toISOString(),
        };

        return db.insert("banners", item).then(() => item);
      })
      .then((item) => {
        res.status(201).json({ item });
      })
      .catch((error) => {
        console.error("创建轮播图失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/banners/:id", adminRequired, (req, res) => {
    const { id } = req.params;
    const { title, image, link, sort } = req.body ?? {};

    const checkSql = "SELECT * FROM banners WHERE id = ?";
    db.query(checkSql, [id])
      .then((banners) => {
        if (banners.length === 0) {
          return res.status(404).json({ message: "轮播图不存在" });
        }

        const updateData = {};
        if (title != null) updateData.title = title;
        if (image != null) updateData.image = image;
        if (link != null) updateData.link = link;
        if (sort != null) updateData.sort = Number(sort);

        return db.update("banners", id, updateData);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新轮播图失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/banners/:id/status", adminRequired, (req, res) => {
    const { id } = req.params;
    const { active } = req.body ?? {};

    const checkSql = "SELECT * FROM banners WHERE id = ?";
    db.query(checkSql, [id])
      .then((banners) => {
        if (banners.length === 0) {
          return res.status(404).json({ message: "轮播图不存在" });
        }
        return db.query("UPDATE banners SET active = ? WHERE id = ?", [Boolean(active), id]);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新轮播图状态失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/banners/sort", adminRequired, (req, res) => {
    const { ids } = req.body ?? {};
    if (!Array.isArray(ids)) return res.status(400).json({ message: "ids 必须为数组" });

    const updatePromises = ids.map((id, idx) => {
      return db.query("UPDATE banners SET sort = ? WHERE id = ?", [idx + 1, id]);
    });

    Promise.all(updatePromises)
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新轮播图排序失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.delete("/admin/banners/:id", adminRequired, (req, res) => {
    const { id } = req.params;

    const checkSql = "SELECT * FROM banners WHERE id = ?";
    db.query(checkSql, [id])
      .then((banners) => {
        if (banners.length === 0) {
          return res.status(404).json({ message: "轮播图不存在" });
        }
        return db.query("DELETE FROM banners WHERE id = ?", [id]);
      })
      .then(() => {
        res.status(204).send();
      })
      .catch((error) => {
        console.error("删除轮播图失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  // --- Admin: 轮播图图片上传 ---
  router.post("/admin/banners/upload", adminRequired, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "file 为必填" });

    try {
      const folder = "banners";
      const originalName = req.file.originalname || "banner.bin";
      const ext = originalName.includes(".") ? originalName.split(".").pop() : "";
      const datePath = new Date().toISOString().slice(0, 10);
      const filename = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext ? `.${ext}` : ""}`;

      if (ossReady && s3Client) {
        const key = `${folder}/${datePath}/${filename}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: OSS_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype || "application/octet-stream",
          })
        );

        const publicBase = String(OSS_PUBLIC_BASE_URL || "").replace(/\/$/, "");
        const publicUrl = publicBase ? `${publicBase}/${OSS_BUCKET}/${key}` : null;
        const base = `${req.protocol}://${req.get("host")}`;
        const proxyPath = `/api/oss/object?key=${encodeURIComponent(key)}`;
        const proxyUrl = `${base}${proxyPath}`;

        return res.json({
          key,
          bucket: OSS_BUCKET,
          url: publicUrl || proxyUrl,
          path: proxyPath,
        });
      }

      const relativePath = path.posix.join(folder, datePath, filename);
      const absolutePath = path.join(UPLOADS_DIR, folder, datePath, filename);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, req.file.buffer);

      const base = `${req.protocol}://${req.get("host")}`;
      return res.json({
        url: `${base}/uploads/${relativePath.replace(/\\/g, "/")}`,
        path: `/uploads/${relativePath.replace(/\\/g, "/")}`,
      });
    } catch (error) {
      console.error("轮播图上传失败:", error);
      return res.status(500).json({ message: "上传失败" });
    }
  });
}

