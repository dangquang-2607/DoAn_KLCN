import { lazy, Suspense, useEffect } from 'react';
import { installHorizontalWheel } from '../dung-chung/tien-ich/horizontalWheel';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../dung-chung/xac-thuc/ProtectedRoute';

const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const Login = lazy(() => import('../chuc-nang/dang-nhap/Login'));
const Dashboard = lazy(() => import('../chuc-nang/bang-dieu-khien/Dashboard'));
const Users = lazy(() => import('../chuc-nang/nguoi-dung/Users'));
const Categories = lazy(() => import('../chuc-nang/danh-muc-he-thong/Categories'));
const Settings = lazy(() => import('../chuc-nang/cai-dat-bao-mat/Settings'));
const AuditLogs = lazy(() => import('../chuc-nang/nhat-ky-quan-tri/AuditLogs'));
const SystemAnalytics = lazy(() => import('../chuc-nang/phan-tich-van-hanh/SystemAnalytics'));
const OcrMonitor = lazy(() => import('../chuc-nang/giam-sat-hoa-don/OcrMonitor'));
const EmailLogs = lazy(() => import('../chuc-nang/email-cau-hinh/EmailLogs'));
const SupportCases = lazy(() => import('../chuc-nang/ho-tro/SupportCases'));

// Fallback gọn nhẹ được hiển thị trong lúc tải chunk của từng route.
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div style={{
      width: '28px',
      height: '28px',
      border: '2.5px solid rgba(0,0,0,0.1)',
      borderTopColor: 'var(--brand-primary, #000)',
      borderRadius: '50%',
      animation: 'cf-spin 0.7s linear infinite'
    }} />
  </div>
);

function App() {
  useEffect(installHorizontalWheel, []);
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
            <Route path="/support" element={<SupportCases />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
