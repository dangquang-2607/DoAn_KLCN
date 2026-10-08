import { timestamp } from "../tien-ich/adminPresentation";

export const SESSION_PAGE_SIZE = 4;

// Device names may be custom labels or a truncated User-Agent from the API.
// Never infer that a record belongs to the current device, or merge sessions.
export function sessionDeviceName(value) {
  const raw = value?.trim() || "";
  if (!raw) return "Thiết bị chưa xác định";
  if (!/Mozilla\/|AppleWebKit\/|Chrome\/|Firefox\/|Edg\//i.test(raw)) return raw;
  const browser = /Edg\//i.test(raw) ? "Edge" : /OPR\//i.test(raw) ? "Opera"
    : /Firefox\//i.test(raw) ? "Firefox" : /Chrome\//i.test(raw) ? "Chrome"
      : /Safari\//i.test(raw) ? "Safari" : "Trình duyệt";
  const system = /Android/i.test(raw) ? "Android" : /iPhone|iPad/i.test(raw) ? "iOS"
    : /Windows/i.test(raw) ? "Windows" : /Macintosh|Mac OS X/i.test(raw) ? "macOS"
      : /Linux/i.test(raw) ? "Linux" : "";
  return system ? `${browser} · ${system}` : browser;
}

export function sessionTimestamp(value) {
  // Auth sessions are stored as UTC; older responses serialize naive UTC dates.
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/Z$|[+-]\d{2}:\d{2}$/.test(value)
    ? `${value}Z` : value;
  return timestamp(normalized);
}

export function sessionPage(records, requestedPage) {
  const pages = Math.max(1, Math.ceil(records.length / SESSION_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(requestedPage) || 1));
  const offset = (page - 1) * SESSION_PAGE_SIZE;
  return { page, pages, items: records.slice(offset, offset + SESSION_PAGE_SIZE),
    start: records.length ? offset + 1 : 0, end: Math.min(offset + SESSION_PAGE_SIZE, records.length), total: records.length };
}
