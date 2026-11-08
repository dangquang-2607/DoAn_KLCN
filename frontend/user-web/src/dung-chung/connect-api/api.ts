/**
 * HTTP client duy nhất của user-web.
 * File này gắn access token, phối hợp refresh token một lần khi hết hạn và
 * phát sự kiện đăng xuất khi phiên không thể khôi phục.
 */
import axios from "axios";
import { newRequestId, sha256Hex } from "@/dung-chung/tien-ich/browserCrypto";


// Each login/logout invalidates requests and refresh work from the previous session.
let sessionEpoch = 0;
declare module "axios" {
  interface AxiosRequestConfig { _sessionEpoch?: number; _moneyOwner?: string; }
}
let refreshTask: { epoch: number; promise: Promise<string> } | null = null;

export function clearSession(clearRemembered = true, keepPending = false) {
  sessionEpoch += 1;
  refreshTask = null;
  if (!keepPending) {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("cf-pending-invoice:") || key.startsWith("cf-pending-money:")) sessionStorage.removeItem(key);
    }
  }
  for (const key of ["user_access_token", "user_refresh_token", "user", "user_remember"]) {
    sessionStorage.removeItem(key);
    if (clearRemembered) localStorage.removeItem(key);
  }
}

export function saveSession(access: string, refresh: string, remember: boolean) {
  clearSession(true, true);
  sessionStorage.setItem("user_access_token", access);
  sessionStorage.setItem("user_refresh_token", refresh);
  if (remember) {
    sessionStorage.setItem("user_remember", "1");
    localStorage.setItem("user_access_token", access);
    localStorage.setItem("user_refresh_token", refresh);
    localStorage.setItem("user_remember", "1");
  }
}

// Only restore an explicitly remembered session. Server validation still happens
// on every request; expired access tokens are renewed through the normal flow.
export function restoreSession() {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem("user_access_token")) return true;
  const access = localStorage.getItem("user_access_token"), refresh = localStorage.getItem("user_refresh_token");
  if (!access || !refresh) return false;
  sessionStorage.setItem("user_access_token", access);
  sessionStorage.setItem("user_refresh_token", refresh);
  sessionStorage.setItem("user_remember", "1");
  return true;
}

