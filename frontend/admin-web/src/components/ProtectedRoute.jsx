import { Navigate } from 'react-router-dom';

/**
 * Bảo vệ route — nếu chưa có token thì redirect về trang login.
 * Security thật sự vẫn do backend (require_admin) đảm bảo.
 */
export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('admin_access_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}
