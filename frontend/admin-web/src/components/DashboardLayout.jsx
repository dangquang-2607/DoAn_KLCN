import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { TrendingUp, LayoutDashboard, Users, Tags, Settings, Bell, Search, LogOut, ChevronDown, HelpCircle, ClipboardList, BarChart2, ScanLine } from 'lucide-react';
import api from '../services/api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Bảng điều khiển' },
  { to: '/users', icon: Users, label: 'Quản lý Người dùng' },
  { to: '/categories', icon: Tags, label: 'Danh mục Hệ thống' },
  { section: 'Hệ thống' },
  { to: '/system-analytics', icon: BarChart2, label: 'System Analytics' },
  { to: '/ocr-monitor', icon: ScanLine, label: 'OCR Monitor' },
  { to: '/audit-logs', icon: ClipboardList, label: 'Nhật ký Quản trị' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="d-flex align-items-center gap-2 px-3 py-3" style={{ borderBottom: '1px solid #21262d' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1f6feb, #8250df)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>CapitalFlow</div>
            <div style={{ color: '#8b949e', fontSize: 11 }}>Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-fill px-2 py-3 d-flex flex-column gap-1 overflow-auto">
          {navItems.map((item, idx) =>
            item.section ? (
              <div key={idx} style={{ color: '#8b949e', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 12px 4px', marginTop: 4 }}>
                {item.section}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 d-flex flex-column gap-1" style={{ borderTop: '1px solid #21262d' }}>
          <button className="nav-link border-0 bg-transparent w-100 text-start">
            <HelpCircle size={16} strokeWidth={2} />
            Hỗ trợ
          </button>
          <button
            onClick={async () => {
              const refreshToken = sessionStorage.getItem('admin_refresh_token');
              if (refreshToken) {
                try { await api.post('/auth/logout', { refresh_token: refreshToken }); } catch {}
              }
              sessionStorage.removeItem('admin_access_token');
              sessionStorage.removeItem('admin_refresh_token');
              navigate('/');
            }}
            className="nav-link border-0 bg-transparent w-100 text-start"
            style={{ color: '#f85149' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff7b72'; e.currentTarget.style.background = 'rgba(248,81,73,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#f85149'; e.currentTarget.style.background = 'transparent'; }}>
            <LogOut size={16} strokeWidth={2} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-fill d-flex flex-column" style={{ minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header className="main-header">
          <div className="input-icon-wrap flex-fill" style={{ maxWidth: 400 }}>
            <Search size={14} className="icon" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="form-control form-control-sm"
              placeholder="Tìm kiếm tài khoản, giao dịch..."
              style={{ borderRadius: 8, fontSize: 13, background: '#f6f8fa' }} />
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <button className="btn btn-sm btn-light position-relative" style={{ borderRadius: 8, width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={17} />
              <span className="position-absolute top-0 end-0 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 8, padding: '2px 4px' }}>3</span>
            </button>
            <button className="btn btn-sm btn-light" style={{ borderRadius: 8, width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={17} />
            </button>
            <div className="vr" />
            <button className="btn btn-sm btn-light d-flex align-items-center gap-2" style={{ borderRadius: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1f6feb, #8250df)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>AD</div>
              <div className="text-start d-none d-md-block">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0d1117', lineHeight: 1.2 }}>Quản trị Hệ thống</div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>admin@cashflow.vn</div>
              </div>
              <ChevronDown size={13} style={{ color: '#8b949e' }} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-fill overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
