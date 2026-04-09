import { buildUserService } from "../services/user-service.js";

export function buildUserController(deps) {
  const service = buildUserService(deps);

  const send = (res, result) => {
    if (result.status === 204) return res.status(204).send();
    return res.status(result.status).json(result.body ?? {});
  };

  return {
    async getMyStats(req, res) {
      try {
        return res.json(await service.getMyStats(req.auth.uid));
      } catch (error) {
        console.error("获取个人中心统计失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async updateProfile(req, res) {
      try {
        return send(res, await service.updateProfile(req.auth.uid, req.body ?? {}));
      } catch (error) {
        console.error("更新用户信息失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async updatePassword(req, res) {
      try {
        const { oldPassword, newPassword } = req.body ?? {};
        return send(res, await service.updatePassword(req.auth.uid, oldPassword, newPassword));
      } catch (error) {
        console.error("更新密码失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async listAddresses(req, res) {
      try {
        return res.json(await service.listAddresses(req.auth.uid));
      } catch (error) {
        console.error("获取地址列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async createAddress(req, res) {
      try {
        return send(res, await service.createAddress(req.auth.uid, req.body ?? {}));
      } catch (error) {
        console.error("创建地址失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async deleteAddress(req, res) {
      try {
        return send(res, await service.deleteAddress(req.auth.uid, Number(req.params.id)));
      } catch (error) {
        console.error("删除地址失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async setDefaultAddress(req, res) {
      try {
        return send(res, await service.setDefaultAddress(req.auth.uid, Number(req.params.id)));
      } catch (error) {
        console.error("设置默认地址失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async listNotifications(req, res) {
      try {
        return res.json(await service.listNotifications(req.auth.uid));
      } catch (error) {
        console.error("获取通知列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async readNotification(req, res) {
      try {
        return send(res, await service.readNotification(req.auth.uid, req.params.id));
      } catch (error) {
        console.error("标记通知已读失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async readAllNotifications(req, res) {
      try {
        return send(res, await service.readAllNotifications(req.auth.uid));
      } catch (error) {
        console.error("全部标记通知已读失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async startConversation(req, res) {
      try {
        const { targetUserId, productId } = req.body ?? {};
        const result = await service.startConversation(req.auth.uid, Number(targetUserId), productId != null ? Number(productId) : null);
        return send(res, result);
      } catch (error) {
        console.error("创建会话失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async listConversations(req, res) {
      try {
        return res.json(await service.listConversations(req.auth.uid));
      } catch (error) {
        console.error("获取会话列表失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async listMessages(req, res) {
      try {
        const convId = Number(req.params.id);
        return res.json(await service.listMessages(req.auth.uid, convId));
      } catch (error) {
        console.error("获取聊天消息失败:", error);
        if (error && typeof error === "object" && "status" in error) {
          const status = Number(error.status);
          const message = error.message || "请求失败";
          if (Number.isFinite(status)) return res.status(status).json({ message });
        }
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async sendMessage(req, res) {
      try {
        const convId = Number(req.params.id);
        const { content, type } = req.body ?? {};
        return send(res, await service.sendMessage(req.auth.uid, convId, content, type));
      } catch (error) {
        console.error("发送消息失败:", error);
        if (error && typeof error === "object" && "status" in error) {
          const status = Number(error.status);
          const message = error.message || "请求失败";
          if (Number.isFinite(status)) return res.status(status).json({ message });
        }
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async sendChangePhoneCode(req, res) {
      try {
        const { newPhone } = req.body ?? {};
        return send(res, await service.sendChangePhoneCode(req.auth.uid, newPhone));
      } catch (error) {
        console.error("发送更换手机号验证码失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },

    async confirmChangePhone(req, res) {
      try {
        const { newPhone, code } = req.body ?? {};
        return send(res, await service.confirmChangePhone(req.auth.uid, newPhone, code));
      } catch (error) {
        console.error("更换手机号失败:", error);
        return res.status(500).json({ message: "服务器内部错误" });
      }
    },
  };
}

