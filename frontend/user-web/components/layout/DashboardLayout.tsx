/**
 * ============================================================================
 * TÊN FILE: DashboardLayout.tsx
 * MÀN HÌNH / PHÂN HỆ: Khung không gian làm việc
 * NHÓM VỆ TINH: components/layout (Khung dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Bảo vệ phiên và cung cấp sidebar, header, hồ sơ cho không gian làm việc.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất DashboardLayout để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
"use client";
/**
 * Khung ứng dụng sau đăng nhập: bảo vệ phiên, điều hướng sidebar/header và
 * chứa các màn nghiệp vụ. Không đặt logic CRUD của từng tính năng tại đây.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  ScanLine,
  Tags,
  ChartNoAxesCombined,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  UserRound,
  Activity,
Command,
} from "lucide-react";
import api from "@/lib/api";
import { Loading, ErrorState } from "@/components/ui/ui";
import SecuritySettings from "@/app/(dashboard)/settings/_components/SecuritySettings";
import type { Profile } from "@/lib/finance";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  isAi?: boolean;
}

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Không gian tài chính",
    items: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboard, shortcut: "Ctrl+1" },
      { href: "/accounts", label: "Ví & tài khoản", icon: Wallet, shortcut: "Ctrl+2" },
      { href: "/transactions", label: "Giao dịch", icon: ArrowLeftRight, shortcut: "Ctrl+3" },
      { href: "/budgets", label: "Ngân sách", icon: PieChart, shortcut: "Ctrl+4" },
    ],
  },
  {
    label: "Phân tích & quản lý",
    items: [
      { href: "/ocr", label: "Hóa đơn AI", icon: ScanLine, isAi: true, shortcut: "Ctrl+5" },
      {
        href: "/analytics",
        label: "Báo cáo tài chính",
        icon: ChartNoAxesCombined,
        shortcut: "Ctrl+6",
      },
      { href: "/categories", label: "Danh mục", icon: Tags, shortcut: "Ctrl+7" },
    ],
  },
  {
    label: "Tài khoản",
    items: [
      { href: "/settings", label: "Cài đặt & bảo mật", icon: Settings, shortcut: "Ctrl+8" },
      { href: "/support", label: "Trung tâm hỗ trợ", icon: HelpCircle, shortcut: "Ctrl+9" },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "cf_sidebar_collapsed";
const SIDEBAR_CHANGE_EVENT = "capitalflow:sidebar-preference";

function subscribeSidebarPreference(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

function getSidebarPreference() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getServerSidebarPreference() {
  return false;
}

function toggleSidebarPreference() {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!getSidebarPreference()));
  window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const cache = useQueryClient();

  // Trạng thái ngăn điều hướng trên thiết bị di động.
  const [open, setOpen] = useState(false);

  // Snapshot phía server giữ hydration ổn định; tùy chọn trình duyệt được đọc
  // ngay sau khi React gắn vào HTML hiện có.
  const collapsed = useSyncExternalStore(
    subscribeSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference,
  );
  const [tooltipData, setTooltipData] = useState<{
    label: string;
    isAi?: boolean;
    shortcut?: string;
    top: number;
    left: number;
  } | null>(null);
  const [showKeyToast, setShowKeyToast] = useState(false);

  const toggleCollapsed = () => {
    toggleSidebarPreference();
  };

  // Phím tắt Ctrl+B / Cmd+B để thu gọn và Escape để đóng lớp giao diện.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
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

  const profile = useQuery<Profile>({
    queryKey: ["user-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
    retry: false,
  });

  useEffect(() => {
    if (!sessionStorage.getItem("user_access_token")) router.replace("/login");
  }, [router]);

  const logout = async () => {
    const token = sessionStorage.getItem("user_refresh_token");
    try {
      if (token) await api.post("/auth/logout", { refresh_token: token });
    } catch {
    } finally {
      sessionStorage.removeItem("user_access_token");
      sessionStorage.removeItem("user_refresh_token");
      cache.clear();
      router.replace("/login");
    }
  };

  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorState retry={() => profile.refetch()} />;
  const user = profile.data;
  const title =
    groups.flatMap((g) => g.items).find((i) => i.href === pathname)?.label ||
    "CapitalFlow";

  return (
    <div className="cf-app">
      <a href="#main-content" className="cf-skip">
        Chuyển đến nội dung
      </a>

      {/* Thông báo nổi khi người dùng dùng phím tắt. */}
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

      {/* Lớp nền mờ phía sau menu trên thiết bị di động. */}
      {open && (
        <button
          className="cf-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Thanh điều hướng có thể thu gọn. */}
      <aside className={`cf-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        {/* Nút thu gọn trên đường biên với biểu tượng xoay theo trạng thái. */}
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

        {/* Đầu trang thương hiệu luôn hiển thị; khi thu gọn 72px sẽ căn giữa logo. */}
        <Link
          href="/"
          aria-label="CapitalFlow tổng quan"
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

        {/* Thẻ nhận diện không gian làm việc hiện tại. */}
        <div className="cf-workspace">
          <span className="cf-icon" style={{ width: 32, height: 32, flexShrink: 0 }}>
            <Wallet size={16} />
          </span>
          <div>
            Tài chính cá nhân<small>Không gian của bạn</small>
          </div>
        </div>

        {/* Danh sách điều hướng với nền chỉ báo chuyển động mượt. */}
        <nav className="cf-nav" aria-label="Điều hướng chính">
          {groups.map((g) => (
            <div className="cf-nav-group" key={g.label}>
              <div className="cf-nav-label">{g.label}</div>
              {g.items.map((i) => {
                const isActive = pathname === i.href;
                const Icon = i.icon;

                return (
                  <div
                    key={i.href}
                    style={{ position: "relative" }}
                    onMouseEnter={(e) => {
                      if (collapsed) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipData({
                          label: i.label,
                          isAi: i.isAi,
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
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`cf-nav-link ${isActive ? "active" : ""}`}
                    >
                      {/* Nền chỉ báo mục điều hướng đang hoạt động. */}
                      {isActive && (
                        <motion.div
                          layoutId="cfNavActivePill"
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

                      {i.isAi && (
                        <span
                          className="cf-badge info"
                          style={{ marginLeft: "auto" }}
                        >
                          AI
                        </span>
                      )}
                    </Link>

                    {/* Tooltip dùng vị trí cố định để không bị sidebar cắt. */}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Chân thanh điều hướng. */}
        <div className="cf-nav-foot">
          <button className="cf-btn cf-btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut />
            <span>Đăng xuất</span>
          </button>
          <p>CapitalFlow · Personal workspace</p>
        </div>
              {/* Tooltip nổi khi thanh điều hướng đang thu gọn. */}
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
              {tooltipData.isAi && <span className="cf-badge info" style={{ padding: "1px 4px", fontSize: 9 }}>AI</span>}
              {tooltipData.shortcut && <kbd>{tooltipData.shortcut}</kbd>}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Khu vực nội dung chính thay đổi theo route. */}
      <div className={`cf-main ${collapsed ? "collapsed" : ""}`}>
        <header className="cf-header">
          {/* Nút mở menu trên thiết bị di động. */}
          <button
            className="cf-icon-btn cf-mobile-toggle"
            aria-label="Mở điều hướng"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>

          

          <div className="cf-crumb">
            <span>Không gian cá nhân</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>

          <div className="cf-spacer" />

          

          <Link href="/settings" className="cf-profile">
            <span className="cf-avatar">
              {(user.full_name || user.email).slice(0, 2).toUpperCase()}
            </span>
            <span>
              {user.full_name || user.email}
              <small>Tài khoản cá nhân</small>
            </span>
            <UserRound size={16} />
          </Link>
        </header>

        {/* Nội dung chính với chuyển cảnh mượt giữa các route. */}
        <main id="main-content" className="cf-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
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
                  <SecuritySettings firstTime />
                </div>
              ) : (
                children
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
