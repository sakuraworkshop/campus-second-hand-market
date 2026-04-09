export function applyAdminOrderRoutes(router, { db, adminRequired }) {
  // --- Admin: 订单全量管理 ---
  router.get("/admin/orders", adminRequired, (req, res) => {
    const { status, keyword } = req.query;

    let sql = `
    SELECT o.*, 
           p.title as product_title, 
           p.price as product_price, 
           u1.nickname as buyer_name, 
           u2.nickname as seller_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users u1 ON o.buyer_id = u1.id
    LEFT JOIN users u2 ON o.seller_id = u2.id
  `;

    const params = [];
    const whereClause = [];

    if (status) {
      whereClause.push("o.status = ?");
      params.push(status);
    }

    if (keyword) {
      whereClause.push("(o.orderNo LIKE ? OR p.title LIKE ? OR u1.nickname LIKE ? OR u2.nickname LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (whereClause.length > 0) {
      sql += " WHERE " + whereClause.join(" AND ");
    }

    sql += " ORDER BY o.created_at DESC";

    db.query(sql, params)
      .then((orders) => {
        res.json({ list: orders });
      })
      .catch((error) => {
        console.error("获取订单列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

