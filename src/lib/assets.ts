const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";

function getApiOrigin() {
  if (!API_BASE) {
    // 未配置 API_BASE 时，使用当前站点同源地址
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "";
  }
  try {
    return new URL(API_BASE).origin;
  } catch {
    return API_BASE;
  }
}

/**
 * 把数据库里的图片字段规范成“当前环境可访问的完整 URL”。
 * - 推荐：数据库存 `/uploads/...` 或 `/api/oss/object?...` 这类相对路径
 * - 兼容历史：存了 `http://localhost:4000/...` 也能在生产自动替换为当前 API 域名
 */
export function resolveAssetUrl(input?: string | null): string {
  const v = String(input || "").trim();
  if (!v) return "";

  // 已经是 data/blob 这类浏览器可用的 URL
  if (v.startsWith("data:") || v.startsWith("blob:")) return v;

  // 绝对 URL：如果是历史的 localhost/127.0.0.1，替换成当前 API origin
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        return `${getApiOrigin()}${u.pathname}${u.search}${u.hash}`;
      }
      return v;
    } catch {
      return v;
    }
  }

  // 规范化相对路径
  const path = v.startsWith("/") ? v : `/${v}`;
  return API_BASE ? `${API_BASE}${path}` : path;
}

