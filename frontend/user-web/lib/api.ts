import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('user_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalReq = err.config;

    // Không redirect/refresh nếu lỗi 401 xuất phát từ request đăng nhập/đăng ký
    const isAuthEndpoint = originalReq?.url?.includes('/auth/login') || originalReq?.url?.includes('/auth/register') || originalReq?.url?.includes('/auth/refresh');

    if (typeof window !== 'undefined' && err.response?.status === 401 && !isAuthEndpoint && !originalReq._retry) {
      const refreshToken = sessionStorage.getItem('user_refresh_token');

      if (!refreshToken) {
        _doLogout();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalReq.headers.Authorization = `Bearer ${token}`;
          return api(originalReq);
        });
      }

      originalReq._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken = data.access_token;
        sessionStorage.setItem('user_access_token', newToken);

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
  }
);

function _doLogout() {
  if (typeof window !== 'undefined') {
    const refreshToken = sessionStorage.getItem('user_refresh_token');
    if (refreshToken) {
      axios.post(`${BASE_URL}/api/v1/auth/logout`, { refresh_token: refreshToken }).catch(() => {});
    }
    sessionStorage.removeItem('user_access_token');
    sessionStorage.removeItem('user_refresh_token');
    window.location.href = '/login';
  }
}

export default api;
