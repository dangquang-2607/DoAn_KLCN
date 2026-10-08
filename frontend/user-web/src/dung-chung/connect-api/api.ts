/**
 * ============================================================================
 * TÊN FILE: api.ts
 * MÀN HÌNH / PHÂN HỆ: Hạ tầng và tiện ích cốt lõi
 * NHÓM VỆ TINH: dung-chung (Dịch vụ và tiện ích cốt lõi)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cấu hình Axios, access token, refresh token và xử lý phiên hết hạn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Axios, biến môi trường NEXT_PUBLIC_API_URL và Web Storage.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất Axios client đã cấu hình để các phân hệ gọi backend.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
/**
 * HTTP client duy nhất của user-web.
 * File này gắn access token, phối hợp refresh token một lần khi hết hạn và
 * phát sự kiện đăng xuất khi phiên không thể khôi phục.
 */
import axios from "axios";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  .replace(/\/+$/, "")
  .replace(/\/api(?:\/v1)?$/, "");

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

// Gắn khóa idempotency ổn định cho thao tác tiền để retry mạng không tạo bản ghi trùng.
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

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

// Xóa khóa idempotency sau phản hồi thành công và khôi phục phiên tập trung khi gặp 401.
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
      // Các request 401 đồng thời chờ chung một lần refresh thay vì xoay token nhiều lần.
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
        }, { timeout: 15000 });

        const newToken = data.access_token;
        sessionStorage.setItem("user_access_token", newToken);
        if (data.refresh_token)
          sessionStorage.setItem("user_refresh_token", data.refresh_token);

        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch (refreshError) {
        // Lỗi mạng/5xx không chứng minh phiên hết hạn. Giữ token để người dùng
        // thử lại; vẫn từ chối request hiện tại, không bỏ qua xác thực.
        refreshQueue.forEach(({ reject }) => reject(refreshError));
        refreshQueue = [];
        const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        if (status === 401 || status === 403) _doLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);

function _doLogout() {
  // Thu hồi refresh token theo khả năng tốt nhất rồi luôn xóa thông tin phiên tại trình duyệt.
  if (typeof window !== "undefined") {
    const refreshToken = sessionStorage.getItem("user_refresh_token");
    if (refreshToken) {
      axios
        .post(`${BASE_URL}/api/v1/auth/logout`, { refresh_token: refreshToken })
        .catch(() => {});
    }
    sessionStorage.removeItem("user_access_token");
    sessionStorage.removeItem("user_refresh_token");
    // Module Axios dùng chung chạy ngoài React nên không có router instance để điều hướng.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
}

export default api;
