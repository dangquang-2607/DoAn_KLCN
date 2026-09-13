import axios from "axios";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace(/\/+$/, "")
  .replace(/\/api(?:\/v1)?$/, "");

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const method = (config.method || "get").toLowerCase();
    if (["post", "patch", "delete"].includes(method) && /^\/(accounts|transactions)(\/|$)/.test(config.url || "") && !config.headers["Idempotency-Key"]) {
      const signature = JSON.stringify([method, config.url, config.data]);
      const storageKey = "cf-pending-money:" + signature;
      let key = sessionStorage.getItem(storageKey);
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
      config.headers["Idempotency-Key"] = key;
    }
    // Only set Authorization if not already explicitly provided on config.headers
    if (!config.headers.Authorization) {
      const token = sessionStorage.getItem("user_access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

api.interceptors.response.use(
  (res) => {
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

    // Không redirect/refresh nếu lỗi 401 xuất phát từ request đăng nhập/đăng ký
    const isAuthEndpoint =
      originalReq?.url?.includes("/auth/login") ||
      originalReq?.url?.includes("/auth/register") ||
      originalReq?.url?.includes("/auth/refresh");

    if (
      typeof window !== "undefined" &&
      err.response?.status === 401 &&
      !isAuthEndpoint &&
      originalReq &&
      !originalReq._retry
    ) {
      const refreshToken = sessionStorage.getItem("user_refresh_token");

      if (!refreshToken) {
        _doLogout();
        return Promise.reject(err);
      }

      originalReq._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalReq.headers.Authorization = `Bearer ${token}`;
          return api(originalReq);
        });
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken = data.access_token;
        sessionStorage.setItem("user_access_token", newToken);
        if (data.refresh_token)
          sessionStorage.setItem("user_refresh_token", data.refresh_token);

        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch (refreshErr) {
        refreshQueue.forEach(({ reject }) => reject(err));
        refreshQueue = [];
        _doLogout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);

function _doLogout() {
  if (typeof window !== "undefined") {
    const refreshToken = sessionStorage.getItem("user_refresh_token");
    if (refreshToken) {
      axios
        .post(`${BASE_URL}/api/v1/auth/logout`, { refresh_token: refreshToken })
        .catch(() => {});
    }
    sessionStorage.removeItem("user_access_token");
    sessionStorage.removeItem("user_refresh_token");
    window.location.href = "/login";
  }
}

export default api;
