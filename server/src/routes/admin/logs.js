export function applyAdminLogRoutes(router, { db, adminRequired }) {
  // --- Admin: 操作日志管理 ---
  router.get("/admin/logs", adminRequired, (req, res) => {
    const { action, module, startDate, endDate } = req.query;

    let sql = `
    SELECT l.*, 
           u.nickname as user_name
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
  `;

    const params = [];
    const whereClause = [];

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

    db.query(sql, params)
      .then((logs) => {
        res.json({ list: logs });
      })
      .catch((error) => {
        console.error("获取操作日志失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

