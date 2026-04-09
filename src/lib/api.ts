import { getToken, clearAuth, setMe, type Me } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";

function resolveApiUrl(path: string) {
  // 默认空基址：直接请求 /api/*，由同源服务或 Vite 代理处理
  if (!API_BASE) return path;

  // 允许显式配置为 /api，避免拼接成 /api/api/*
  if (API_BASE === "/api" && path.startsWith("/api/")) return path;

  return `${API_BASE}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(resolveApiUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    // token 无效/过期时清理本地登录态，避免页面一直报错
    if (res.status === 401 || res.status === 403) {
      clearAuth();
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

async function uploadViaBackend(file: File, folder = "products") {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const res = await fetch(resolveApiUrl("/api/oss/upload"), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    let message = `上传失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as { url: string; path?: string; key: string; bucket: string };
}

async function uploadBannerViaAdmin(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(resolveApiUrl("/api/admin/banners/upload"), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    let message = `上传失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as { url: string; key?: string; bucket?: string; path?: string };
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  authSendSmsCode: (data: { phone: string; scene: "login" | "reset_password" | "change_phone" | "register" }) =>
    request<{ message: string }>("/api/auth/sms/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  authLoginBySms: (data: { phone: string; code: string }) =>
    request<{ user: { id: number; nickname: string; role: "user" | "admin" }; token: string }>(
      "/api/auth/sms/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  authResetPasswordBySms: (data: { phone: string; code: string; newPassword: string }) =>
    request<{ message: string }>("/api/auth/sms/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { phone: string; password: string }) =>
    request<{ user: { id: number; nickname: string; role: "user" | "admin" }; token: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  register: (data: {
    nickname: string;
    phone: string;
    code: string;
    password: string;
    gender?: "male" | "female" | "other";
    bio?: string;
    avatar?: string;
  }) =>
    request<{
      user: { id: number; nickname: string; role: "user" | "admin" };
      token: string;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () =>
    request<{ user: Me }>("/api/auth/me").then((r) => {
      setMe(r.user);
      return r.user;
    }),

  meStats: () =>
    request<{
      stats: {
        published: number;
        favorites: number;
        bought: number;
        sold: number;
        trades: number;
      };
    }>("/api/users/me/stats").then((r) => r.stats),

  updateProfile: (data: {
    nickname: string;
    avatar?: string;
    gender?: "male" | "female" | "other";
    bio?: string;
  }) =>
    request<{ message: string }>("/api/users/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updatePassword: (data: { oldPassword: string; newPassword: string }) =>
    request<{ message: string }>("/api/users/me/password", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  sendChangePhoneCode: (data: { newPhone: string }) =>
    request<{ message: string }>("/api/users/me/phone/send-code", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  confirmChangePhone: (data: { newPhone: string; code: string }) =>
    request<{ message: string }>("/api/users/me/phone/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAddresses: () =>
    request<{ list: any[] }>("/api/users/me/addresses").then((r) => r.list),

  addAddress: (data: {
    contact: string;
    phone: string;
    campus: string;
    building: string;
    detail: string;
    isDefault?: boolean;
  }) =>
    request<{ message: string; address: any }>("/api/users/me/addresses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteAddress: (id: number) =>
    request<void>(`/api/users/me/addresses/${id}`, { method: "DELETE" }),

  setDefaultAddress: (id: number) =>
    request<{ message: string }>(`/api/users/me/addresses/${id}/default`, {
      method: "PATCH",
    }),

  // Admin
  adminListUsers: () =>
    request<{
      list: Array<{
        id: number;
        nickname: string;
        avatar?: string;
        phone: string;
        role: "user" | "admin";
        status: "active" | "banned";
        createdAt: string;
        products: number;
        orders: number;
      }>;
    }>("/api/admin/users").then((r) => r.list),

  adminGetUserDetail: (userId: number) =>
    request<{
      user: {
        id: number;
        email?: string | null;
        name?: string | null;
        nickname: string;
        avatar?: string | null;
        phone: string;
        gender?: "male" | "female" | "other" | string | null;
        bio?: string | null;
        role: "user" | "admin";
        status: "active" | "banned";
        created_at: string;
      };
      stats: { products: number; orders: number; favorites: number };
      products: any[];
      orders: any[];
    }>(`/api/admin/users/${userId}?limitProducts=10000&limitOrders=10000`),

  adminSetUserRole: (userId: number, role: "user" | "admin") =>
    request<{ message: string }>(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  adminSetUserStatus: (userId: number, status: "active" | "banned") =>
    request<{ message: string }>(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminSetUserAvatar: (userId: number, avatar: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}/avatar`, {
      method: "PATCH",
      body: JSON.stringify({ avatar }),
    }),

  adminSetUserPhone: (userId: number, phone: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}/phone`, {
      method: "PATCH",
      body: JSON.stringify({ phone }),
    }),

  adminResetUserPassword: (userId: number, newPassword: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}/password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),

  adminGetUserLogs: (userId: number, limit = 50) => {
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    return request<{ list: any[] }>(`/api/admin/users/${userId}/logs?${q.toString()}`).then((r) => r.list);
  },

  adminGetUserComplaints: (userId: number, limit = 50) => {
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    return request<{ list: any[] }>(`/api/admin/users/${userId}/complaints?${q.toString()}`).then((r) => r.list);
  },

  adminGetUserEvaluations: (userId: number, limit = 50) => {
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    return request<{ list: any[] }>(`/api/admin/users/${userId}/evaluations?${q.toString()}`).then((r) => r.list);
  },

  adminStats: () =>
    request<{ stats: any }>("/api/admin/stats").then((r) => r.stats),

  adminListAnnouncements: () =>
    request<{
      list: Array<{
        id: string;
        title: string;
        content: string;
        isTop: boolean;
        status: "published" | "draft";
        created_at: string;
      }>;
    }>("/api/admin/announcements").then((r) => r.list),

  adminCreateAnnouncement: (data: {
    title: string;
    content: string;
    status: "published" | "draft";
  }) =>
    request<{ item: any }>("/api/admin/announcements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adminUpdateAnnouncement: (
    id: string,
    data: { title?: string; content?: string; status?: "published" | "draft" }
  ) =>
    request<{ message: string }>(`/api/admin/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminSetAnnouncementTop: (id: string, isTop: boolean) =>
    request<{ message: string }>(`/api/admin/announcements/${id}/top`, {
      method: "PATCH",
      body: JSON.stringify({ isTop }),
    }),

  adminDeleteAnnouncement: (id: string) =>
    request<void>(`/api/admin/announcements/${id}`, { method: "DELETE" }),

  adminListBanners: () =>
    request<{
      list: Array<{
        id: string;
        title: string;
        image: string;
        link: string;
        sort: number;
        active: boolean;
      }>;
    }>("/api/admin/banners").then((r) => r.list),

  adminCreateBanner: (data: { title: string; image: string; link: string }) =>
    request<{ item: any }>("/api/admin/banners", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adminUpdateBanner: (id: string, data: { title?: string; image?: string; link?: string }) =>
    request<{ message: string }>(`/api/admin/banners/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminSetBannerStatus: (id: string, active: boolean) =>
    request<{ message: string }>(`/api/admin/banners/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),

  adminSortBanners: (ids: string[]) =>
    request<{ message: string }>("/api/admin/banners/sort", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    }),

  adminDeleteBanner: (id: string) =>
    request<void>(`/api/admin/banners/${id}`, { method: "DELETE" }),

  adminListCategories: () =>
    request<{
      list: Array<{
        id: string;
        name: string;
        parentId: string | null;
        sort: number;
        enabled: boolean;
      }>;
    }>("/api/admin/categories").then((r) => r.list),

  adminCreateCategory: (data: { name: string; parentId?: string | null; enabled?: boolean }) =>
    request<{ item: any }>("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adminUpdateCategory: (id: string, data: { name?: string; enabled?: boolean }) =>
    request<{ message: string }>(`/api/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminDeleteCategory: (id: string) =>
    request<void>(`/api/admin/categories/${id}`, { method: "DELETE" }),

  // Admin: 字典管理
  adminListDictItems: (type: string) =>
    request<{ list: any[] }>(`/api/admin/dicts/${encodeURIComponent(type)}`).then((r) => r.list),

  adminCreateDictItem: (type: string, data: { value: string; label: string; enabled?: boolean }) =>
    request<{ item: any }>(`/api/admin/dicts/${encodeURIComponent(type)}`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.item),

  adminUpdateDictItem: (type: string, id: string, data: { value?: string; label?: string; enabled?: boolean; sort?: number }) =>
    request<{ message: string }>(`/api/admin/dicts/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminSortDictItems: (type: string, ids: string[]) =>
    request<{ message: string }>(`/api/admin/dicts/${encodeURIComponent(type)}/sort`, {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    }),

  adminDeleteDictItem: (type: string, id: string) =>
    request<void>(`/api/admin/dicts/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Admin: AI 中心（提示词管理）
  adminListAiPrompts: (params?: { keyword?: string; scene?: string; enabled?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.keyword) q.set("keyword", params.keyword);
    if (params?.scene) q.set("scene", params.scene);
    if (params?.enabled != null) q.set("enabled", params.enabled ? "1" : "0");
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/ai/prompts${suffix}`).then((r) => r.list);
  },

  adminCreateAiPrompt: (data: { name: string; scene: string; content: string; enabled?: boolean }) =>
    request<{ item: any }>(`/api/admin/ai/prompts`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.item),

  adminUpdateAiPrompt: (id: string, data: { name?: string; scene?: string; content?: string; enabled?: boolean }) =>
    request<{ message: string }>(`/api/admin/ai/prompts/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminSetAiPromptEnabled: (id: string, enabled: boolean) =>
    request<{ message: string }>(`/api/admin/ai/prompts/${encodeURIComponent(id)}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  adminDeleteAiPrompt: (id: string) =>
    request<void>(`/api/admin/ai/prompts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  adminListProducts: (params?: { status?: string; keyword?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.keyword) q.set("keyword", params.keyword);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/products${suffix}`).then((r) => r.list);
  },

  adminGetProduct: (id: number) =>
    request<{ item: any }>(`/api/admin/products/${id}`).then((r) => r.item),

  adminUpdateProduct: (
    id: number,
    data: {
      title?: string;
      description?: string;
      price?: number | string;
      image_url?: string;
      condition?: string;
      category_id?: string;
      campus?: string;
      reject_reason?: string;
      images?: string[] | string;
    },
  ) =>
    request<{ message: string }>(`/api/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  adminSetProductStatus: (id: number, status: "approved" | "down" | "deleted") =>
    request<{ message: string }>(`/api/admin/products/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  listCategories: () =>
    request<{
      list: Array<{
        id: string;
        name: string;
        parentId: string | null;
        sort: number;
        enabled: boolean;
      }>;
    }>("/api/categories").then((r) => r.list),

  listDicts: (type: string) => {
    const q = new URLSearchParams();
    q.set("type", type);
    return request<{
      list: Array<{ id: string; dict_type: string; value: string; label: string; sort: number; enabled: boolean }>;
    }>(`/api/dicts?${q.toString()}`).then((r) => r.list);
  },

  listAnnouncements: () =>
    request<{
      list: Array<{
        id: string;
        title: string;
        content: string;
        isTop: boolean;
        status: "published" | "draft";
        created_at: string;
      }>;
    }>("/api/announcements").then((r) => r.list),

  listBanners: () =>
    request<{
      list: Array<{
        id: string;
        title: string;
        image: string;
        link: string;
        sort: number;
        active: boolean;
      }>;
    }>("/api/banners").then((r) => r.list),

  // 管理端：订单全量管理
  adminListOrders: (params?: { status?: string; keyword?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.keyword) q.set("keyword", params.keyword);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/orders${suffix}`).then((r) => r.list);
  },

  // 管理端：投诉与纠纷处理
  adminListComplaints: (params?: { status?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.type) q.set("type", params.type);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/complaints${suffix}`).then((r) => r.list);
  },

  adminHandleComplaint: (id: number, data: {
    status: string;
    result: string;
  }) =>
    request<{ message: string }>(`/api/admin/complaints/${id}/handle`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // 管理端：操作日志管理
  adminListLogs: (params?: { action?: string; module?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.module) q.set("module", params.module);
    if (params?.startDate) q.set("startDate", params.startDate);
    if (params?.endDate) q.set("endDate", params.endDate);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/logs${suffix}`).then((r) => r.list);
  },

  // 管理端：评价与内容审核
  adminListEvaluations: () =>
    request<{ list: any[] }>("/api/admin/evaluations").then((r) => r.list),

  // 管理端：物品收藏管理
  adminListFavorites: (params?: { product_id?: number; user_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.product_id) q.set("product_id", params.product_id.toString());
    if (params?.user_id) q.set("user_id", params.user_id.toString());
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/favorites${suffix}`).then((r) => r.list);
  },

  listProducts: () =>
    request<
      {
        id: number;
        title: string;
        description: string;
        price: number;
        image_url: string;
        status: string;
        owner_name: string;
      }[]
    >("/api/products"),

  getProduct: (id: number) =>
    request<{
      id: number;
      title: string;
      description: string;
      price: number;
      image_url: string;
      status: string;
      owner_name: string;
    }>(`/api/products/${id}`),

  createProduct: (data: {
    title: string;
    description?: string;
    price: number;
    image_url?: string;
    images?: string[] | string;
    owner_id: number;
  }) =>
    request("/api/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  changeProductStatus: (id: number, status: "up" | "down") =>
    request<{ message: string }>(`/api/products/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteProduct: (id: number) =>
    request<void>(`/api/products/${id}`, {
      method: "DELETE",
    }),

  listFavorites: (userId: number) =>
    request<
      {
        id: number;
        created_at: string;
        product_id: number;
        title: string;
        price: number;
        image_url: string;
      }[]
    >(`/api/users/${userId}/favorites`),

  addFavorite: (userId: number, product_id: number) =>
    request(`/api/users/${userId}/favorites`, {
      method: "POST",
      body: JSON.stringify({ product_id }),
    }),

  removeFavorite: (userId: number, productId: number) =>
    request<void>(`/api/users/${userId}/favorites/${productId}`, {
      method: "DELETE",
    }),

  createOrder: (data: {
    product_id: number;
    deliveryAddress: string;
    deliveryTime: string;
  }) =>
    request("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listOrders: (userId: number) =>
    request<
      {
        id: number;
        status: string;
        created_at: string;
        title: string;
        price: number;
      }[]
    >(`/api/users/${userId}/orders`),

  getOrder: (id: number) =>
    request<any>(`/api/orders/${id}`),

  updateOrderStatus: (id: number, status: string) =>
    request<{ message: string }>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // 交易评价
  createEvaluation: (orderId: number, data: {
    rating: number;
    content: string;
    target_type: "buyer" | "seller";
  }) =>
    request<{ message: string }>(`/api/orders/${orderId}/evaluation`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyEvaluation: (orderId: number) =>
    request<{ evaluation: any | null }>(`/api/orders/${orderId}/evaluation`).then((r) => r.evaluation),

  // 投诉与反馈
  createComplaint: (data: {
    type: string;
    target_id: number;
    content: string;
    evidence?: string[];
  }) =>
    request<{ message: string }>("/api/complaints", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // 系统通知
  listNotifications: () =>
    request<{ list: any[] }>("/api/users/me/notifications").then((r) => r.list),

  markNotificationAsRead: (id: string) =>
    request<{ message: string }>(`/api/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markAllNotificationsAsRead: () =>
    request<{ message: string }>("/api/notifications/read-all", {
      method: "PATCH",
    }),

  // 消息系统
  startConversation: (data: { targetUserId: number; productId?: number | null }) =>
    request<{ id: string }>("/api/messages/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMessages: () =>
    request<{
      conversations: Array<{
        id: string;
        contact: {
          id: number;
          nickname: string;
          avatar: string;
        };
        lastMessage: string;
        lastTime: string;
        unreadCount: number;
        productTitle?: string;
        productPrice?: number;
        productImage?: string;
        productId?: string;
      }>;
    }>("/api/messages"),

  getChatMessages: (id: string) =>
    request<{
      messages: Array<{
        id: string;
        senderId: string;
        content: string;
        type: "text" | "image" | "product-card";
        time: string;
        isMe: boolean;
        productCard?: {
          title: string;
          price: number;
          image: string;
        };
      }>;
    }>(`/api/messages/${id}`),

  sendChatMessage: (id: string, data: {
    content: string;
    type: "text" | "image" | "product-card";
  }) =>
    request<{
      id: string;
      senderId: string;
      content: string;
      type: "text" | "image" | "product-card";
      time: string;
      isMe: boolean;
    }>(`/api/messages/${id}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Admin: 用户聊天记录审查
  adminGetUserChats: (userId: number, limit = 50) => {
    const q = new URLSearchParams();
    q.set("limit", String(limit));
    return request<{ list: any[] }>(`/api/admin/users/${userId}/chats?${q.toString()}`).then((r) => r.list);
  },

  // AI 生成商品描述和价格估计
  generateProduct: (data: { description: string; images?: string[] }) =>
    request<{
      description: string;
      price: string;
    }>('/api/ai/generate-product', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI 生成商品描述和价格估计（流式）
  generateProductStream: async (
    data: { description: string; images?: string[] },
    handlers: {
      onDelta?: (text: string) => void;
      onDone?: (result: { description: string; price: string }) => void;
      onError?: (message: string) => void;
    } = {}
  ) => {
    const token = getToken();
    const res = await fetch(resolveApiUrl("/api/ai/generate-product/stream"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok || !res.body) {
      let message = `请求失败 (${res.status})`;
      try {
        const err = await res.json();
        message = String(err?.error || err?.message || message);
      } catch {
        // ignore
      }
      handlers.onError?.(message);
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const handleSseEvent = (rawEvent: string) => {
      const lines = rawEvent.split("\n").map((x) => x.trim()).filter(Boolean);
      if (!lines.length) return;
      const eventLine = lines.find((x) => x.startsWith("event:"));
      const dataLine = lines.find((x) => x.startsWith("data:"));
      const eventName = eventLine ? eventLine.slice("event:".length).trim() : "message";
      const payloadText = dataLine ? dataLine.slice("data:".length).trim() : "{}";

      try {
        const payload = JSON.parse(payloadText || "{}");
        if (eventName === "delta") {
          handlers.onDelta?.(String(payload?.text || ""));
          return;
        }
        if (eventName === "done") {
          handlers.onDone?.({
            description: String(payload?.description || ""),
            price: String(payload?.price || ""),
          });
          return;
        }
        if (eventName === "error") {
          const message = String(payload?.error || "AI 生成失败，请重试");
          handlers.onError?.(message);
          throw new Error(message);
        }
      } catch (err) {
        if (err instanceof Error) throw err;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";
      for (const chunk of chunks) {
        handleSseEvent(chunk);
      }
    }

    if (buffer.trim()) handleSseEvent(buffer);
  },

  // AI 搜索：推荐相关性最高的单个商品
  aiSearchTopProduct: (data: { query: string }) =>
    request<{ productId: number | null; reason?: string; aiReply?: string; promptName?: string }>(
      "/api/ai/search-top-product",
      {
      method: "POST",
      body: JSON.stringify(data),
      }
    ),

  // OSS 直传（S3-compatible 通用）
  ossConfig: () =>
    request<{
      enabled: boolean;
      provider: string;
      bucket: string | null;
      uploadExpires: number;
    }>("/api/oss/config"),

  ossPresignUpload: (data: { filename: string; contentType: string; folder?: string }) =>
    request<{
      uploadUrl: string;
      method: "PUT";
      headers?: Record<string, string>;
      key: string;
      bucket: string;
      publicUrl: string | null;
    }>("/api/oss/presign-upload", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  ossUploadFile: async (file: File, folder = "products") => {
    return uploadViaBackend(file, folder);
  },

  // Admin: upload banner image (supports OSS or local)
  adminUploadBannerImage: async (file: File) => {
    return uploadBannerViaAdmin(file);
  },
};

