export function buildUserService({ db, hashPassword, verifyPassword, smsService }) {
  function formatTimeHM(dt) {
    const d = dt instanceof Date ? dt : new Date(dt);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function normalizeMessageType(type) {
    if (type === "image" || type === "product-card") return type;
    return "text";
  }

  async function ensureConversationForUsers(userId, targetUserId, productId) {
    const uid = Number(userId);
    const tid = Number(targetUserId);
    const pid = productId != null ? Number(productId) : null;

    if (!Number.isFinite(uid) || uid <= 0) throw Object.assign(new Error("无效的用户"), { status: 400 });
    if (!Number.isFinite(tid) || tid <= 0) throw Object.assign(new Error("无效的 targetUserId"), { status: 400 });
    if (uid === tid) throw Object.assign(new Error("不能与自己发起聊天"), { status: 400 });
    if (pid != null && (!Number.isFinite(pid) || pid <= 0)) throw Object.assign(new Error("无效的 productId"), { status: 400 });

    const a = Math.min(uid, tid);
    const b = Math.max(uid, tid);

    const existing = await db.query(
      `SELECT * FROM chat_conversations WHERE user1_id = ? AND user2_id = ? AND ((product_id IS NULL AND ? IS NULL) OR product_id = ?) LIMIT 1`,
      [a, b, pid, pid]
    );
    if (existing?.[0]) return existing[0];

    if (pid != null) {
      const p = await db.getById("products", pid);
      if (!p || p.status === "deleted") throw Object.assign(new Error("商品不存在或已删除"), { status: 404 });
    }

    const now = new Date();
    const convId = await db.insert("chat_conversations", {
      user1_id: a,
      user2_id: b,
      product_id: pid,
      last_message_content: "",
      last_message_type: "text",
      last_message_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    await db.insert("chat_conversation_members", {
      conversation_id: convId,
      user_id: uid,
      last_read_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    await db.insert("chat_conversation_members", {
      conversation_id: convId,
      user_id: tid,
      last_read_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const convRows = await db.query("SELECT * FROM chat_conversations WHERE id = ? LIMIT 1", [convId]);
    return convRows?.[0] || null;
  }

  return {
    async getMyStats(userId) {
      const [
        productRows,
        favoriteRows,
        boughtRows,
        soldRows,
      ] = await Promise.all([
        db.query(
          "SELECT COUNT(*) as count FROM products WHERE owner_id = ? AND status <> 'deleted'",
          [userId]
        ),
        db.query("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?", [userId]),
        db.query("SELECT COUNT(*) as count FROM orders WHERE buyer_id = ?", [userId]),
        db.query("SELECT COUNT(*) as count FROM orders WHERE seller_id = ?", [userId]),
      ]);

      const published = Number(productRows?.[0]?.count || 0);
      const favorites = Number(favoriteRows?.[0]?.count || 0);
      const bought = Number(boughtRows?.[0]?.count || 0);
      const sold = Number(soldRows?.[0]?.count || 0);

      return {
        stats: {
          published,
          favorites,
          bought,
          sold,
          trades: bought + sold,
        },
      };
    },

    async updateProfile(meId, body) {
      const fields = {
        nickname: body.nickname,
        avatar: body.avatar,
        gender: body.gender,
        bio: body.bio,
      };

      if (!fields.nickname || !String(fields.nickname).trim()) {
        return { status: 400, body: { message: "nickname 为必填" } };
      }

      const checkSql = "SELECT * FROM users WHERE nickname = ? AND id != ?";
      const users = await db.query(checkSql, [fields.nickname, meId]);
      if (users.length > 0) {
        return { status: 409, body: { message: "昵称已存在" } };
      }

      await db.update("users", meId, fields);
      return { status: 200, body: { message: "ok" } };
    },

    async updatePassword(meId, oldPassword, newPassword) {
      if (!oldPassword || !newPassword) {
        return { status: 400, body: { message: "oldPassword 和 newPassword 为必填" } };
      }
      if (oldPassword === newPassword) {
        return { status: 400, body: { message: "新密码不能与旧密码相同" } };
      }

      const user = await db.getById("users", meId);
      if (!user) return { status: 404, body: { message: "用户不存在" } };

      const v = await verifyPassword(oldPassword, user.password_hash);
      if (!v.ok) return { status: 401, body: { message: "旧密码不正确" } };

      await db.update("users", meId, { password_hash: await hashPassword(newPassword) });
      return { status: 200, body: { message: "ok" } };
    },

    async listAddresses(userId) {
      const sql = `
        SELECT * FROM addresses
        WHERE user_id = ?
        ORDER BY isDefault DESC, created_at DESC
      `;
      const list = await db.query(sql, [userId]);
      return { list };
    },

    async createAddress(userId, body) {
      const { contact, phone, campus, building, detail, isDefault } = body ?? {};
      if (!contact || !phone || !campus || !building || !detail) {
        return { status: 400, body: { message: "contact、phone、campus、building、detail 为必填" } };
      }

      const countSql = "SELECT COUNT(*) as count FROM addresses WHERE user_id = ?";
      const result = await db.query(countSql, [userId]);
      if (result[0].count >= 10) {
        return { status: 400, body: { message: "最多保存 10 个收货地址" } };
      }

      if (isDefault) {
        await db.query("UPDATE addresses SET isDefault = false WHERE user_id = ?", [userId]);
      }

      const createdAt = new Date().toISOString();
      const addressData = {
        user_id: userId,
        contact,
        phone,
        campus,
        building,
        detail,
        isDefault: Boolean(isDefault),
        created_at: createdAt,
      };
      const addressId = await db.insert("addresses", addressData);
      return { status: 201, body: { message: "ok", address: { id: addressId, ...addressData } } };
    },

    async deleteAddress(userId, addressId) {
      const deleteSql = "DELETE FROM addresses WHERE user_id = ? AND id = ?";
      await db.query(deleteSql, [userId, addressId]);
      return { status: 204, body: null };
    },

    async setDefaultAddress(userId, addressId) {
      const address = await db.getById("addresses", addressId);
      if (!address || address.user_id !== userId) {
        return { status: 404, body: { message: "地址不存在" } };
      }

      await db.query("UPDATE addresses SET isDefault = false WHERE user_id = ?", [userId]);
      await db.query("UPDATE addresses SET isDefault = true WHERE id = ?", [addressId]);
      return { status: 200, body: { message: "ok" } };
    },

    async listNotifications(userId) {
      const sql = `
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;
      const list = await db.query(sql, [userId]);
      return { list };
    },

    async readNotification(userId, id) {
      const checkSql = "SELECT * FROM notifications WHERE id = ? AND user_id = ?";
      const notifications = await db.query(checkSql, [id, userId]);
      if (notifications.length === 0) {
        return { status: 404, body: { message: "通知不存在" } };
      }
      await db.query("UPDATE notifications SET is_read = true WHERE id = ?", [id]);
      return { status: 200, body: { message: "ok" } };
    },

    async readAllNotifications(userId) {
      await db.query("UPDATE notifications SET is_read = true WHERE user_id = ?", [userId]);
      return { status: 200, body: { message: "ok" } };
    },

    async startConversation(authUid, targetUserId, productId) {
      const t = Number(targetUserId);
      if (!Number.isFinite(t) || t <= 0) return { status: 400, body: { message: "targetUserId 无效" } };
      if (t === authUid) return { status: 400, body: { message: "不能与自己聊天" } };

      const user = await db.getById("users", t);
      if (!user) return { status: 404, body: { message: "对方用户不存在" } };

      const conv = await ensureConversationForUsers(authUid, t, productId);
      return { status: 201, body: { id: String(conv.id) } };
    },

    async listConversations(authUid) {
      const uid = Number(authUid);
      const sql = `
        SELECT
          c.id as conversation_id,
          c.user1_id,
          c.user2_id,
          c.product_id,
          c.last_message_content,
          c.last_message_at,
          c.updated_at,
          m.last_read_at,
          u.id as contact_id,
          u.nickname as contact_nickname,
          u.avatar as contact_avatar,
          p.title as product_title,
          p.price as product_price,
          p.image_url as product_image
        FROM chat_conversations c
        JOIN chat_conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
        JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
        LEFT JOIN products p ON p.id = c.product_id
        ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC, c.id DESC
        LIMIT 200
      `;
      const rows = await db.query(sql, [uid, uid]);

      const convIds = rows.map((r) => r.conversation_id);
      let unreadMap = new Map();
      if (convIds.length > 0) {
        const placeholders = convIds.map(() => "?").join(", ");
        const unreadSql = `
          SELECT
            m.conversation_id,
            COUNT(*) as cnt
          FROM chat_conversation_members m
          JOIN chat_messages msg ON msg.conversation_id = m.conversation_id
          WHERE m.user_id = ?
            AND m.conversation_id IN (${placeholders})
            AND msg.sender_id <> ?
            AND msg.created_at > COALESCE(m.last_read_at, '1970-01-01')
          GROUP BY m.conversation_id
        `;
        const unreadRows = await db.query(unreadSql, [uid, ...convIds, uid]);
        unreadMap = new Map(unreadRows.map((x) => [String(x.conversation_id), Number(x.cnt || 0)]));
      }

      const conversations = rows.map((r) => {
        const t = r.last_message_at || r.updated_at;
        return {
          id: String(r.conversation_id),
          contact: {
            id: Number(r.contact_id),
            nickname: r.contact_nickname || "-",
            avatar: r.contact_avatar || "",
          },
          lastMessage: r.last_message_content || "",
          lastTime: t ? formatTimeHM(t) : "",
          unreadCount: unreadMap.get(String(r.conversation_id)) || 0,
          productTitle: r.product_title || undefined,
          productPrice: r.product_price != null ? Number(r.product_price) : undefined,
          productImage: r.product_image || undefined,
          productId: r.product_id != null ? String(r.product_id) : undefined,
        };
      });

      return { conversations };
    },

    async listMessages(authUid, conversationId) {
      const uid = Number(authUid);
      const convId = Number(conversationId);
      if (!Number.isFinite(convId) || convId <= 0) throw Object.assign(new Error("无效的会话ID"), { status: 400 });

      const member = await db.query(
        "SELECT * FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1",
        [convId, uid]
      );
      if (!member?.[0]) throw Object.assign(new Error("无权限访问该会话"), { status: 403 });

      const msgs = await db.query(
        `SELECT id, sender_id, content, type, created_at, extra
         FROM chat_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC, id ASC
         LIMIT 500`,
        [convId]
      );

      const now = new Date().toISOString();
      await db.query(
        "UPDATE chat_conversation_members SET last_read_at = ?, updated_at = ? WHERE conversation_id = ? AND user_id = ?",
        [now, now, convId, uid]
      );

      const messages = (msgs || []).map((m) => {
        let productCard = undefined;
        if (m.type === "product-card" && m.extra) {
          try {
            const ex = typeof m.extra === "string" ? JSON.parse(m.extra) : m.extra;
            if (ex && typeof ex === "object") productCard = ex.productCard || ex;
          } catch {
            // ignore
          }
        }
        return {
          id: String(m.id),
          senderId: String(m.sender_id),
          content: m.content || "",
          type: normalizeMessageType(m.type),
          time: m.created_at ? formatTimeHM(m.created_at) : "",
          isMe: String(m.sender_id) === String(uid),
          ...(productCard ? { productCard } : {}),
        };
      });

      return { messages };
    },

    async sendMessage(authUid, conversationId, content, type) {
      const uid = Number(authUid);
      const convId = Number(conversationId);
      const c = String(content || "").trim();
      if (!Number.isFinite(convId) || convId <= 0) return { status: 400, body: { message: "无效的会话ID" } };
      if (!c) return { status: 400, body: { message: "消息内容不能为空" } };

      const member = await db.query(
        "SELECT * FROM chat_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1",
        [convId, uid]
      );
      if (!member?.[0]) return { status: 403, body: { message: "无权限访问该会话" } };

      const msgType = normalizeMessageType(type);
      const now = new Date();
      const messageId = await db.insert("chat_messages", {
        conversation_id: convId,
        sender_id: uid,
        type: msgType,
        content: c,
        extra: null,
        created_at: now.toISOString(),
      });

      await db.query(
        "UPDATE chat_conversations SET last_message_content = ?, last_message_type = ?, last_message_at = ?, updated_at = ? WHERE id = ?",
        [c, msgType, now.toISOString(), now.toISOString(), convId]
      );

      await db.query(
        "UPDATE chat_conversation_members SET updated_at = ? WHERE conversation_id = ?",
        [now.toISOString(), convId]
      );

      return {
        status: 200,
        body: {
          id: String(messageId),
          senderId: String(uid),
          content: c,
          type: msgType,
          time: formatTimeHM(now),
          isMe: true,
        },
      };
    },

    async sendChangePhoneCode(meId, newPhone) {
      if (!smsService) return { status: 500, body: { message: "短信服务未配置" } };
      const user = await db.getById("users", meId);
      if (!user) return { status: 404, body: { message: "用户不存在" } };

      const p = String(newPhone || "").trim();
      if (!p) return { status: 400, body: { message: "newPhone 为必填" } };

      // 新手机号不可被占用
      const exists = await db.query("SELECT id FROM users WHERE phone = ?", [p]);
      if (exists.length > 0) return { status: 409, body: { message: "该手机号已被占用" } };

      return smsService.sendCode({ phone: p, scene: "change_phone" });
    },

    async confirmChangePhone(meId, newPhone, code) {
      if (!smsService) return { status: 500, body: { message: "短信服务未配置" } };
      const user = await db.getById("users", meId);
      if (!user) return { status: 404, body: { message: "用户不存在" } };

      const p = String(newPhone || "").trim();
      const c = String(code || "").trim();
      if (!p || !c) return { status: 400, body: { message: "newPhone 和 code 为必填" } };

      const exists = await db.query("SELECT id FROM users WHERE phone = ?", [p]);
      if (exists.length > 0) return { status: 409, body: { message: "该手机号已被占用" } };

      const v = smsService.verifyCode({ phone: p, scene: "change_phone", code: c });
      if (!v.ok) return { status: v.status, body: { message: v.message } };

      await db.update("users", meId, { phone: p });
      return { status: 200, body: { message: "手机号已更新" } };
    },
  };
}

