/**
 * ============================================================================
 * TÊN FILE: DashboardLayout.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Khung giao diện quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối sidebar, header, hồ sơ admin, điều hướng và vùng Outlet của các route.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Router, React Query, Framer Motion, admin API và SecuritySettings.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất layout bảo vệ bao quanh tám route sau đăng nhập.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Logout luôn xóa token/cache; bắt buộc đổi mật khẩu được ưu tiên trước nội dung khác.
 * ============================================================================
 */
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
import api from "../connect-api/api";
import { Loading, ErrorState } from "../UI-chung/design";
import SecuritySettings from "../xac-thuc/SecuritySettings";
import { useMotionAllowed } from "../tien-ich/useMotionAllowed";

const groups = [
  {
    label: "Tổng quan",
    items: [
      { to: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard, tone: "blue", shortcut: "Ctrl+1" },
      {
        to: "/system-analytics",
        label: "Phân tích vận hành",
        icon: ChartNoAxesCombined,
        tone: "teal",
        shortcut: "Ctrl+2",
      },
    ],
  },
  {
    label: "Quản lý",
    items: [
      { to: "/users", label: "Người dùng", icon: Users, tone: "violet", shortcut: "Ctrl+3" },
      { to: "/categories", label: "Danh mục hệ thống", icon: Tags, tone: "amber", shortcut: "Ctrl+4" },
      { to: "/ocr-monitor", label: "Giám sát hóa đơn", icon: ScanLine, tone: "teal", shortcut: "Ctrl+5" },
    ],
  },
  {
    label: "Vận hành & bảo mật",
    items: [
      { to: "/audit-logs", label: "Nhật ký quản trị", icon: ClipboardList, tone: "coral", shortcut: "Ctrl+6" },
      { to: "/email-logs", label: "Email & cấu hình", icon: Mail, tone: "blue", shortcut: "Ctrl+7" },
      { to: "/settings", label: "Cài đặt & bảo mật", icon: Settings, tone: "violet", shortcut: "Ctrl+8" },
    ],
  },
];

export default function DashboardLayout() {
  const motionAllowed = useMotionAllowed();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("cf_admin_sidebar_collapsed") === "true",
  );
  const [tooltipData, setTooltipData] = useState(null);
  const [showKeyToast, setShowKeyToast] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();

  // Reset only when changing tabs; filtering the current page keeps its position.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cf_admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Ctrl/Cmd+B thu gọn sidebar; Escape đóng menu trên màn hình nhỏ.
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

      {/* Thông báo ngắn khi sử dụng phím tắt. */}
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

      {/* Sidebar có thể thu gọn và giữ lựa chọn trong localStorage. */}
      <aside className={`cf-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        {/* Nút điều khiển nằm trên đường biên sidebar. */}
        <button
          className="cf-rail-toggle-btn"
          onClick={toggleCollapsed}
          title={collapsed ? "Mở rộng menu (Ctrl + B)" : "Thu gọn menu (Ctrl + B)"}
          aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft size={14} />
          </motion.div>
        </button>

        {/* Nhận diện thương hiệu luôn hiển thị; khi thu gọn chỉ giữ logo ở giữa. */}
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

        {/* Danh sách điều hướng với chỉ báo chuyển động theo route hiện tại. */}
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
                      setTooltipData(null);
                    }}
                  >
                    <NavLink
                      to={i.to}
                      onClick={() => setOpen(false)}
                      className={`cf-nav-link cf-tone-${i.tone} ${isActive ? "active" : ""}`}
                    >
                      {/* Chỉ báo route đang được chọn. */}
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

                    {/* Tooltip cố định khi sidebar ở trạng thái thu gọn. */}
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
              {/* Tooltip nổi bên ngoài thanh điều hướng thu gọn. */}
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

      {/* Vùng làm việc chính thay đổi theo route con. */}
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

        {/* Nội dung chính có chuyển cảnh và tôn trọng reduced motion. */}
        <main id="main-content" className="cf-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: motionAllowed ? 0 : 1, y: motionAllowed ? 6 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: motionAllowed ? 0 : 1, y: motionAllowed ? -6 : 0 }}
              transition={{ duration: motionAllowed ? 0.18 : 0, ease: "easeOut" }}
              className="cf-route-scene"
            >
              {user.must_change_password ? (
                <div className="cf-stack">
                  <div className="cf-alert">
                    Đặt mật khẩu riêng trước khi bắt đầu sử dụng tài khoản.
                  </div>
                  <SecuritySettings firstTime />
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
