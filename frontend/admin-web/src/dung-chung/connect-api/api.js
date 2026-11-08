import axios from "axios";


// Each login/logout invalidates requests and refresh work from the previous session.
let sessionEpoch = 0;
let refreshTask = null;

export function clearSession() {
  sessionEpoch += 1;
  refreshTask = null;
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith("cf-pending-invoice:") || key.startsWith("cf-pending-money:")) sessionStorage.removeItem(key);
  }
  for (const key of ["admin_access_token", "admin_refresh_token", "admin"]) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

function sessionChanged() {
  return new axios.CanceledError("Phiên đăng nhập đã thay đổi.");
}

const api = axios.create({
  baseURL: "/api/v1",
});

// Gắn JWT cho request nghiệp vụ nhưng tôn trọng Authorization được truyền rõ ràng.
api.interceptors.request.use((config) => {
  if (config._sessionEpoch !== undefined && config._sessionEpoch !== sessionEpoch) throw sessionChanged();
  config._sessionEpoch = sessionEpoch;
  const token = sessionStorage.getItem("admin_access_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chỉ cho một request refresh chạy; các request 401 còn lại chờ chung kết quả.
// Refresh promises are shared only by requests from the same session.
api.interceptors.response.use(
  (res) => {
    if (res.config._sessionEpoch !== undefined && res.config._sessionEpoch !== sessionEpoch) throw sessionChanged();

    return res;
  },
  async (err) => {
    const originalReq = err.config;
    if (originalReq?._sessionEpoch !== undefined && originalReq._sessionEpoch !== sessionEpoch) throw sessionChanged();
    const isAuthEndpoint = /\/auth\/(login|register|refresh|logout)(?:$|[/?])/.test(originalReq?.url || "");
    if (typeof window === "undefined" || err.response?.status !== 401 || isAuthEndpoint || !originalReq || originalReq._retry) throw err;
    const epoch = sessionEpoch;
    const refreshToken = sessionStorage.getItem("admin_refresh_token");
    if (!refreshToken) { _doLogout(); throw err; }
    originalReq._retry = true;
    if (!refreshTask || refreshTask.epoch !== epoch) {
      const promise = (async () => {
        try {
          const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken }, { timeout: 15000 });
          if (epoch !== sessionEpoch || sessionStorage.getItem("admin_refresh_token") !== refreshToken) {
            if (data.refresh_token) void axios.post("/api/v1/auth/logout", { refresh_token: data.refresh_token }).catch(() => {});
            throw sessionChanged();
          }
          sessionStorage.setItem("admin_access_token", data.access_token);
          if (data.refresh_token) sessionStorage.setItem("admin_refresh_token", data.refresh_token);
          return data.access_token;
        } catch (error) {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if (epoch === sessionEpoch && sessionStorage.getItem("admin_refresh_token") === refreshToken && (status === 401 || status === 403)) _doLogout();
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
  const refreshToken = sessionStorage.getItem("admin_refresh_token");
  clearSession();
  if (refreshToken) void axios.post("/api/v1/auth/logout", { refresh_token: refreshToken }).catch(() => {});
  window.location.href = "/login";
}

export default api;
