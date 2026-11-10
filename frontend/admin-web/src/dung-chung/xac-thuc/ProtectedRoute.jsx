import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('admin_access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
