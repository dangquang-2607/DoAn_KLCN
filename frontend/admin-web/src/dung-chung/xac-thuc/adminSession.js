import { CanceledError } from "axios";
import api from "../connect-api/api.js";

export function hasAdminRole(profile) {
  return typeof profile?.role === "string" && profile.role.toUpperCase() === "ADMIN";
}

export class AdminAccessError extends Error {
  constructor() {
    super("Email hoặc mật khẩu không chính xác.");
    this.name = "AdminAccessError";
  }
}

/** Check the server profile before callers persist an admin session. */
export async function requestAdminSession(credentials, { signal } = {}) {
  let tokens;
  try {
    const result = await api.post("/auth/login", credentials, { signal, timeout: 15000 });
    tokens = result.data;
    if (typeof tokens?.access_token !== "string" || !tokens.access_token) {
      throw new Error("Phản hồi đăng nhập không hợp lệ.");
    }
    const { data: profile } = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal,
      timeout: 15000,
    });
    if (!hasAdminRole(profile)) throw new AdminAccessError();
    if (signal?.aborted) throw new CanceledError();
    return tokens;
  } catch (error) {
    // Revoke a newly issued session when role checks fail or login is abandoned.
    if (tokens?.refresh_token) {
      void api.post("/auth/logout", { refresh_token: tokens.refresh_token }, { timeout: 5000 }).catch(() => {});
    }
    throw error;
  }
}
