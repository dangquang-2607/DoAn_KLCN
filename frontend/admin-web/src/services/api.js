import axios from "axios";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/\/+$/, "")
  .replace(/\/api(?:\/v1)?$/, "");

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

// ─── Request interceptor: gắn JWT ────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_access_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh token ────────────────────────────────
let isRefreshing = false;
let refreshQueue = []; // hàng đợi các request bị 401

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalReq = err.config;

    // Không refresh nếu là chính endpoint auth
    const isAuthEndpoint =
      originalReq?.url?.includes("/auth/login") ||
      originalReq?.url?.includes("/auth/refresh") ||
      originalReq?.url?.includes("/auth/register");

    if (
      err.response?.status === 401 &&
      !isAuthEndpoint &&
      originalReq &&
      !originalReq._retry
    ) {
      const refreshToken = sessionStorage.getItem("admin_refresh_token");

      if (!refreshToken) {
        // Không có refresh token → logout
        _doLogout();
        return Promise.reject(err);
      }

      originalReq._retry = true;
      if (isRefreshing) {
        // Đang refresh → xếp hàng đợi
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
        sessionStorage.setItem("admin_access_token", newToken);
        if (data.refresh_token)
          sessionStorage.setItem("admin_refresh_token", data.refresh_token);

        // Giải phóng hàng đợi
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch {
        // Refresh thất bại → logout
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
  const refreshToken = sessionStorage.getItem("admin_refresh_token");
  if (refreshToken) {
    // Fire-and-forget logout để revoke token trên server
    axios
      .post(`${BASE_URL}/api/v1/auth/logout`, { refresh_token: refreshToken })
      .catch(() => {});
  }
  sessionStorage.removeItem("admin_access_token");
  sessionStorage.removeItem("admin_refresh_token");
  window.location.href = "/";
}

export default api;
