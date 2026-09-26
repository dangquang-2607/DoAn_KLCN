/**
 * ============================================================================
 * TÊN FILE: App.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Router ứng dụng
 * MỤC ĐÍCH CỤ THỂ:
 *   Khai báo chín route lazy-load và khung bảo vệ dành cho quản trị viên.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Router, Suspense, ProtectedRoute và DashboardLayout.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất component gốc App cho main.jsx.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   ProtectedRoute chỉ kiểm tra token phía client; backend vẫn xác minh quyền ADMIN.
 * ============================================================================
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const Categories = lazy(() => import('./pages/Categories'));
const Settings = lazy(() => import('./pages/Settings'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const SystemAnalytics = lazy(() => import('./pages/SystemAnalytics'));
const OcrMonitor = lazy(() => import('./pages/OcrMonitor'));
const EmailLogs = lazy(() => import('./pages/EmailLogs'));

// Fallback gọn nhẹ được hiển thị trong lúc tải chunk của từng route.
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{
      width: '28px',
      height: '28px',
      border: '2.5px solid rgba(0,0,0,0.1)',
      borderTopColor: 'var(--brand-primary, #000)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  return (
    <Router basename="/">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/system-analytics" element={<SystemAnalytics />} />
            <Route path="/ocr-monitor" element={<OcrMonitor />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/email-logs" element={<EmailLogs />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
