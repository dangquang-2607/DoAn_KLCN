"use client";
/**
 * Khung ứng dụng sau đăng nhập: bảo vệ phiên, điều hướng sidebar/header và
 * chứa các màn nghiệp vụ. Không đặt logic CRUD của từng tính năng tại đây.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import api, {
  clearSession,
  restoreSession,
} from "@/dung-chung/connect-api/api";
import { Loading, ErrorState } from "@/dung-chung/UI-chung/ui";
import SecuritySettings from "@/dung-chung/xac-thuc/SecuritySettings";
import type { Profile } from "@/dung-chung/nghiep-vu/finance";
import NotificationCenter from "../thong-bao/NotificationCenter";
import InvoiceUploadQueue from "@/chuc-nang/hoa-don-ai/xu-ly/InvoiceUploadQueue";
import styles from "./DashboardLayout.module.css";

const settingsLinks = [
  { href: "/settings", label: "Tài khoản & bảo mật", icon: ShieldCheck },
  { href: "/settings/subscription", label: "Gói sử dụng", icon: CreditCard },
];
const settingsPageFor = (pathname: string) =>
  [...settingsLinks]
    .reverse()
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );

function SettingsNavigation({
  pathname,
  collapsed,
  onExpand,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onExpand: () => void;
  onNavigate: () => void;
}) {
  const id = useId();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  const [expanded, setExpanded] = useState(active);
  return (
    <>
      <button
        type="button"
        className={`cf-nav-link ${styles.settingsToggle}`}
        aria-label="Cài đặt & bảo mật"
        data-active={active}
        data-collapsed={collapsed}
        aria-expanded={expanded && !collapsed}
        aria-controls={id}
        onClick={() => {
          if (collapsed) {
            onExpand();
            setExpanded(true);
          } else setExpanded((value) => !value);
        }}
      >
        <Settings aria-hidden="true" />
        <span className="cf-nav-label-text">Cài đặt & bảo mật</span>
        <ChevronRight
          className={styles.toggleChevron}
          data-open={expanded}
          aria-hidden="true"
        />
      </button>
      <div id={id} className={styles.submenu} hidden={!expanded || collapsed}>
        {settingsLinks.map((item) => {
          const selected = settingsPageFor(pathname)?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              className={styles.childLink}
            >
              {selected && (
                <motion.div
                  layoutId="cfNavActivePill"
                  className="cf-nav-sliding-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

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
      {
        href: "/",
        label: "Tổng quan",
        icon: LayoutDashboard,
        shortcut: "Ctrl+1",
      },
      {
        href: "/accounts",
        label: "Ví của tôi",
        icon: Wallet,
        shortcut: "Ctrl+2",
      },
      {
        href: "/transactions",
        label: "Lịch sử giao dịch",
        icon: ArrowLeftRight,
        shortcut: "Ctrl+3",
      },
      {
        href: "/budgets",
        label: "Ngân sách",
        icon: PieChart,
        shortcut: "Ctrl+4",
      },
    ],
  },
  {
    label: "Phân tích & quản lý",
    items: [
      {
        href: "/ocr",
        label: "Quét hóa đơn",
        icon: ScanLine,
        isAi: true,
        shortcut: "Ctrl+5",
      },
      {
        href: "/analytics",
        label: "Báo cáo tài chính",
        icon: ChartNoAxesCombined,
        shortcut: "Ctrl+6",
      },
      {
        href: "/categories",
        label: "Danh mục",
        icon: Tags,
        shortcut: "Ctrl+7",
      },
    ],
  },
  {
    label: "Tài khoản",
    items: [
      {
        href: "/settings",
        label: "Cài đặt & bảo mật",
        icon: Settings,
        shortcut: "Ctrl+8",
      },
      {
        href: "/support",
        label: "Trung tâm hỗ trợ",
        icon: HelpCircle,
        shortcut: "Ctrl+9",
      },
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
  const collapsedPreference = useSyncExternalStore(
    subscribeSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference,
  );
  const collapsed = collapsedPreference && !open;
  const [tooltipData, setTooltipData] = useState<{
    label: string;
    isAi?: boolean;
    shortcut?: string;
    top: number;
    left: number;
  } | null>(null);
  const [showKeyToast, setShowKeyToast] = useState(false);
  const keyToastTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        if (keyToastTimerRef.current) clearTimeout(keyToastTimerRef.current);
        keyToastTimerRef.current = setTimeout(
          () => setShowKeyToast(false),
          1500,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (keyToastTimerRef.current) clearTimeout(keyToastTimerRef.current);
    };
  }, []);

  const profile = useQuery<Profile>({
    queryKey: ["user-me"],
    queryFn: async () => (await api.get("/auth/me", { timeout: 15000 })).data,
    retry: false,
  });

  useEffect(() => {
    if (!restoreSession()) router.replace("/login");
  }, [router]);

  const logout = async () => {
    const token = sessionStorage.getItem("user_refresh_token");
    clearSession();
    await cache.cancelQueries();
    cache.clear();
    router.replace("/login");
    try {
      if (token) await api.post("/auth/logout", { refresh_token: token });
    } catch {
      // Local session is already closed, even when the network is unavailable.
    }
  };

  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorState retry={() => profile.refetch()} />;
  const user = profile.data;
  const checkoutPage = pathname === "/settings/subscription/checkout";
  const title =
    (checkoutPage ? "Thanh toán Premium" : settingsPageFor(pathname)?.label) ||
    groups.flatMap((g) => g.items).find((i) => i.href === pathname)?.label ||
    "CapitalFlow";

  return (
    <InvoiceUploadQueue key={user.id} owner={user.id} enabled={!user.must_change_password}>
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
              Phím tắt <strong>Ctrl + B</strong> kích hoạt (
              {collapsed ? "Thu gọn 72px" : "Mở rộng 244px"})
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
      <aside
        className={`cf-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      >
        {/* Nút thu gọn trên đường biên với biểu tượng xoay theo trạng thái. */}
        <button
          className="cf-rail-toggle-btn"
          onClick={toggleCollapsed}
          title={
            collapsed ? "Mở rộng menu (Ctrl + B)" : "Thu gọn menu (Ctrl + B)"
          }
          aria-label="Thu gọn thanh điều hướng"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
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
                    {i.href === "/settings" ? (
                      <SettingsNavigation
                        key={pathname}
                        pathname={pathname}
                        collapsed={collapsed}
                        onExpand={toggleCollapsed}
                        onNavigate={() => setOpen(false)}
                      />
                    ) : (
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
                    )}

                    {/* Tooltip dùng vị trí cố định để không bị sidebar cắt. */}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Chân thanh điều hướng. */}
        <div className="cf-nav-foot">
          <button
            className="cf-btn cf-btn-ghost"
            onClick={logout}
            title="Đăng xuất"
          >
            <LogOut />
            <span>Đăng xuất</span>
          </button>
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
              {tooltipData.isAi && (
                <span
                  className="cf-badge info"
                  style={{ padding: "1px 4px", fontSize: 9 }}
                >
                  AI
                </span>
              )}
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
            {settingsPageFor(pathname) && (
              <span className={styles.parentCrumb}>
                <Link href="/settings">Cài đặt & bảo mật</Link>
                <ChevronRight size={14} aria-hidden="true" />
                {checkoutPage && (
                  <>
                    <Link href="/settings/subscription">Gói sử dụng</Link>
                    <ChevronRight size={14} aria-hidden="true" />
                  </>
                )}
              </span>
            )}
            <strong>{title}</strong>
          </div>

          <div className="cf-spacer" />

          <NotificationCenter userId={user.id} />

          <Link href="/settings" className="cf-profile">
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
    </InvoiceUploadQueue>
  );
}
