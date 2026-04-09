export function applyAdminProductRoutes(router, { db, adminRequired }) {
  // --- Admin: 商品管理 ---
  router.get("/admin/products", adminRequired, (req, res) => {
    const { status, keyword } = req.query;

    let sql = `
    SELECT p.*, u.nickname as seller_name, u.id as seller_id
    FROM products p
    LEFT JOIN users u ON p.owner_id = u.id
  `;

    const params = [];
    const whereClause = [];

    if (status) {
      whereClause.push("p.status = ?");
      params.push(status);
    } else {
      // 默认不返回已删除
      whereClause.push("p.status <> 'deleted'");
    }

    if (keyword) {
      whereClause.push("(p.title LIKE ? OR p.description LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (whereClause.length > 0) {
      sql += " WHERE " + whereClause.join(" AND ");
    }

    sql += " ORDER BY p.created_at DESC";

    db.query(sql, params)
      .then((products) => {
        res.json({ list: products });
      })
      .catch((error) => {
        console.error("获取商品列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.get("/admin/products/:id", adminRequired, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "无效的商品ID" });
    }

    const sql = `
      SELECT p.*, u.nickname as seller_name, u.id as seller_id
      FROM products p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
      LIMIT 1
    `;

    db.query(sql, [id])
      .then((rows) => {
        const p = rows?.[0] || null;
        if (!p) return res.status(404).json({ message: "商品不存在" });
        return res.json({ item: p });
      })
      .catch((error) => {
        console.error("获取商品详情失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/products/:id", adminRequired, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "无效的商品ID" });
    }

    const payload = req.body ?? {};
    const { title, description, price, image_url, condition, category_id, campus, reject_reason, images } = payload;

    db.getById("products", id)
      .then((p) => {
        if (!p) return res.status(404).json({ message: "商品不存在" });
        if (p.status === "deleted") return res.status(400).json({ message: "商品已删除" });

        const updateData = {};
        if (title != null) updateData.title = String(title);
        if (description != null) updateData.description = String(description);
        if (price != null) updateData.price = price;
        if (image_url != null) updateData.image_url = String(image_url);
        if (condition != null) updateData.condition = String(condition);
        if (category_id != null) updateData.category_id = String(category_id);
        if (campus != null) updateData.campus = String(campus);
        if (reject_reason != null) updateData.reject_reason = String(reject_reason);

        // images 字段：优先使用传入的 images，其次在 image_url 变更时同步为单图数组
        if (images != null) {
          updateData.images = Array.isArray(images) ? JSON.stringify(images) : images;
        } else if (image_url != null) {
          updateData.images = JSON.stringify([String(image_url)]);
        }

        updateData.updated_at = new Date().toISOString();

        return db.update("products", id, updateData).then(() => p);
      })
      .then((p) => {
        if (!p || !p.id) return;
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "编辑商品",
          module: "商品管理",
          content: `商品ID: ${p.id}, 商品名称: ${p.title}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("更新商品失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/products/:id/status", adminRequired, (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    if (!["approved", "down", "deleted"].includes(status)) {
      return res.status(400).json({ message: "status 必须为 approved/down/deleted" });
    }

    db.getById("products", id)
      .then((p) => {
        if (!p) return res.status(404).json({ message: "商品不存在" });
        return db.update("products", id, { status, updated_at: new Date().toISOString() }).then(() => p);
      })
      .then((p) => {
        const actionText = status === "approved" ? "上架" : status === "down" ? "下架/隐藏" : "删除";
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: `商品${actionText}`,
          module: "商品管理",
          content: `商品ID: ${p.id}, 商品名称: ${p.title}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("更新商品状态失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

