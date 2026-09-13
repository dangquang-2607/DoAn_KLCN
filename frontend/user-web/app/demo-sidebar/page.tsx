"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CollapsibleSidebar,
  type SidebarTheme,
  type NavItemConfig,
  defaultNavGroups,
} from "@/components/CollapsibleSidebar";
import {
  Command,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  Coffee,
  ShoppingBag,
  Laptop,
  CheckCircle,
  Clock,
  Zap,
  Maximize2,
  Minimize2,
  Keyboard,
  Info,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Monitor,
} from "lucide-react";

export default function DemoSidebarPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<SidebarTheme>("cobalt");
  const [springPreset, setSpringPreset] = useState<"snappy" | "fluid" | "gentle">("fluid");
  const [activeId, setActiveId] = useState("dashboard");
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);
  const [shortcutCount, setShortcutCount] = useState(0);

  // Read saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem("cf_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const handleToggle = (nextState: boolean) => {
    setCollapsed(nextState);
    localStorage.setItem("cf_sidebar_collapsed", String(nextState));
  };

  // Listen for keydown to highlight the interactive shortcut badge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        setLastKeyPressed("Ctrl + B");
        setShortcutCount((c) => c + 1);
        setTimeout(() => setLastKeyPressed(null), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mock data for the dynamic breathing layout
  const mockTransactions = [
    { id: "TX-9021", name: "Công ty Cổ phần VNG", category: "Lương & Thưởng", type: "income", date: "Hôm nay, 09:15", amount: "+45.000.000 đ", status: "Hoàn tất" },
    { id: "TX-9020", name: "Starbucks Reserve Coffee", category: "Ăn uống & Cà phê", type: "expense", date: "Hôm nay, 08:30", amount: "-145.000 đ", status: "Hoàn tất" },
    { id: "TX-9019", name: "Thanh toán Apple Services", category: "Dịch vụ số / AI", type: "expense", date: "Hôm qua, 21:00", amount: "-599.000 đ", status: "Hoàn tất" },
    { id: "TX-9018", name: "Chuyển tiền tiết kiệm kỳ hạn", category: "Tiết kiệm tích lũy", type: "transfer", date: "10/09/2026", amount: "-20.000.000 đ", status: "Đang xử lý" },
    { id: "TX-9017", name: "Shopee Tech Mall", category: "Mua sắm thiết bị", type: "expense", date: "09/09/2026", amount: "-2.450.000 đ", status: "Hoàn tất" },
  ];

  const currentItemTitle =
    defaultNavGroups.flatMap((g) => g.items).find((i) => i.id === activeId)?.label || "Tổng quan";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <CollapsibleSidebar
        collapsed={collapsed}
        onToggle={handleToggle}
        theme={theme}
        activeId={activeId}
        springPreset={springPreset}
        onSelect={(item) => setActiveId(item.id)}
      />

      {/* 2. DYNAMIC MAIN CONTENT (Expands smoothly when sidebar collapses) */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative custom-scrollbar">
        {/* Top Floating Control Bar */}
        <header className="sticky top-0 z-20 px-6 py-3.5 bg-[#090e1c]/80 backdrop-blur-xl border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Direct Toggle Button */}
            <button
              onClick={() => handleToggle(!collapsed)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-95"
            >
              {collapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              <span>{collapsed ? "Mở rộng (260px)" : "Thu gọn (72px)"}</span>
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span>Không gian tài chính</span>
              <ChevronRight size={13} />
              <span className="text-cyan-400 font-medium">{currentItemTitle}</span>
            </div>
          </div>

          {/* Controls: Theme & Spring Physics */}
          <div className="flex items-center gap-3">
            {/* Shortcut helper badge */}
            <div
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all ${
                lastKeyPressed
                  ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold scale-105 shadow-[0_0_15px_#06b6d4]"
                  : "bg-slate-900/80 border-slate-800 text-slate-400"
              }`}
            >
              <Keyboard size={13} className={lastKeyPressed ? "text-slate-950" : "text-cyan-400"} />
              <span>Ctrl + B</span>
              {shortcutCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-cyan-900/50 text-cyan-300 font-sans">
                  {shortcutCount}x
                </span>
              )}
            </div>

            {/* Theme Picker */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
              {(["cobalt", "emerald", "obsidian", "titaniumLight"] as SidebarTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2.5 py-1 rounded-lg transition-all capitalize text-[11px] font-medium cursor-pointer ${
                    theme === t
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "cobalt" && "Cobalt"}
                  {t === "emerald" && "Emerald"}
                  {t === "obsidian" && "Obsidian"}
                  {t === "titaniumLight" && "Light"}
                </button>
              ))}
            </div>

            {/* Physics Picker */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
              {(["snappy", "fluid", "gentle"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSpringPreset(p)}
                  className={`px-2 py-0.8 rounded-lg text-[10px] font-medium cursor-pointer ${
                    springPreset === p
                      ? "bg-slate-700 text-cyan-300 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <Link
              href="/demo-tabs"
              className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition ml-1"
            >
              <Layers size={13} />
              <span>Demo Tabs</span>
            </Link>
          </div>
        </header>

        {/* Main Canvas Area */}
        <main className="p-6 md:p-8 space-y-8 max-w-[1600px] w-full mx-auto">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-slate-900/60 border border-cyan-500/20 p-6 md:p-8 backdrop-blur-xl">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
                <Sparkles size={13} />
                <span>Interactive Micro-Interactions Showcase</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Collapsible Mini-Rail Sidebar
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                Thử nghiệm chuyển động đóng/mở mượt mà chuẩn 120 FPS. Hãy thử bấm nút tròn ở mép viền, 
                hoặc nhấn tổ hợp phím <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs">Ctrl + B</kbd>.
                Khi thanh menu thu gọn về 72px, hãy rê chuột qua các icon để cảm nhận <strong>Floating Glass Tooltip</strong>!
              </p>
            </div>
          </div>

          {/* Metric KPI Cards (Observe how they adaptively breathe with the sidebar width) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Tổng tài sản ròng</span>
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400"><TrendingUp size={16} /></span>
              </div>
              <p className="text-2xl font-bold text-white mt-2">248.520.000 ₫</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                <span>+12.4%</span>
                <span className="text-slate-500 font-normal">so với tháng trước</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Thu nhập tháng 09</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><TrendingUp size={16} /></span>
              </div>
              <p className="text-2xl font-bold text-white mt-2">68.200.000 ₫</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                <span>+8.2%</span>
                <span className="text-slate-500 font-normal">vượt chỉ tiêu</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-rose-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Chi tiêu đã duyệt</span>
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><TrendingDown size={16} /></span>
              </div>
              <p className="text-2xl font-bold text-white mt-2">23.450.000 ₫</p>
              <p className="text-xs text-cyan-400 flex items-center gap-1 mt-1 font-medium">
                <span>34.3%</span>
                <span className="text-slate-500 font-normal">ngân sách khả dụng</span>
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-violet-500/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Không gian giải phóng</span>
                <span className="p-2 rounded-xl bg-violet-500/10 text-violet-400"><Zap size={16} /></span>
              </div>
              <p className="text-2xl font-bold text-violet-300 mt-2">{collapsed ? "+188px Width" : "Chuẩn 260px"}</p>
              <p className="text-xs text-slate-400 mt-1">
                {collapsed ? "Tối ưu hóa tầm nhìn cho dữ liệu" : "Đầy đủ nhãn và phím tắt"}
              </p>
            </div>
          </div>

          {/* Mock Financial Data Table */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Giao dịch phát sinh gần nhất</h2>
                <p className="text-xs text-slate-400">Bảng dữ liệu mở rộng co giãn mượt mà theo trạng thái thanh menu</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Trạng thái Menu:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${collapsed ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-blue-500/20 text-blue-300 border border-blue-500/40"}`}>
                  {collapsed ? "Mini Rail (72px)" : "Full Sidebar (260px)"}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Mã GD</th>
                    <th className="py-3 px-4">Đối tác / Thụ hưởng</th>
                    <th className="py-3 px-4">Danh mục</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4 text-right">Số tiền</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {mockTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-400">{tx.id}</td>
                      <td className="py-3 px-4 font-medium text-white">{tx.name}</td>
                      <td className="py-3 px-4 text-slate-300">{tx.category}</td>
                      <td className="py-3 px-4 text-slate-400">{tx.date}</td>
                      <td className={`py-3 px-4 text-right font-semibold font-mono ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.amount}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <CheckCircle size={11} />
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4 Architectural Highlights of this Design */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Cpu size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white">Spring Physics 120 FPS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Độ nảy lò xo tự nhiên (`stiffness: 220, damping: 24`), co dãn mềm mại, không bao giờ bị giật chữ hay đứt gãy layout.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white">Floating Glass Tooltip</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Khi thu gọn còn 72px, hover vào bất kỳ icon nào sẽ kích hoạt viên thuốc thủy tinh bay ra bên phải kèm tên tính năng và phím tắt.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                <Keyboard size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white">Phím tắt Ctrl + B</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Thao tác đóng/mở nhanh chuẩn Notion/VS Code/Linear bằng bàn phím mà không cần rời tay khỏi vị trí nhập liệu.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Monitor size={18} />
              </div>
              <h3 className="text-sm font-semibold text-white">Lưu trạng thái LocalStorage</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tự động ghi nhớ tùy chọn mở rộng hay thu gọn của từng người dùng, F5 trang web không bị nhấp nháy giao diện.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
