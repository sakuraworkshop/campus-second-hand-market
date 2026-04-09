export function applyAdminUserRoutes(router, { db, adminRequired, hashPassword }) {
  // --- Admin: 用户管理 ---
  router.get("/admin/users", adminRequired, (req, res) => {
    const sql = `
    SELECT u.*, 
           (SELECT COUNT(*) FROM products WHERE owner_id = u.id) as products,
           (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id OR seller_id = u.id) as orders
    FROM users u
  `;

    db.query(sql)
      .then((users) => {
        const list = users.map((u) => ({
          id: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          phone: u.phone,
          role: u.role,
          status: u.status,
          createdAt: u.created_at,
          products: u.products,
          orders: u.orders,
        }));
        res.json({ list });
      })
      .catch((error) => {
        console.error("获取用户列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.get("/admin/users/:userId/logs", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const limit = Math.min(Math.max(Number(req.query.limit || 50) || 50, 1), 200);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: "无效的 userId" });
    db.query("SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [userId, limit])
      .then((list) => res.json({ list }))
      .catch((error) => {
        console.error("获取用户日志失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.get("/admin/users/:userId/complaints", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const limit = Math.min(Math.max(Number(req.query.limit || 50) || 50, 1), 200);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: "无效的 userId" });
    db.query("SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [userId, limit])
      .then((list) => res.json({ list }))
      .catch((error) => {
        console.error("获取用户投诉失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.get("/admin/users/:userId/evaluations", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const limit = Math.min(Math.max(Number(req.query.limit || 50) || 50, 1), 200);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: "无效的 userId" });
    db.query(
      "SELECT * FROM evaluations WHERE user_id = ? OR target_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, userId, limit]
    )
      .then((list) => res.json({ list }))
      .catch((error) => {
        console.error("获取用户评价失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.post("/admin/users/:userId/password", adminRequired, async (req, res) => {
    const userId = Number(req.params.userId);
    const { newPassword } = req.body ?? {};
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: "无效的 userId" });
    if (!String(newPassword || "").trim() || String(newPassword).length < 6) {
      return res.status(400).json({ message: "newPassword 至少 6 位" });
    }
    try {
      const user = await db.getById("users", userId);
      if (!user) return res.status(404).json({ message: "用户不存在" });
      const password_hash = await hashPassword(newPassword);
      await db.update("users", userId, { password_hash });
      await db.insert("logs", {
        id: `log_${Date.now()}`,
        user_id: req.auth.uid,
        action: "重置用户密码",
        module: "用户管理",
        content: `用户ID: ${userId}, 昵称: ${user.nickname || "-"}`,
        ip: req.ip || "unknown",
        created_at: new Date().toISOString(),
      });
      return res.json({ message: "ok" });
    } catch (error) {
      console.error("重置用户密码失败:", error);
      return res.status(500).json({ message: "服务器内部错误" });
    }
  });

  router.get("/admin/users/:userId", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: "无效的 userId" });
    }

    const userSql = `
      SELECT u.*,
             (SELECT COUNT(*) FROM products WHERE owner_id = u.id) as products,
             (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id OR seller_id = u.id) as orders,
             (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) as favorites
      FROM users u
      WHERE u.id = ?
      LIMIT 1
    `;
    const productsSql = `
      SELECT p.*
      FROM products p
      WHERE p.owner_id = ?
      ORDER BY p.created_at DESC
      LIMIT 20
    `;
    const ordersSql = `
      SELECT o.*,
             p.title as product_title,
             p.price as product_price,
             u1.nickname as buyer_name,
             u2.nickname as seller_name
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users u1 ON o.buyer_id = u1.id
      LEFT JOIN users u2 ON o.seller_id = u2.id
      WHERE o.buyer_id = ? OR o.seller_id = ?
      ORDER BY o.created_at DESC
      LIMIT 20
    `;

    Promise.all([db.query(userSql, [userId]), db.query(productsSql, [userId]), db.query(ordersSql, [userId, userId])])
      .then(([userRows, products, orders]) => {
        const u = userRows?.[0] || null;
        if (!u) return res.status(404).json({ message: "用户不存在" });
        return res.json({
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            nickname: u.nickname,
            avatar: u.avatar,
            phone: u.phone,
            gender: u.gender,
            bio: u.bio,
            role: u.role,
            status: u.status,
            created_at: u.created_at,
          },
          stats: {
            products: u.products || 0,
            orders: u.orders || 0,
            favorites: u.favorites || 0,
          },
          products: products || [],
          orders: orders || [],
        });
      })
      .catch((error) => {
        console.error("获取用户详情失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/users/:userId/role", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const { role } = req.body ?? {};
    if (!role || (role !== "admin" && role !== "user")) {
      return res.status(400).json({ message: "role 必须为 admin 或 user" });
    }

    db.getById("users", userId)
      .then((user) => {
        if (!user) return res.status(404).json({ message: "用户不存在" });
        return db.update("users", userId, { role });
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新用户角色失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/users/:userId/status", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const { status } = req.body ?? {};
    if (!status || (status !== "active" && status !== "banned")) {
      return res.status(400).json({ message: "status 必须为 active 或 banned" });
    }

    db.getById("users", userId)
      .then((user) => {
        if (!user) return res.status(404).json({ message: "用户不存在" });
        return db.update("users", userId, { status });
      })
      .then(() => {
        res.json({ message: "ok" });
      })
      .catch((error) => {
        console.error("更新用户状态失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });

  router.patch("/admin/users/:userId/avatar", adminRequired, (req, res) => {
    const userId = Number(req.params.userId);
    const { avatar } = req.body ?? {};
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ message: "无效的 userId" });
    if (!String(avatar || "").trim()) return res.status(400).json({ message: "avatar 为必填" });

    db.getById("users", userId)
      .then((user) => {
        if (!user) return res.status(404).json({ message: "用户不存在" });
        return db.update("users", userId, { avatar: String(avatar).trim() }).then(() => user);
      })
      .then((user) => {
        if (!user) return;
        return db.insert("logs", {
          id: `log_${Date.now()}`,
          user_id: req.auth.uid,
          action: "修改用户头像",
          module: "用户管理",
          content: `用户ID: ${userId}, 昵称: ${user.nickname || "-"}`,
          ip: req.ip || "unknown",
          created_at: new Date().toISOString(),
        });
      })
      .then(() => res.json({ message: "ok" }))
      .catch((error) => {
        console.error("修改用户头像失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      });
  });
}

