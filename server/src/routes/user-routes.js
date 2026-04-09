import { Router } from "express";
import { buildUserController } from "../controllers/user-controller.js";

export function createUserRouter(deps) {
  const router = Router();
  const controller = buildUserController(deps);

  router.get("/users/me/stats", deps.authRequired, controller.getMyStats);
  router.put("/users/me/profile", deps.authRequired, controller.updateProfile);
  router.put("/users/me/password", deps.authRequired, controller.updatePassword);

  router.get("/users/me/addresses", deps.authRequired, controller.listAddresses);
  router.post("/users/me/addresses", deps.authRequired, controller.createAddress);
  router.delete("/users/me/addresses/:id", deps.authRequired, controller.deleteAddress);
  router.patch("/users/me/addresses/:id/default", deps.authRequired, controller.setDefaultAddress);

  router.get("/users/me/notifications", deps.authRequired, controller.listNotifications);
  router.patch("/notifications/:id/read", deps.authRequired, controller.readNotification);
  router.patch("/notifications/read-all", deps.authRequired, controller.readAllNotifications);

  router.get("/messages", deps.authRequired, controller.listConversations);
  router.post("/messages/conversations", deps.authRequired, controller.startConversation);
  router.get("/messages/:id", deps.authRequired, controller.listMessages);
  router.post("/messages/:id", deps.authRequired, controller.sendMessage);

  // 更换手机号（已登录）
  router.post("/users/me/phone/send-code", deps.authRequired, controller.sendChangePhoneCode);
  router.post("/users/me/phone/confirm", deps.authRequired, controller.confirmChangePhone);

  return router;
}

