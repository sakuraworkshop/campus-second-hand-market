export function buildTradeService({ db }) {
  return {
    async createOrder(buyerId, body) {
      const { product_id, deliveryAddress, deliveryTime } = body ?? {};
      if (!product_id || !deliveryAddress || !deliveryTime) {
        return { status: 400, body: { message: "product_id, deliveryAddress, deliveryTime 为必填" } };
      }

      const product = await db.getById("products", product_id);
      if (!product) return { status: 404, body: { message: "商品不存在" } };
      if (product.status === "down" || product.status === "deleted") return { status: 400, body: { message: "商品不可购买" } };
      if (product.owner_id === buyerId) return { status: 400, body: { message: "不能购买自己的商品" } };

      const checkSql = "SELECT * FROM orders WHERE product_id = ? AND status NOT IN ('completed', 'cancelled')";
      const orders = await db.query(checkSql, [product_id]);
      if (orders.length > 0) return { status: 400, body: { message: "商品已被下单" } };

      const orderNo = `TX${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${String(Date.now()).slice(-3).padStart(3, "0")}`;
      const orderData = {
        orderNo,
        buyer_id: buyerId,
        seller_id: product.owner_id,
        product_id,
        status: "pending",
        amount: product.price,
        deliveryAddress,
        deliveryTime,
        timeline: JSON.stringify([{ content: "订单创建成功", time: new Date().toISOString() }]),
        created_at: new Date().toISOString(),
      };

      const orderId = await db.insert("orders", orderData);
      const order = await db.getById("orders", orderId);
      return { status: 201, body: order };
    },

    async listUserOrders(paramUserId, auth) {
      const userId = Number(paramUserId);
      if (!Number.isFinite(userId)) return { status: 400, body: { message: "userId 非法" } };
      if (auth.uid !== userId && auth.role !== "admin") {
        return { status: 403, body: { message: "无权限查看该用户订单" } };
      }

      const sql = `
        SELECT o.*, p.title, p.price, p.image_url
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.buyer_id = ? OR o.seller_id = ?
        ORDER BY o.created_at DESC
      `;
      const orders = await db.query(sql, [userId, userId]);
      return { status: 200, body: orders };
    },

    async listMyOrders(userId) {
      const buyerSql = `
        SELECT o.*, p.title, p.price, p.image_url, u.id as seller_id, u.nickname as seller_nickname, u.avatar as seller_avatar
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users u ON o.seller_id = u.id
        WHERE o.buyer_id = ?
      `;
      const sellerSql = `
        SELECT o.*, p.title, p.price, p.image_url, u.id as buyer_id, u.nickname as buyer_nickname, u.avatar as buyer_avatar
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users u ON o.buyer_id = u.id
        WHERE o.seller_id = ?
      `;
      const [buyerOrders, sellerOrders] = await Promise.all([db.query(buyerSql, [userId]), db.query(sellerSql, [userId])]);

      const formattedBuyerOrders = buyerOrders.map((order) => ({
        ...order,
        product: { id: order.product_id, title: order.title, price: order.price, image_url: order.image_url },
        seller: { id: order.seller_id, nickname: order.seller_nickname, avatar: order.seller_avatar },
      }));
      const formattedSellerOrders = sellerOrders.map((order) => ({
        ...order,
        product: { id: order.product_id, title: order.title, price: order.price, image_url: order.image_url },
        buyer: { id: order.buyer_id, nickname: order.buyer_nickname, avatar: order.buyer_avatar },
      }));
      return { buyerOrders: formattedBuyerOrders, sellerOrders: formattedSellerOrders };
    },

    async getOrderDetail(id, userId) {
      const sql = `
        SELECT o.*, p.title, p.price, p.image_url, 
               b.id as buyer_id, b.nickname as buyer_nickname, b.avatar as buyer_avatar,
               s.id as seller_id, s.nickname as seller_nickname, s.avatar as seller_avatar
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN users b ON o.buyer_id = b.id
        LEFT JOIN users s ON o.seller_id = s.id
        WHERE o.id = ?
      `;
      const orders = await db.query(sql, [id]);
      const order = orders[0];
      if (!order) return { status: 404, body: { message: "订单不存在" } };
      if (order.buyer_id !== userId && order.seller_id !== userId) {
        return { status: 403, body: { message: "无权限查看此订单" } };
      }
      return {
        status: 200,
        body: {
          ...order,
          product: { id: order.product_id, title: order.title, price: order.price, image_url: order.image_url },
          buyer: { id: order.buyer_id, nickname: order.buyer_nickname, avatar: order.buyer_avatar },
          seller: { id: order.seller_id, nickname: order.seller_nickname, avatar: order.seller_avatar },
        },
      };
    },

    async getMyEvaluation(orderId, userId) {
      const id = Number(orderId);
      if (!Number.isFinite(id) || id <= 0) return { status: 400, body: { message: "无效的订单ID" } };

      const order = await db.getById("orders", id);
      if (!order) return { status: 404, body: { message: "订单不存在" } };
      if (order.buyer_id !== userId && order.seller_id !== userId) {
        return { status: 403, body: { message: "无权限查看此订单评价" } };
      }

      const rows = await db.query("SELECT * FROM evaluations WHERE order_id = ? AND user_id = ? LIMIT 1", [id, userId]);
      const evaluation = rows?.[0] || null;
      return { status: 200, body: { evaluation } };
    },

    async updateOrderStatus(id, userId, status) {
      const order = await db.getById("orders", id);
      if (!order) return { status: 404, body: { message: "订单不存在" } };
      if (status === "confirmed" && order.seller_id !== userId) return { status: 403, body: { message: "只有卖家可以确认订单" } };
      if (status === "completed" && order.buyer_id !== userId) return { status: 403, body: { message: "只有买家可以确认收货" } };
      if (status === "cancelled" && order.buyer_id !== userId && order.seller_id !== userId) {
        return { status: 403, body: { message: "只有买卖双方可以取消订单" } };
      }
      if (status === "confirmed" && order.status !== "pending") return { status: 400, body: { message: "只能确认待确认的订单" } };
      if (status === "completed" && order.status !== "confirmed") return { status: 400, body: { message: "只能完成待交付的订单" } };
      if (status === "cancelled" && (order.status === "completed" || order.status === "cancelled")) {
        return { status: 400, body: { message: "已完成或已取消的订单不能再次取消" } };
      }

      const timelineContent =
        status === "confirmed"
          ? "卖家已确认订单，等待线下交付"
          : status === "completed"
            ? "买家确认收货，交易完成"
            : `订单已取消：${order.buyer_id === userId ? "买家主动取消" : "卖家主动取消"}`;

      let timeline = [];
      if (order.timeline) {
        try {
          timeline = JSON.parse(order.timeline);
        } catch {
          timeline = [];
        }
      }
      timeline.push({ content: timelineContent, time: new Date().toISOString() });

      const now = new Date().toISOString();
      await db.update("orders", id, { status, timeline: JSON.stringify(timeline), updated_at: now });
      // 交易完成：自动下架商品，避免继续出现在商品广场
      if (status === "completed" && order.product_id) {
        await db.update("products", order.product_id, { status: "down", updated_at: now });
      }
      await Promise.all([
        db.insert("notifications", {
          id: `notif_${Date.now()}_1`,
          user_id: order.buyer_id,
          type: "order_status",
          title: "订单状态更新",
          content: timelineContent,
          is_read: false,
          order_id: order.id,
          created_at: now,
        }),
        db.insert("notifications", {
          id: `notif_${Date.now()}_2`,
          user_id: order.seller_id,
          type: "order_status",
          title: "订单状态更新",
          content: timelineContent,
          is_read: false,
          order_id: order.id,
          created_at: now,
        }),
      ]);
      return { status: 200, body: { message: "ok" } };
    },

    async createEvaluation(id, userId, body) {
      const { rating, content, target_type } = body ?? {};
      if (!rating || !content || !target_type) {
        return { status: 400, body: { message: "rating、content 和 target_type 为必填" } };
      }
      const order = await db.getById("orders", id);
      if (!order) return { status: 404, body: { message: "订单不存在" } };
      if (order.status !== "completed") return { status: 400, body: { message: "只有已完成的订单可以评价" } };

      const checkSql = "SELECT * FROM evaluations WHERE order_id = ? AND user_id = ?";
      const evaluations = await db.query(checkSql, [id, userId]);
      if (evaluations.length > 0) return { status: 400, body: { message: "已经评价过此订单" } };

      await db.insert("evaluations", {
        order_id: id,
        user_id: userId,
        target_id: target_type === "seller" ? order.seller_id : order.buyer_id,
        target_type,
        rating,
        content,
        created_at: new Date().toISOString(),
      });
      return { status: 201, body: { message: "评价成功" } };
    },

    async createComplaint(userId, body) {
      const { type, target_id, content, evidence } = body ?? {};
      if (!type || !target_id || !content) {
        return { status: 400, body: { message: "type、target_id 和 content 为必填" } };
      }
      await db.insert("complaints", {
        user_id: userId,
        type,
        target_id,
        content,
        evidence: evidence ? JSON.stringify(evidence) : null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { status: 201, body: { message: "投诉提交成功" } };
    },
  };
}

