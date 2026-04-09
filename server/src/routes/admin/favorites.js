export function applyAdminFavoriteRoutes(router, { db, adminRequired }) {
  // --- Admin: 物品收藏管理 ---
  router.get("/admin/favorites", adminRequired, (req, res) => {
    const { product_id, user_id } = req.query;

    let sql = `
    SELECT f.*, 
           u.nickname as user_name, 
           p.title as product_title,
           p.price as product_price
    FROM favorites f
    LEFT JOIN users u ON f.user_id = u.id
    LEFT JOIN products p ON f.product_id = p.id
  `;

    const params = [];
    const whereClause = [];

    if (product_id) {
      whereClause.push("f.product_id = ?");
      params.push(product_id);
    }

    if (user_id) {
      whereClause.push("f.user_id = ?");
      params.push(user_id);
    }

    if (whereClause.length > 0) {
      sql += " WHERE " + whereClause.join(" AND ");
    }

    sql += " ORDER BY f.created_at DESC";

    db.query(sql, params)
      .then((favorites) => {
        res.json({ list: favorites });
      })
      .catch((error) => {
        console.error("获取收藏列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

