export function applyAdminAiPromptRoutes(router, { db, adminRequired }) {
  // --- Admin: AI 中心（提示词管理）---
  router.get("/admin/ai/prompts", adminRequired, (req, res) => {
    const { keyword, scene, enabled } = req.query ?? {};
    let sql = `
      SELECT *
      FROM ai_prompts
    `;
    const whereClause = [];
    const params = [];

    const kw = String(keyword || "").trim();
    if (kw) {
      whereClause.push("(name LIKE ? OR scene LIKE ? OR content LIKE ?)");
      params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
    }
    const sc = String(scene || "").trim();
    if (sc) {
      whereClause.push("scene = ?");
      params.push(sc);
    }
    if (enabled != null && String(enabled) !== "") {
      const v = String(enabled).toLowerCase();
      if (v === "true" || v === "1") whereClause.push("enabled = 1");
      if (v === "false" || v === "0") whereClause.push("enabled = 0");
    }

    if (whereClause.length > 0) sql += " WHERE " + whereClause.join(" AND ");
    sql += " ORDER BY updated_at DESC, created_at DESC";

    db.query(sql, params)
      .then((list) => res.json({ list }))
      .catch((error) => {
        console.error("获取提示词列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/ai/prompts", adminRequired, (req, res) => {
    const { name, scene, content, enabled } = req.body ?? {};
    if (!String(name || "").trim()) return res.status(400).json({ message: "name 为必填" });
    if (!String(scene || "").trim()) return res.status(400).json({ message: "scene 为必填" });
    if (!String(content || "").trim()) return res.status(400).json({ message: "content 为必填" });

    const item = {
      id: `aip_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      name: String(name).trim(),
      scene: String(scene).trim(),
      content: String(content),
      enabled: enabled == null ? true : Boolean(enabled),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.insert("ai_prompts", item)
      .then(() =>
        db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "新增提示词",
          module: "AI中心",
          content: `scene: ${item.scene}, name: ${item.name}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        })
      )
      .then(() => res.status(201).json({ item }))
      .catch((error) => {
        console.error("创建提示词失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/ai/prompts/:id", adminRequired, (req, res) => {
    const id = String(req.params.id || "").trim();
    const { name, scene, content, enabled } = req.body ?? {};
    if (!id) return res.status(400).json({ message: "无效的 id" });

    db.getById("ai_prompts", id)
      .then((row) => {
        if (!row) return res.status(404).json({ message: "提示词不存在" });
        const updateData = {};
        if (name != null) updateData.name = String(name).trim();
        if (scene != null) updateData.scene = String(scene).trim();
        if (content != null) updateData.content = String(content);
        if (enabled != null) updateData.enabled = Boolean(enabled);
        updateData.updated_at = new Date().toISOString();
        return db.update("ai_prompts", id, updateData).then(() => ({ old: row, next: updateData }));
      })
      .then((x) => {
        if (!x) return;
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "编辑提示词",
          module: "AI中心",
          content: `id: ${id}, scene: ${x.old?.scene || "-"} -> ${x.next?.scene || "-"}, name: ${x.old?.name || "-"} -> ${x.next?.name || "-"}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("更新提示词失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/ai/prompts/:id/enabled", adminRequired, (req, res) => {
    const id = String(req.params.id || "").trim();
    const { enabled } = req.body ?? {};
    if (!id) return res.status(400).json({ message: "无效的 id" });
    if (enabled == null) return res.status(400).json({ message: "enabled 为必填" });

    db.getById("ai_prompts", id)
      .then((row) => {
        if (!row) return res.status(404).json({ message: "提示词不存在" });
        return db
          .update("ai_prompts", id, { enabled: Boolean(enabled), updated_at: new Date().toISOString() })
          .then(() => row);
      })
      .then((row) => {
        if (!row) return;
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: Boolean(enabled) ? "启用提示词" : "禁用提示词",
          module: "AI中心",
          content: `id: ${id}, scene: ${row.scene}, name: ${row.name}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("更新提示词启用状态失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.delete("/admin/ai/prompts/:id", adminRequired, (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "无效的 id" });

    db.getById("ai_prompts", id)
      .then((row) => {
        if (!row) return res.status(404).json({ message: "提示词不存在" });
        return db.query("DELETE FROM ai_prompts WHERE id = ?", [id]).then(() => row);
      })
      .then((row) => {
        if (!row) return;
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "删除提示词",
          module: "AI中心",
          content: `id: ${id}, scene: ${row.scene}, name: ${row.name}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.status(204).send())
      .catch((error) => {
        console.error("删除提示词失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

