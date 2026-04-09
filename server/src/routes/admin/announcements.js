export function applyAdminAnnouncementRoutes(router, { db, adminRequired }) {
  // --- Admin: 公告管理 ---
  router.get("/admin/announcements", adminRequired, (_req, res) => {
    const sql = `
    SELECT * FROM announcements
    ORDER BY created_at DESC
  `;

    db.query(sql)
      .then((announcements) => {
        res.json({ list: announcements });
      })
      .catch((error) => {
        console.error("获取公告列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/announcements", adminRequired, (req, res) => {
    const { title, content, status = "published" } = req.body ?? {};
    if (!title || !content) return res.status(400).json({ message: "title 和 content 为必填" });

    const announcementData = {
      id: `ann_${Date.now()}`,
      title,
      content,
      isTop: false,
      status: status === "draft" ? "draft" : "published",
      created_at: new Date().toISOString(),
    };

    db.insert("announcements", announcementData)
      .then(() => {
        res.status(201).json({ item: announcementData });
      })
      .catch((error) => {
        console.error("创建公告失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.put("/admin/announcements/:id", adminRequired, (req, res) => {
    const { id } = req.params;
    const { title, content, status } = req.body ?? {};

    const checkSql = "SELECT * FROM announcements WHERE id = ?";
    db.query(checkSql, [id])
      .then((announcements) => {
        if (announcements.length === 0) {
          return res.status(404).json({ message: "公告不存在" });
        }

        const updateData = {};
        if (title != null) updateData.title = title;
        if (content != null) updateData.content = content;
        if (status != null) updateData.status = status === "draft" ? "draft" : "published";

        return db.update("announcements", id, updateData);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新公告失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/announcements/:id/top", adminRequired, (req, res) => {
    const { id } = req.params;
    const { isTop } = req.body ?? {};

    const checkSql = "SELECT * FROM announcements WHERE id = ?";
    db.query(checkSql, [id])
      .then((announcements) => {
        if (announcements.length === 0) {
          return res.status(404).json({ message: "公告不存在" });
        }
        return db.query("UPDATE announcements SET isTop = ? WHERE id = ?", [Boolean(isTop), id]);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新公告置顶状态失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.delete("/admin/announcements/:id", adminRequired, (req, res) => {
    const { id } = req.params;

    const checkSql = "SELECT * FROM announcements WHERE id = ?";
    db.query(checkSql, [id])
      .then((announcements) => {
        if (announcements.length === 0) {
          return res.status(404).json({ message: "公告不存在" });
        }
        return db.query("DELETE FROM announcements WHERE id = ?", [id]);
      })
      .then(() => {
        res.status(204).send();
      })
      .catch((error) => {
        console.error("删除公告失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

