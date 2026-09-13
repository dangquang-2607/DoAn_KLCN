"use client";
import { useEffect, useState } from "react";
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
import { Brand, Loading, ErrorState } from "./ui";
import SecuritySettings from "./SecuritySettings";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const cache = useQueryClient();

  // Mobile drawer state
  const [open, setOpen] = useState(false);

  // Desktop collapsible state with localStorage persistence
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    label: string;
    isAi?: boolean;
    shortcut?: string;
    top: number;
    left: number;
  } | null>(null);
  const [showKeyToast, setShowKeyToast] = useState(false);

  // Read saved collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("cf_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cf_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B and Escape
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

      {/* Floating shortcut toast notification */}
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

      {/* Mobile backdrop scrim */}
      {open && (
        <button
          className="cf-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Modern Collapsible Sidebar */}
      <aside className={`cf-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        {/* Border rail knob toggle button with rotating chevron */}
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

        {/* Workspace preview card */}
        <div className="cf-workspace">
          <span className="cf-icon" style={{ width: 32, height: 32, flexShrink: 0 }}>
            <Wallet size={16} />
          </span>
          <div>
            Tài chính cá nhân<small>Không gian của bạn</small>
          </div>
        </div>

        {/* Navigation list with Fluid Sliding Pill Indicator */}
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
                      setHoveredHref(i.href);
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
                      setHoveredHref(null);
                      setTooltipData(null);
                    }}
                  >
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`cf-nav-link ${isActive ? "active" : ""}`}
                    >
                      {/* Fluid Sliding Pill Indicator */}
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

                    {/* Tooltip rendered fixed globally */}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="cf-nav-foot">
          <button className="cf-btn cf-btn-ghost" onClick={logout} title="Đăng xuất">
            <LogOut />
            <span>Đăng xuất</span>
          </button>
          <p>CapitalFlow · Personal workspace</p>
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
              {tooltipData.isAi && <span className="cf-badge info" style={{ padding: "1px 4px", fontSize: 9 }}>AI</span>}
              {tooltipData.shortcut && <kbd>{tooltipData.shortcut}</kbd>}
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Dynamic Main Workspace Content */}
      <div className={`cf-main ${collapsed ? "collapsed" : ""}`}>
        <header className="cf-header">
          {/* Mobile hamburger toggle */}
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

        {/* Main Content with Fluid View Transitions */}
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
                  <SecuritySettings
                    firstTime
                    onComplete={() => profile.refetch()}
                  />
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
