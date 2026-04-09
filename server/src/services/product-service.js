export function buildProductService({ db }) {
  return {
    async listProducts() {
      const sql = `
        SELECT p.*, u.name as owner_name
        FROM products p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.status = 'approved'
        ORDER BY p.created_at DESC
      `;
      return db.query(sql);
    },

    async getProductDetail(id) {
      const sql = `
        SELECT p.*, u.name as owner_name
        FROM products p
        LEFT JOIN users u ON p.owner_id = u.id
        WHERE p.id = ?
      `;
      const products = await db.query(sql, [id]);
      return products[0] || null;
    },

    async createProduct(ownerId, payload) {
      const { title, description, price, image_url, images, condition, category_id, campus } = payload ?? {};
      if (!title || price == null || !condition || !category_id || !campus) {
        return { status: 400, body: { message: "title, price, condition, category_id, campus 为必填" } };
      }

      const normalizeImages = (raw, fallback) => {
        if (Array.isArray(raw)) {
          const arr = raw.map((x) => String(x || "").trim()).filter(Boolean);
          return arr.length > 0 ? arr : (fallback ? [String(fallback)] : []);
        }
        if (typeof raw === "string") {
          const s = raw.trim();
          if (!s) return fallback ? [String(fallback)] : [];
          if (s.startsWith("[")) {
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) {
                const arr = parsed.map((x) => String(x || "").trim()).filter(Boolean);
                if (arr.length > 0) return arr;
              }
            } catch {
              // ignore
            }
          }
          return [s];
        }
        return fallback ? [String(fallback)] : [];
      };

      const imageList = normalizeImages(images, image_url);
      const firstImage = imageList[0] || image_url || "";

      const productData = {
        title,
        description: description ?? "",
        price,
        image_url: firstImage,
        images: imageList.length > 0 ? JSON.stringify(imageList) : null,
        condition,
        category_id,
        campus,
        owner_id: ownerId,
        status: "approved",
        created_at: new Date().toISOString(),
        views: 0,
        favorites: 0,
      };

      const productId = await db.insert("products", productData);
      return { status: 201, body: { ...productData, id: productId } };
    },

    async updateProduct(userId, id, payload) {
      const product = await db.getById("products", id);
      if (!product) return { status: 404, body: { message: "商品不存在" } };
      if (product.owner_id !== userId) return { status: 403, body: { message: "无权限修改此商品" } };
      if (product.status === "deleted") return { status: 400, body: { message: "商品已删除" } };

      const { title, description, price, image_url, condition, category_id, campus } = payload ?? {};
      const updateData = {};
      if (title != null) updateData.title = title;
      if (description != null) updateData.description = description;
      if (price != null) updateData.price = price;
      if (image_url != null) {
        updateData.image_url = image_url;
        updateData.images = JSON.stringify([image_url]);
      }
      if (condition != null) updateData.condition = condition;
      if (category_id != null) updateData.category_id = category_id;
      if (campus != null) updateData.campus = campus;
      // 无审核：编辑后保持/恢复为上架状态
      updateData.status = "approved";
      updateData.updated_at = new Date().toISOString();

      await db.update("products", id, updateData);
      return { status: 200, body: { message: "ok" } };
    },

    async changeStatus(userId, id, status) {
      const product = await db.getById("products", id);
      if (!product) return { status: 404, body: { message: "商品不存在" } };
      if (product.owner_id !== userId) return { status: 403, body: { message: "无权限修改此商品" } };
      if (product.status === "deleted") return { status: 400, body: { message: "商品已删除" } };

      if (status === "up") {
        await db.update("products", id, {
          status: "approved",
          updated_at: new Date().toISOString(),
        });
        return { status: 200, body: { message: "ok" } };
      }

      if (status === "down") {
        const checkSql =
          "SELECT * FROM orders WHERE product_id = ? AND status NOT IN ('completed', 'cancelled')";
        const orders = await db.query(checkSql, [id]);
        if (orders.length > 0) {
          return { status: 400, body: { message: "有进行中订单的商品不可下架" } };
        }
        await db.update("products", id, {
          status: "down",
          updated_at: new Date().toISOString(),
        });
        return { status: 200, body: { message: "ok" } };
      }

      return { status: 400, body: { message: "无效的状态变更" } };
    },

    async deleteProduct(userId, id) {
      const product = await db.getById("products", id);
      if (!product) return { status: 404, body: { message: "商品不存在" } };
      if (product.owner_id !== userId) return { status: 403, body: { message: "无权限删除此商品" } };
      if (product.status === "deleted") return { status: 400, body: { message: "商品已删除" } };

      const checkSql =
        "SELECT * FROM orders WHERE product_id = ? AND status NOT IN ('completed', 'cancelled')";
      const orders = await db.query(checkSql, [id]);
      if (orders.length > 0) {
        return { status: 400, body: { message: "有进行中订单的商品不可删除" } };
      }

      const deleteFavoritesSql = "DELETE FROM favorites WHERE product_id = ?";
      await db.query(deleteFavoritesSql, [id]);
      await db.update("products", id, { status: "deleted", updated_at: new Date().toISOString() });
      return { status: 204, body: null };
    },

    async listFavorites(userId) {
      const sql = `
        SELECT f.id, f.created_at, f.product_id, p.title, p.price, p.image_url
        FROM favorites f
        LEFT JOIN products p ON f.product_id = p.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `;
      return db.query(sql, [userId]);
    },

    async addFavorite(userId, product_id) {
      if (!product_id) {
        return { status: 400, body: { message: "product_id 为必填" } };
      }
      const checkSql = "SELECT * FROM favorites WHERE user_id = ? AND product_id = ?";
      const favorites = await db.query(checkSql, [userId, product_id]);
      if (favorites.length === 0) {
        const favoriteData = {
          user_id: userId,
          product_id,
          created_at: new Date().toISOString(),
        };
        await db.insert("favorites", favoriteData);
      }
      return { status: 201, body: { message: "ok" } };
    },

    async removeFavorite(userId, productId) {
      const deleteSql = "DELETE FROM favorites WHERE user_id = ? AND product_id = ?";
      await db.query(deleteSql, [userId, productId]);
      return { status: 204, body: null };
    },
  };
}

