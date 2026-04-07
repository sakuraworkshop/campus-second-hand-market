import { getToken, clearAuth, setMe, type Me } from "./auth";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
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

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  login: (data: { account: string; password: string }) =>
    request<{ user: { id: number; nickname: string; role: "user" | "admin"; studentId?: string }; token: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  register: (data: {
    nickname: string;
    studentId: string;
    phone?: string;
    password: string;
    gender?: "male" | "female" | "other";
    grade?: string;
    major?: string;
    bio?: string;
    avatar?: string;
  }) =>
    request<{
      user: { id: number; nickname: string; role: "user" | "admin"; studentId?: string };
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

  updateProfile: (data: {
    nickname: string;
    avatar?: string;
    gender?: "male" | "female" | "other";
    grade?: string;
    major?: string;
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
        studentId: string;
        role: "user" | "admin";
        status: "active" | "banned";
        createdAt: string;
        products: number;
        orders: number;
      }>;
    }>("/api/admin/users").then((r) => r.list),

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

  adminListProducts: (params?: { status?: string; keyword?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.keyword) q.set("keyword", params.keyword);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return request<{ list: any[] }>(`/api/admin/products${suffix}`).then((r) => r.list);
  },

  adminAuditProduct: (id: number, action: "approve" | "reject" | "down", reason?: string) =>
    request<{ message: string }>(`/api/admin/products/${id}/audit`, {
      method: "PATCH",
      body: JSON.stringify({ action, reason }),
    }),

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
    owner_id: number;
  }) =>
    request("/api/products", {
      method: "POST",
      body: JSON.stringify(data),
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

  // AI 生成商品描述和价格估计
  generateProduct: (data: { description: string; images?: string[] }) =>
    request<{
      description: string;
      price: string;
    }>('/api/ai/generate-product', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

