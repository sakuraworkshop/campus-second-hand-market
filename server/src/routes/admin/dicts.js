export function applyAdminDictRoutes(router, { db, adminRequired }) {
  // --- Admin: 字典管理 ---
  router.get("/admin/dicts/:type", adminRequired, (req, res) => {
    const type = String(req.params.type || "").trim();
    if (!type) return res.status(400).json({ message: "type 为必填" });
    db.query("SELECT * FROM dict_items WHERE dict_type = ? ORDER BY sort ASC", [type])
      .then((list) => res.json({ list }))
      .catch((error) => {
        console.error("获取字典列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/dicts/:type", adminRequired, (req, res) => {
    const type = String(req.params.type || "").trim();
    const { value, label, enabled } = req.body ?? {};
    if (!type) return res.status(400).json({ message: "type 为必填" });
    if (!String(value || "").trim() || !String(label || "").trim()) {
      return res.status(400).json({ message: "value/label 为必填" });
    }

    const maxSortSql = "SELECT MAX(sort) as maxSort FROM dict_items WHERE dict_type = ?";
    db.query(maxSortSql, [type])
      .then((rows) => {
        const maxSort = Number(rows?.[0]?.maxSort ?? 0) || 0;
        const item = {
          id: `dict_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
          dict_type: type,
          value: String(value).trim(),
          label: String(label).trim(),
          sort: maxSort + 1,
          enabled: enabled == null ? true : Boolean(enabled),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return db.insert("dict_items", item).then(() => item);
      })
      .then((item) => res.status(201).json({ item }))
      .catch((error) => {
        console.error("创建字典项失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/dicts/:type/:id", adminRequired, (req, res) => {
    const type = String(req.params.type || "").trim();
    const id = String(req.params.id || "").trim();
    const { value, label, enabled, sort } = req.body ?? {};
    if (!type || !id) return res.status(400).json({ message: "type/id 为必填" });

    db.query("SELECT * FROM dict_items WHERE id = ? AND dict_type = ? LIMIT 1", [id, type])
      .then((rows) => {
        const item = rows?.[0];
        if (!item) return res.status(404).json({ message: "字典项不存在" });
        const updateData = {};
        if (value != null) updateData.value = String(value).trim();
        if (label != null) updateData.label = String(label).trim();
        if (enabled != null) updateData.enabled = Boolean(enabled);
        if (sort != null) updateData.sort = Number(sort);
        updateData.updated_at = new Date().toISOString();
        return db.update("dict_items", id, updateData);
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("更新字典项失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/dicts/:type/sort", adminRequired, (req, res) => {
    const type = String(req.params.type || "").trim();
    const { ids } = req.body ?? {};
    if (!type) return res.status(400).json({ message: "type 为必填" });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids 必须为数组" });
    Promise.all(
      ids.map((id, idx) =>
        db.query("UPDATE dict_items SET sort = ?, updated_at = ? WHERE id = ? AND dict_type = ?", [
          idx + 1,
          new Date().toISOString(),
          id,
          type,
        ])
      )
    )
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("排序字典项失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.delete("/admin/dicts/:type/:id", adminRequired, (req, res) => {
    const type = String(req.params.type || "").trim();
    const id = String(req.params.id || "").trim();
    if (!type || !id) return res.status(400).json({ message: "type/id 为必填" });
    db.query("DELETE FROM dict_items WHERE id = ? AND dict_type = ?", [id, type])
      .then(() => res.status(204).send())
      .catch((error) => {
        console.error("删除字典项失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

