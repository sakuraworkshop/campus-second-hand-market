import { useCallback } from "react";

type TimeInput = string | number | Date | null | undefined;

function toDate(input: TimeInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWithParts(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  withTime: boolean
): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    ...options,
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const y = map.get("year") || "0000";
  const m = (map.get("month") || "01").padStart(2, "0");
  const d = (map.get("day") || "01").padStart(2, "0");
  if (!withTime) return `${y}-${m}-${d}`;
  const h = (map.get("hour") || "00").padStart(2, "0");
  const min = (map.get("minute") || "00").padStart(2, "0");
  const s = (map.get("second") || "00").padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export function useUtc8Time() {
  const formatDateTime = useCallback((input: TimeInput, fallback = "-") => {
    const date = toDate(input);
    if (!date) return fallback;
    return formatWithParts(
      date,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
      true
    );
  }, []);

  const formatDate = useCallback((input: TimeInput, fallback = "-") => {
    const date = toDate(input);
    if (!date) return fallback;
    return formatWithParts(
      date,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
      false
    );
  }, []);

  return { formatDateTime, formatDate };
}

