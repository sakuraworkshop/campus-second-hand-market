export function applyAdminComplaintRoutes(router, { db, adminRequired }) {
  // --- Admin: 投诉与纠纷处理 ---
  router.get("/admin/complaints", adminRequired, (req, res) => {
    const { status, type } = req.query;

    let sql = `
    SELECT c.*, 
           u.nickname as user_name
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
  `;

    const params = [];
    const whereClause = [];

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

    db.query(sql, params)
      .then((complaints) => {
        res.json({ list: complaints });
      })
      .catch((error) => {
        console.error("获取投诉列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/complaints/:id/handle", adminRequired, (req, res) => {
    const id = Number(req.params.id);
    const { status, result } = req.body ?? {};

    if (!status || !result) {
      return res.status(400).json({ message: "status 和 result 为必填" });
    }

    db.getById("complaints", id)
      .then((complaint) => {
        if (!complaint) return res.status(404).json({ message: "投诉不存在" });

        const updateData = {
          status,
          result,
          updated_at: new Date().toISOString(),
        };

        return db.update("complaints", id, updateData).then(() => complaint);
      })
      .then((complaint) => {
        const notification = {
          id: `notif_${Date.now()}`,
          user_id: complaint.user_id,
          type: "complaint_result",
          title: "投诉处理结果",
          content: `您的投诉已处理：${result}`,
          is_read: false,
          created_at: new Date().toISOString(),
          complaint_id: complaint.id,
        };

        return db.insert("notifications", notification).then(() => complaint);
      })
      .then((complaint) => {
        const log = {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "处理投诉",
          module: "投诉管理",
          content: `投诉ID: ${complaint.id}, 处理结果: ${result}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        };

        return db.insert("logs", log);
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("处理投诉失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

