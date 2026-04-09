export function applyAdminCategoryRoutes(router, { db, adminRequired }) {
  // --- Admin: 分类管理 ---
  router.get("/admin/categories", adminRequired, (_req, res) => {
    const sql = `
    SELECT * FROM categories
    ORDER BY sort ASC
  `;

    db.query(sql)
      .then((categories) => {
        res.json({ list: categories });
      })
      .catch((error) => {
        console.error("获取分类列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/categories", adminRequired, (req, res) => {
    const { name, parentId = null, enabled = true } = req.body ?? {};
    if (!name) return res.status(400).json({ message: "name 为必填" });

    const maxSortSql = "SELECT MAX(sort) as maxSort FROM categories WHERE parentId = ?";
    db.query(maxSortSql, [parentId])
      .then((result) => {
        const maxSort = result[0].maxSort || 0;
        const sort = maxSort + 1;

        const item = {
          id: `cat_${Date.now()}`,
          name,
          parentId,
          sort,
          enabled: Boolean(enabled),
        };

        return db.insert("categories", item).then(() => item);
      })
      .then((item) => {
        res.status(201).json({ item });
      })
      .catch((error) => {
        console.error("创建分类失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/categories/:id", adminRequired, (req, res) => {
    const { id } = req.params;
    const { name, enabled } = req.body ?? {};

    const checkSql = "SELECT * FROM categories WHERE id = ?";
    db.query(checkSql, [id])
      .then((categories) => {
        if (categories.length === 0) {
          return res.status(404).json({ message: "分类不存在" });
        }

        const updateData = {};
        if (name != null) updateData.name = name;
        if (enabled != null) updateData.enabled = Boolean(enabled);

        return db.update("categories", id, updateData);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新分类失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.delete("/admin/categories/:id", adminRequired, (req, res) => {
    const { id } = req.params;

    db.query("SELECT COUNT(*) as count FROM categories WHERE parentId = ?", [id])
      .then((result) => {
        if (result[0].count > 0) {
          return res.status(400).json({ message: "存在子分类，无法删除" });
        }

        return db.query("SELECT COUNT(*) as count FROM products WHERE category_id = ?", [id]).then((result) => {
          if (result[0].count > 0) {
            return res.status(400).json({ message: "分类已被商品使用，无法删除" });
          }
          return db.query("DELETE FROM categories WHERE id = ?", [id]);
        });
      })
      .then(() => {
        res.status(204).send();
      })
      .catch((error) => {
        console.error("删除分类失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

