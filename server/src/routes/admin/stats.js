export function applyAdminStatsRoutes(router, { db, adminRequired }) {
  router.get("/admin/stats", adminRequired, (_req, res) => {
    const statsSql = `
    SELECT
      (SELECT COUNT(*) FROM users) as totalUsers,
      (SELECT COUNT(*) FROM products) as totalProducts,
      (SELECT COUNT(*) FROM orders) as totalOrders,
      (SELECT COUNT(*) FROM favorites) as totalFavorites,
      (SELECT SUM(p.price) FROM orders o JOIN products p ON o.product_id = p.id) as totalAmount
  `;

    const topFavoritesSql = `
    SELECT p.id, p.title, COUNT(f.id) as favorites
    FROM products p
    LEFT JOIN favorites f ON p.id = f.product_id
    GROUP BY p.id, p.title
    ORDER BY favorites DESC
    LIMIT 10
  `;

    Promise.all([db.query(statsSql), db.query(topFavoritesSql)])
      .then(([statsResult, topFavoritesResult]) => {
        const stats = statsResult[0];
        const topFavoritedProducts = topFavoritesResult;

        res.json({
          stats: {
            totalUsers: stats.totalUsers || 0,
            totalProducts: stats.totalProducts || 0,
            totalOrders: stats.totalOrders || 0,
            totalFavorites: stats.totalFavorites || 0,
            totalAmount: stats.totalAmount || 0,
            topFavoritedProducts,
          },
        });
      })
      .catch((error) => {
        console.error("获取统计数据失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

