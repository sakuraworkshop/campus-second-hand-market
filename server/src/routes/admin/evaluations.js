export function applyAdminEvaluationRoutes(router, { db, adminRequired }) {
  // --- Admin: 评价与内容审核 ---
  router.get("/admin/evaluations", adminRequired, (_req, res) => {
    const sql = `
    SELECT e.*, 
           u1.nickname as user_name, 
           u2.nickname as target_name,
           o.orderNo as order_no
    FROM evaluations e
    LEFT JOIN users u1 ON e.user_id = u1.id
    LEFT JOIN users u2 ON e.target_id = u2.id
    LEFT JOIN orders o ON e.order_id = o.id
    ORDER BY e.created_at DESC
  `;

    db.query(sql)
      .then((evaluations) => {
        res.json({ list: evaluations });
      })
      .catch((error) => {
        console.error("获取评价列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