// Used only for scoping local keys. The API verifies the signature and access rights.
function tokenIdentity(token: string | null): { sub: string; sid?: string } | null {
  const parts = token?.split(".");
  if (parts?.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload?.sub !== "string" ||
        !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(payload.sub)) return null;
    if (payload.sid !== undefined && (typeof payload.sid !== "string" || !payload.sid.trim())) return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

export function sessionOwner(): string {
  if (typeof window !== "undefined") {
    const identity = tokenIdentity(sessionStorage.getItem("user_access_token"));
    if (identity) return identity.sub;
    const refresh = sessionStorage.getItem("user_refresh_token");
    // A retry after signing back in as the same user must keep any unresolved key.
    clearSession(refresh === localStorage.getItem("user_refresh_token"), true);
    window.location.replace("/login?reason=invalid-session");
  }
  throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
}

export function syncRememberedSession() {
  if (sessionStorage.getItem("user_remember") !== "1") return true;
  const access = localStorage.getItem("user_access_token"), refresh = localStorage.getItem("user_refresh_token");
  const currentToken = sessionStorage.getItem("user_access_token");
  const current = tokenIdentity(currentToken), saved = tokenIdentity(access);
  if (!access || !refresh || !current || !saved || current.sub !== saved.sub ||
      (access !== currentToken && (!current.sid || current.sid !== saved.sid))) {
    clearSession(false); return false;
  }
  sessionStorage.setItem("user_access_token", access);
  sessionStorage.setItem("user_refresh_token", refresh);
  return true;
}

function sessionChanged() {
  return new axios.CanceledError("Phiên đăng nhập đã thay đổi.");
}

const api = axios.create({
  baseURL: "/api/v1",
});

// Gắn khóa idempotency ổn định cho thao tác tiền để retry mạng không tạo bản ghi trùng.
api.interceptors.request.use(async (config) => {
  restoreSession();
  if (config._sessionEpoch !== undefined && config._sessionEpoch !== sessionEpoch) throw sessionChanged();
  config._sessionEpoch = sessionEpoch;
  if (typeof window !== "undefined") {
    const method = (config.method || "get").toLowerCase();
    if (config._moneyOwner || (["post", "patch", "delete"].includes(method) &&
        /^\/(accounts|transactions|wallets|bookkeeping)(\/|$)/.test(config.url || ""))) {
      const user = sessionOwner();
      if (config._moneyOwner !== undefined && config._moneyOwner !== user) throw sessionChanged();
      config._moneyOwner = user;
    }
    if (config._moneyOwner && !config.headers["Idempotency-Key"]) {
      const user = config._moneyOwner;
      const signature = JSON.stringify([method, config.url, config.data]);
      const digest = await sha256Hex(signature);
      if (config._sessionEpoch !== sessionEpoch || sessionOwner() !== user) throw sessionChanged();
      const storageKey = "cf-pending-money:" + user + ":" + digest;
      let key = sessionStorage.getItem(storageKey);
      if (!key) { key = newRequestId(); sessionStorage.setItem(storageKey, key); }
      config.headers["Idempotency-Key"] = key;
    }
    // Chỉ gắn Authorization khi request chưa chủ động truyền header này.
    if (!config.headers.Authorization) {
      const token = sessionStorage.getItem("user_access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Refresh promises are shared only by requests from the same session.
api.interceptors.response.use(
  (res) => {
    if (res.config._sessionEpoch !== undefined && res.config._sessionEpoch !== sessionEpoch) throw sessionChanged();
    if (typeof window !== "undefined" && res.config.headers["Idempotency-Key"]) {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("cf-pending-money:") && sessionStorage.getItem(key) === res.config.headers["Idempotency-Key"]) sessionStorage.removeItem(key);
      }
    }
    return res;
  },
  async (err) => {
    const originalReq = err.config;
    if (originalReq?._sessionEpoch !== undefined && originalReq._sessionEpoch !== sessionEpoch) throw sessionChanged();
    const isAuthEndpoint = /\/auth\/(login|register|refresh|logout)(?:$|[/?])/.test(originalReq?.url || "");
    if (typeof window === "undefined" || err.response?.status !== 401 || isAuthEndpoint || !originalReq || originalReq._retry) throw err;
    const epoch = sessionEpoch;
    const refreshToken = sessionStorage.getItem("user_refresh_token");
    if (!refreshToken) { _doLogout(); throw err; }
    originalReq._retry = true;
    if (!refreshTask || refreshTask.epoch !== epoch) {
      const promise = (async () => {
        try {
          const rotate = async () => {
            if (epoch !== sessionEpoch) throw sessionChanged();
            const remembered = sessionStorage.getItem("user_remember") === "1";
            const saved = localStorage.getItem("user_refresh_token");
            if (remembered && saved && saved !== refreshToken) {
              if (!syncRememberedSession()) throw sessionChanged();
              return sessionStorage.getItem("user_access_token")!;
            }
            const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken }, { timeout: 15000 });
            if (epoch !== sessionEpoch || sessionStorage.getItem("user_refresh_token") !== refreshToken) {
              if (data.refresh_token) void axios.post("/api/v1/auth/logout", { refresh_token: data.refresh_token }).catch(() => {});
              throw sessionChanged();
            }
            sessionStorage.setItem("user_access_token", data.access_token);
            if (data.refresh_token) sessionStorage.setItem("user_refresh_token", data.refresh_token);
            if (remembered) {
              localStorage.setItem("user_access_token", data.access_token);
              if (data.refresh_token) localStorage.setItem("user_refresh_token", data.refresh_token);
            }
            return data.access_token as string;
          };
          return navigator.locks ? await navigator.locks.request("cf-user-refresh", rotate) : await rotate();
        } catch (error) {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if (epoch === sessionEpoch && sessionStorage.getItem("user_refresh_token") === refreshToken && (status === 401 || status === 403)) _doLogout();
          throw error;
        } finally {
          if (refreshTask?.epoch === epoch) refreshTask = null;
        }
      })();
      refreshTask = { epoch, promise };
    }
    const token = await refreshTask.promise;
    if (epoch !== sessionEpoch) throw sessionChanged();
    originalReq.headers.Authorization = `Bearer ${token}`;
    return api(originalReq);
  },
);

function _doLogout() {
  const refreshToken = sessionStorage.getItem("user_refresh_token");
  clearSession(true, true);
  if (refreshToken) void axios.post("/api/v1/auth/logout", { refresh_token: refreshToken }).catch(() => {});
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

export default api;
