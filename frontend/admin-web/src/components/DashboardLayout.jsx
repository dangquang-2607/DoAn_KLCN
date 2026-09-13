import { useState, useEffect } from "react";
import {
  Outlet,
  NavLink,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Tags,
  Settings,
  LogOut,
  ClipboardList,
  ChartNoAxesCombined,
  ScanLine,
  Mail,
  ShieldCheck,
  Activity,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
Command,
} from "lucide-react";
import api from "../services/api";
import { Brand, Loading, ErrorState } from "./design";
import SecuritySettings from "./SecuritySettings";

const groups = [
  {
    label: "Tổng quan",
    items: [
      { to: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard, shortcut: "Ctrl+1" },
      {
        to: "/system-analytics",
        label: "Phân tích vận hành",
        icon: ChartNoAxesCombined,
        shortcut: "Ctrl+2",
      },
    ],
  },
  {
    label: "Quản lý",
    items: [
      { to: "/users", label: "Người dùng", icon: Users, shortcut: "Ctrl+3" },
      { to: "/categories", label: "Danh mục hệ thống", icon: Tags, shortcut: "Ctrl+4" },
      { to: "/ocr-monitor", label: "Giám sát hóa đơn", icon: ScanLine, shortcut: "Ctrl+5" },
    ],
  },
  {
    label: "Vận hành & bảo mật",
    items: [
      { to: "/audit-logs", label: "Nhật ký quản trị", icon: ClipboardList, shortcut: "Ctrl+6" },
      { to: "/email-logs", label: "Email & cấu hình", icon: Mail, shortcut: "Ctrl+7" },
      { to: "/settings", label: "Cài đặt & bảo mật", icon: Settings, shortcut: "Ctrl+8" },
    ],
  },
];

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredTo, setHoveredTo] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const [showKeyToast, setShowKeyToast] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem("cf_admin_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cf_admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
        setShowKeyToast(true);
        setTimeout(() => setShowKeyToast(false), 1500);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const profile = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
    retry: false,
  });

  const logout = async () => {
    try {
      const token = sessionStorage.getItem("admin_refresh_token");
      if (token) await api.post("/auth/logout", { refresh_token: token });
    } catch {
    } finally {
      sessionStorage.removeItem("admin_access_token");
      sessionStorage.removeItem("admin_refresh_token");
      cache.clear();
      nav("/login", { replace: true });
    }
  };

  if (profile.isPending)
    return (
      <div className="cf-app cf-admin">
        <Loading />
      </div>
    );
  if (profile.isError)
    return (
      <div className="cf-app cf-admin">
        <ErrorState retry={() => profile.refetch()} />
      </div>
    );
  const user = profile.data;
  if (user.role?.toUpperCase() !== "ADMIN")
    return (
      <div className="cf-app cf-admin">
        <div className="cf-state">
          <h1>Không có quyền truy cập</h1>
          <p>Tài khoản này không có quyền quản trị hệ thống.</p>
          <button className="cf-btn" onClick={logout}>
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    );
  const title =
    groups.flatMap((g) => g.items).find((i) => i.to === location.pathname)
      ?.label || "Quản trị";

  return (
    <div className="cf-app cf-admin">
      <a href="#main-content" className="cf-skip">
        Chuyển đến nội dung
      </a>

      {/* Shortcut Toast */}
      <AnimatePresence>
        {showKeyToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="cf-shortcut-toast"
          >
            <Command size={14} />
            <span>
              Phím tắt <strong>Ctrl + B</strong> kích hoạt ({collapsed ? "Thu gọn 72px" : "Mở rộng 244px"})
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <button
          className="cf-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Modern Collapsible Sidebar */}
      <aside className={`cf-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        {/* Border rail knob toggle button */}
        <button
          className="cf-rail-toggle-btn"
          onClick={toggleCollapsed}
          title={collapsed ? "Mở rộng menu (Ctrl + B)" : "Thu gọn menu (Ctrl + B)"}
          aria-label="Thu gọn thanh điều hướng"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={14} />
          </motion.div>
        </button>

        {/* Brand header - Luôn hiển thị (khi thu gọn 72px sẽ căn giữa logo mark) */}
        <Link
          to="/dashboard"
          aria-label="CapitalFlow quản trị"
          className={`cf-brand ${collapsed ? "collapsed" : ""}`}
        >
          <span className="cf-brand-mark" title="CapitalFlow">
            <Activity size={20} aria-hidden="true" />
          </span>
          {!collapsed && (
            <span className="cf-brand-name">
              CapitalFlow<span style={{ color: "var(--cf-blue)" }}>.</span>
            </span>
          )}
        </Link>
        <div className="cf-workspace">
          <span className="cf-icon" style={{ width: 32, height: 32, flexShrink: 0 }}>
            <ShieldCheck size={16} />
          </span>
          <div>
            Không gian quản trị<small>Quản lý hệ thống</small>
          </div>
        </div>

        {/* Navigation list with Fluid Sliding Pill Indicator */}
        <nav className="cf-nav" aria-label="Điều hướng quản trị">
          {groups.map((g) => (
            <div className="cf-nav-group" key={g.label}>
              <div className="cf-nav-label">{g.label}</div>
              {g.items.map((i) => {
                const isActive = location.pathname === i.to;
                const Icon = i.icon;

                return (
                  <div
                    key={i.to}
                    style={{ position: "relative" }}
                    onMouseEnter={(e) => {
                      setHoveredTo(i.to);
                      if (collapsed) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipData({
                          label: i.label,
                          shortcut: i.shortcut,
                          top: rect.top + rect.height / 2,
                          left: rect.right + 12,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredTo(null);
                      setTooltipData(null);
                    }}
                  >
                    <NavLink
                      to={i.to}
                      onClick={() => setOpen(false)}
                      className={`cf-nav-link ${isActive ? "active" : ""}`}
                    >
                      {/* Fluid Sliding Pill Indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="cfAdminNavActivePill"
                          className="cf-nav-sliding-pill"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}

                      <Icon />
                      <span className="cf-nav-label-text">{i.label}</span>
                    </NavLink>

                    {/* Fixed tooltip */}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="cf-nav-foot">
          <button className="cf-btn cf-btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut />
            <span>Đăng xuất</span>
          </button>
          <p>CapitalFlow · Admin workspace</p>
        </div>
              {/* Fixed Floating Tooltip on collapsed rail */}
        <AnimatePresence>
          {collapsed && tooltipData && (
            <motion.div
              initial={{ opacity: 0, x: -6, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "fixed",
                top: tooltipData.top,
                left: tooltipData.left,
                transform: "translateY(-50%)",
                zIndex: 9999,
                pointerEvents: "none",
              }}
              className="cf-floating-tooltip"
            >
              <span>{tooltipData.label}</span>
              {tooltipData.shortcut && <kbd>{tooltipData.shortcut}</kbd>}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Dynamic Main Workspace Content */}
      <div className={`cf-main ${collapsed ? "collapsed" : ""}`}>
        <header className="cf-header">
          <button
            className="cf-icon-btn cf-mobile-toggle"
            aria-expanded={open}
            aria-label="Mở điều hướng"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>

          

          <div className="cf-crumb">
            <span>Quản trị</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <form
            className="cf-search"
            onSubmit={(e) => {
              e.preventDefault();
              nav("/users?search=" + encodeURIComponent(search.trim()));
            }}
          >
            <Search />
            <input
              className="cf-input"
              aria-label="Tìm người dùng"
              placeholder="Tìm người dùng…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <Link to="/settings" className="cf-profile">
            <span className="cf-avatar">
              {(user.full_name || user.email).slice(0, 2).toUpperCase()}
            </span>
            <span>
              {user.full_name || user.email}
              <small>Quản trị viên</small>
            </span>
          </Link>
        </header>

        {/* Main Content with Fluid View Transitions */}
        <main id="main-content" className="cf-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="cf-route-scene"
            >
              {user.must_change_password ? (
                <div className="cf-stack">
                  <div className="cf-alert">
                    Đặt mật khẩu riêng trước khi bắt đầu sử dụng tài khoản.
                  </div>
                  <SecuritySettings
                    firstTime
                    onComplete={() => profile.refetch()}
                  />
                </div>
              ) : (
                <Outlet />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
