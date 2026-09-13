"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  ScanLine,
  ChartNoAxesCombined,
  Tags,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  Command,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export type SidebarTheme = "cobalt" | "emerald" | "obsidian" | "titaniumLight";

export interface NavItemConfig {
  id: string;
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  count?: number;
}

export interface NavGroupConfig {
  label: string;
  items: NavItemConfig[];
}

export interface CollapsibleSidebarProps {
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  theme?: SidebarTheme;
  activeId?: string;
  onSelect?: (item: NavItemConfig) => void;
  springPreset?: "snappy" | "fluid" | "gentle";
  showKeyToast?: boolean;
}

export const defaultNavGroups: NavGroupConfig[] = [
  {
    label: "Không gian tài chính",
    items: [
      { id: "dashboard", href: "/", label: "Tổng quan", icon: LayoutDashboard, shortcut: "Ctrl+1" },
      { id: "accounts", href: "/accounts", label: "Ví và tài khoản", icon: Wallet, shortcut: "Ctrl+2", count: 4 },
      { id: "transactions", href: "/transactions", label: "Giao dịch", icon: ArrowLeftRight, shortcut: "Ctrl+3" },
      { id: "budgets", href: "/budgets", label: "Ngân sách", icon: PieChart, shortcut: "Ctrl+4" },
    ],
  },
  {
    label: "Phân tích và quản lý",
    items: [
      { id: "ocr", href: "/ocr", label: "Hóa đơn AI", icon: ScanLine, badge: "AI Smart", badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", shortcut: "Ctrl+5" },
      { id: "analytics", href: "/analytics", label: "Báo cáo tài chính", icon: ChartNoAxesCombined, shortcut: "Ctrl+6" },
      { id: "categories", href: "/categories", label: "Danh mục chi tiêu", icon: Tags, shortcut: "Ctrl+7" },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { id: "settings", href: "/settings", label: "Cài đặt và bảo mật", icon: Settings, shortcut: "Ctrl+8" },
      { id: "support", href: "/support", label: "Trung tâm hỗ trợ", icon: HelpCircle, shortcut: "Ctrl+9" },
    ],
  },
];

const themeStyles: Record<SidebarTheme, {
  aside: string;
  border: string;
  logoBg: string;
  logoGlow: string;
  brandText: string;
  brandAccent: string;
  toggleBtn: string;
  groupLabel: string;
  itemBase: string;
  itemActive: string;
  itemHover: string;
  activePill: string;
  tooltipBg: string;
  footerBg: string;
}> = {
  cobalt: {
    aside: "bg-[#080e1a]/95 backdrop-blur-2xl text-slate-100",
    border: "border-cyan-500/20",
    logoBg: "bg-gradient-to-tr from-cyan-500 to-blue-600",
    logoGlow: "shadow-[0_0_24px_rgba(6,182,212,0.4)]",
    brandText: "text-white",
    brandAccent: "text-cyan-400",
    toggleBtn: "bg-[#0c1626] border-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    groupLabel: "text-cyan-400/60",
    itemBase: "text-slate-400",
    itemActive: "text-cyan-300 font-medium bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/30",
    itemHover: "hover:text-slate-100 hover:bg-slate-800/60",
    activePill: "bg-cyan-400 shadow-[0_0_12px_#22d3ee]",
    tooltipBg: "bg-[#0c1626]/95 border-cyan-500/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.6)]",
    footerBg: "border-slate-800/70 hover:bg-slate-800/40",
  },
  emerald: {
    aside: "bg-[#051410]/95 backdrop-blur-2xl text-emerald-50",
    border: "border-emerald-500/20",
    logoBg: "bg-gradient-to-tr from-emerald-500 to-teal-600",
    logoGlow: "shadow-[0_0_24px_rgba(16,185,129,0.4)]",
    brandText: "text-white",
    brandAccent: "text-emerald-400",
    toggleBtn: "bg-[#09221b] border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    groupLabel: "text-emerald-400/60",
    itemBase: "text-slate-400",
    itemActive: "text-emerald-300 font-medium bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30",
    itemHover: "hover:text-slate-100 hover:bg-emerald-950/40",
    activePill: "bg-emerald-400 shadow-[0_0_12px_#34d399]",
    tooltipBg: "bg-[#09221b]/95 border-emerald-500/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.6)]",
    footerBg: "border-emerald-900/50 hover:bg-emerald-950/50",
  },
  obsidian: {
    aside: "bg-[#09090b]/98 backdrop-blur-2xl text-slate-100",
    border: "border-violet-500/20",
    logoBg: "bg-gradient-to-tr from-violet-600 to-indigo-600",
    logoGlow: "shadow-[0_0_24px_rgba(139,92,246,0.4)]",
    brandText: "text-white",
    brandAccent: "text-violet-400",
    toggleBtn: "bg-[#13111c] border-violet-500/40 text-violet-400 hover:bg-violet-600 hover:text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]",
    groupLabel: "text-violet-400/60",
    itemBase: "text-slate-400",
    itemActive: "text-violet-200 font-medium bg-gradient-to-r from-violet-600/25 to-indigo-600/10 border border-violet-500/40",
    itemHover: "hover:text-slate-100 hover:bg-white/5",
    activePill: "bg-violet-400 shadow-[0_0_12px_#a78bfa]",
    tooltipBg: "bg-[#13111c]/95 border-violet-500/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.7)]",
    footerBg: "border-zinc-800/80 hover:bg-zinc-800/50",
  },
  titaniumLight: {
    aside: "bg-white/95 backdrop-blur-2xl text-slate-800",
    border: "border-slate-200",
    logoBg: "bg-gradient-to-tr from-blue-600 to-cyan-500",
    logoGlow: "shadow-[0_4px_15px_rgba(37,99,235,0.25)]",
    brandText: "text-slate-900",
    brandAccent: "text-blue-600",
    toggleBtn: "bg-white border-slate-300 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-md",
    groupLabel: "text-slate-500",
    itemBase: "text-slate-600",
    itemActive: "text-blue-700 font-semibold bg-blue-50/80 border border-blue-200",
    itemHover: "hover:text-slate-900 hover:bg-slate-100/80",
    activePill: "bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]",
    tooltipBg: "bg-slate-900/95 border-slate-700 text-white shadow-xl",
    footerBg: "border-slate-200 hover:bg-slate-100/70",
  },
};

const springConfigs = {
  snappy: { type: "spring", stiffness: 320, damping: 26, mass: 0.7 },
  fluid: { type: "spring", stiffness: 220, damping: 24, mass: 0.8 },
  gentle: { type: "spring", stiffness: 150, damping: 22, mass: 1 },
};

export function CollapsibleSidebar({
  collapsed: controlledCollapsed,
  onToggle,
  theme = "cobalt",
  activeId = "dashboard",
  onSelect,
  springPreset = "fluid",
  showKeyToast = true,
}: CollapsibleSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipState, setTooltipState] = useState<{
    item: NavItemConfig;
    groupLabel: string;
    top: number;
    left: number;
  } | null>(null);
  const [keyToastVisible, setKeyToastVisible] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const currentTheme = themeStyles[theme];
  const springTransition = springConfigs[springPreset];

  const handleToggle = () => {
    const next = !isCollapsed;
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(next);
    }
    if (onToggle) onToggle(next);
  };

  // Keyboard shortcut Ctrl+B / Cmd+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggle();
        if (showKeyToast) {
          setKeyToastVisible(true);
          setTimeout(() => setKeyToastVisible(false), 1600);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, onToggle, showKeyToast]);

  return (
    <>
      {/* Toast phim tat Ctrl+B */}
      <AnimatePresence>
        {keyToastVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] px-4 py-2 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-300 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2.5 text-xs font-medium pointer-events-none"
          >
            <Command size={14} className="text-cyan-400 animate-pulse" />
            <span>Phim tat <kbd className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">Ctrl + B</kbd> kich hoat ({isCollapsed ? "Thu gon 72px" : "Mo rong 260px"})</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 260 }}
        transition={springTransition}
        className={`relative h-full select-none flex flex-col border-r ${currentTheme.aside} ${currentTheme.border} transition-colors duration-300 z-30`}
      >
        {/* Nut Knob Toggle o bien gioi */}
        <button
          onClick={handleToggle}
          title={isCollapsed ? "Mo rong menu (Ctrl + B)" : "Thu gon menu (Ctrl + B)"}
          aria-label="Thu gon thanh dieu huong"
          className={`absolute -right-3.5 top-6 w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 z-50 group ${currentTheme.toggleBtn}`}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <ChevronLeft size={15} />
          </motion.div>
        </button>

                {/* Brand Header - Luon hien logo mark (khi thu gon 72px bieu tuong logo can giua) */}
        <div className={`h-18 px-4 flex items-center border-b border-slate-800/40 overflow-hidden relative ${isCollapsed ? "justify-center px-0" : ""}`}>
          <div className={`w-9 h-9 rounded-xl ${currentTheme.logoBg} ${currentTheme.logoGlow} flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 ${isCollapsed ? "mx-auto" : ""}`}>
            <span className="font-black text-white text-base tracking-wider">C</span>
          </div>

          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.16 }}
                className="ml-3 flex-1 min-w-0 overflow-hidden"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold text-base tracking-tight ${currentTheme.brandText}`}>Capital</span>
                  <span className={`font-bold text-base ${currentTheme.brandAccent}`}>Flow</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 ml-auto">PRO</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Quản trị tài chính thông minh</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 px-2.5 py-2 space-y-4 overflow-y-auto overflow-x-hidden">
          {defaultNavGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="h-4 px-2.5 flex items-center">
                {!isCollapsed ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`text-[11px] font-semibold uppercase tracking-wider ${currentTheme.groupLabel}`}
                  >
                    {group.label}
                  </motion.span>
                ) : (
                  <div className="w-full h-px bg-slate-800/60 my-1" />
                )}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeId === item.id;
                const isHovered = hoveredId === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={(e) => {
                      setHoveredId(item.id);
                      if (isCollapsed) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipState({
                          item,
                          groupLabel: group.label,
                          top: rect.top + rect.height / 2,
                          left: rect.right + 12,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredId(null);
                      setTooltipState(null);
                    }}
                  >
                    <button
                      onClick={() => onSelect && onSelect(item)}
                      className={`w-full flex items-center h-10 px-2.5 rounded-xl transition-all duration-200 relative group cursor-pointer ${
                        isActive
                          ? currentTheme.itemActive
                          : `${currentTheme.itemBase} ${currentTheme.itemHover}`
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebarBar"
                          className={`absolute left-0 w-1 h-5 rounded-r-full ${currentTheme.activePill}`}
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}

                      <div className="w-6 h-6 flex items-center justify-center shrink-0 mx-auto md:mx-0">
                        <Icon
                          size={18}
                          className={`transition-colors ${
                            isActive ? currentTheme.brandAccent : "group-hover:text-slate-200"
                          }`}
                        />
                      </div>

                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.15 }}
                            className="ml-3 flex-1 flex items-center justify-between min-w-0 overflow-hidden"
                          >
                            <span className="text-xs font-medium truncate">{item.label}</span>

                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                              {item.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.badgeColor || "bg-slate-800 text-slate-300 border-slate-700"}`}>
                                  {item.badge}
                                </span>
                              )}
                              {item.count !== undefined && (
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                                  {item.count}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>

                    {/* Tooltip rendered fixed at root level to prevent overflow clipping */}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-2.5 border-t border-slate-800/50 overflow-hidden">
          <div className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${currentTheme.footerBg}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md">
              CF
            </div>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 min-w-0 overflow-hidden"
                >
                  <p className="text-xs font-semibold text-slate-200 truncate">Hoàng Long</p>
                  <p className="text-[10px] text-slate-400 truncate">long.finance@cf.vn</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!isCollapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert("Demo đăng xuất");
                }}
                title="Đăng xuất"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
            {/* Global Fixed Floating Glass Tooltip */}
      <AnimatePresence>
        {isCollapsed && tooltipState && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: tooltipState.top,
              left: tooltipState.left,
              transform: "translateY(-50%)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            <div className={`px-3 py-2 rounded-xl backdrop-blur-2xl border flex items-center gap-2.5 whitespace-nowrap ${currentTheme.tooltipBg}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${activeId === tooltipState.item.id ? currentTheme.activePill : "bg-slate-500"}`} />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white">{tooltipState.item.label}</p>
                  {tooltipState.item.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${tooltipState.item.badgeColor || "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"}`}>
                      {tooltipState.item.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>{tooltipState.groupLabel}</span>
                  {tooltipState.item.shortcut && (
                    <span className="font-mono px-1 py-0.2 rounded bg-white/10 text-slate-300 text-[9px]">
                      {tooltipState.item.shortcut}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.aside>
    </>
  );
}
