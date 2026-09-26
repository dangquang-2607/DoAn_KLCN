/**
 * ============================================================================
 * TÊN FILE: api.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Hạ tầng gọi API quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Tạo Axios client, đính kèm access token và tuần tự hóa quá trình refresh token.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   VITE_API_URL, Axios và token trong sessionStorage.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất api client dùng chung cho toàn bộ route quản trị.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không log token; khi refresh thất bại phải xóa phiên và revoke refresh token.
 * ============================================================================
 */
import axios from "axios";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000")
  .replace(/\/+$/, "")
  .replace(/\/api(?:\/v1)?$/, "");

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

// Gắn JWT cho request nghiệp vụ nhưng tôn trọng Authorization được truyền rõ ràng.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_access_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Chỉ cho một request refresh chạy; các request 401 còn lại chờ chung kết quả.
let isRefreshing = false;
let refreshQueue = []; // Hàng đợi các request bị 401 trong lúc token đang được làm mới.

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalReq = err.config;

    // Không lặp refresh trên chính các endpoint xác thực.
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
        // Thiếu refresh token đồng nghĩa phiên không thể phục hồi.
        _doLogout();
        return Promise.reject(err);
      }

      originalReq._retry = true;
      if (isRefreshing) {
        // Request đến sau chờ token mới thay vì tạo thêm request refresh.
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

        // Phát token mới cho toàn bộ request đang chờ.
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];

        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch {
        // Từ chối hàng đợi và kết thúc phiên khi refresh thất bại.
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
    // Gửi logout không chặn UI để backend có cơ hội thu hồi refresh token.
    axios
      .post(`${BASE_URL}/api/v1/auth/logout`, { refresh_token: refreshToken })
      .catch(() => {});
  }
  sessionStorage.removeItem("admin_access_token");
  sessionStorage.removeItem("admin_refresh_token");
  window.location.href = "/";
}

export default api;
