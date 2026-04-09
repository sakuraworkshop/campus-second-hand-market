export function normalizeProductImages(rawImages: unknown, imageUrl?: string | null): string[] {
  const fromImageUrl = imageUrl ? [String(imageUrl)] : [];

  if (Array.isArray(rawImages)) {
    const arr = rawImages.map((x) => String(x || "").trim()).filter(Boolean);
    return arr.length > 0 ? arr : fromImageUrl;
  }

  if (typeof rawImages === "string") {
    const s = rawImages.trim();
    if (!s) return fromImageUrl;
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          const arr = parsed.map((x) => String(x || "").trim()).filter(Boolean);
          return arr.length > 0 ? arr : fromImageUrl;
        }
      } catch {
        // ignore invalid json
      }
    }
    return [s];
  }

  return fromImageUrl;
}

