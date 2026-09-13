"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Repeat, 
  Sparkles, 
  Calendar, 
  FileText, 
  Receipt, 
  ListOrdered, 
  ShieldCheck, 
  TrendingUp, 
  Wallet, 
  PieChart, 
  ArrowRight
} from "lucide-react";
import { FluidTabs, FluidTabPanel, type TabItem } from "@/components/FluidTabs";

export default function DemoTabsPage() {
  // Demo 1 State: Transactions Filter
  const [txTab, setTxTab] = useState("all");
  const [txDirection, setTxDirection] = useState(1);

  // Demo 2 State: Timeframe Horizon
  const [timeframeTab, setTimeframeTab] = useState("month");
  const [timeDirection, setTimeDirection] = useState(1);

  // Demo 3 State: OCR Sections
  const [ocrTab, setOcrTab] = useState("general");
  const [ocrDirection, setOcrDirection] = useState(1);

  // Demo 4 State: Light Platinum
  const [platTab, setPlatTab] = useState("wallets");

  // Tabs Definitions
  const transactionTabs: TabItem[] = [
    { id: "all", label: "Tất cả", icon: <Layers className="w-4 h-4" />, badge: 142 },
    { id: "income", label: "Thu nhập", icon: <ArrowDownLeft className="w-4 h-4 text-emerald-400" />, badge: 38 },
    { id: "expense", label: "Chi tiêu", icon: <ArrowUpRight className="w-4 h-4 text-rose-400" />, badge: 95 },
    { id: "transfer", label: "Chuyển tiền", icon: <Repeat className="w-4 h-4 text-blue-400" />, badge: 9 },
  ];

  const timeframeTabs: TabItem[] = [
    { id: "today", label: "Hôm nay" },
    { id: "week", label: "Tuần này" },
    { id: "month", label: "Tháng 9/2026", badge: "Hiện tại" },
    { id: "quarter", label: "Quý 3" },
    { id: "year", label: "Năm 2026" },
  ];

  const ocrTabs: TabItem[] = [
    { id: "general", label: "Thông tin chung", icon: <Receipt className="w-4 h-4 text-indigo-400" /> },
    { id: "items", label: "Danh sách mặt hàng", icon: <ListOrdered className="w-4 h-4 text-cyan-400" />, badge: 8 },
    { id: "tax", label: "Thuế & Phân bổ", icon: <PieChart className="w-4 h-4 text-amber-400" /> },
  ];

  const platinumTabs: TabItem[] = [
    { id: "wallets", label: "Ví tài chính", icon: <Wallet className="w-4 h-4" /> },
    { id: "budgets", label: "Hạn mức ngân sách", icon: <TrendingUp className="w-4 h-4" />, badge: "3 cảnh báo" },
    { id: "security", label: "Bảo mật & Phiên", icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  // Helper to calculate direction
  const handleTxChange = (newId: string) => {
    const oldIdx = transactionTabs.findIndex((t) => t.id === txTab);
    const newIdx = transactionTabs.findIndex((t) => t.id === newId);
    setTxDirection(newIdx > oldIdx ? 1 : -1);
    setTxTab(newId);
  };

  const handleTimeChange = (newId: string) => {
    const oldIdx = timeframeTabs.findIndex((t) => t.id === timeframeTab);
    const newIdx = timeframeTabs.findIndex((t) => t.id === newId);
    setTimeDirection(newIdx > oldIdx ? 1 : -1);
    setTimeframeTab(newId);
  };

  const handleOcrChange = (newId: string) => {
    const oldIdx = ocrTabs.findIndex((t) => t.id === ocrTab);
    const newIdx = ocrTabs.findIndex((t) => t.id === newId);
    setOcrDirection(newIdx > oldIdx ? 1 : -1);
    setOcrTab(newId);
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Aurora Ambient Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[500px] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[400px] rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute bottom-[10%] left-[30%] w-[700px] h-[450px] rounded-full bg-emerald-600/10 blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-slate-800/80">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Tương Tác Đột Phá — Micro-Motion System
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              Viên Thuốc Trượt Chất Lỏng
            </h1>
            <p className="mt-2 text-base md:text-lg text-slate-400 max-w-2xl">
              Hiệu ứng <span className="text-indigo-400 font-semibold">Fluid Sliding Pill Indicator</span> kết hợp cùng vật lý lò xo (Spring Physics) và chuyển cảnh đa chiều (Directional View Transitions).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
            >
              Về Trang chủ
            </Link>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* DEMO 1: Cobalt Royal Theme - Transaction Filter */}
        {/* ───────────────────────────────────────────────────────────── */}
        <section className="my-14 p-8 rounded-3xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-semibold">Demo Showcase 01</span>
              <h2 className="text-xl font-bold text-white mt-0.5">Bộ Lọc Giao Dịch (Cobalt Royal Glow)</h2>
              <p className="text-sm text-slate-400">Trượt êm dãn nở theo quán tính, đổ bóng phát quang và icon micro-bounce khi chọn.</p>
            </div>
            {/* The Fluid Tabs Component */}
            <FluidTabs
              tabs={transactionTabs}
              activeTab={txTab}
              onChange={handleTxChange}
              variant="cobalt"
              size="md"
              layoutId="tx-filter-pill"
            />
          </div>

          {/* Interactive Tab Panel Content */}
          <div className="mt-6 p-6 rounded-2xl bg-slate-950/60 border border-slate-800/50 min-h-[200px] flex items-center justify-center">
            <FluidTabPanel tabKey={txTab} direction={txDirection} className="w-full">
              {txTab === "all" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <ArrowDownLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Lương Công Ty Cổ Phần FPT</p>
                        <p className="text-xs text-slate-400">Hôm nay, 08:30 • Techcombank</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-400 text-lg">+35.000.000 đ</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Ăn uống Haidilao Hotpot</p>
                        <p className="text-xs text-slate-400">Hôm qua, 19:45 • Thẻ Visa</p>
                      </div>
                    </div>
                    <span className="font-bold text-rose-400 text-lg">-1.850.000 đ</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Repeat className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Chuyển sang Quỹ Tiết Kiệm</p>
                        <p className="text-xs text-slate-400">08/09/2026 • Chuyển nội bộ</p>
                      </div>
                    </div>
                    <span className="font-bold text-blue-400 text-lg">10.000.000 đ</span>
                  </div>
                </div>
              )}

              {txTab === "income" && (
                <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                    <ArrowDownLeft className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-300">Tổng Thu Nhập Tháng Này: 45.200.000 đ</h3>
                  <p className="text-sm text-slate-400 mt-1">Đã phân loại 38 giao dịch thu nhập hợp lệ.</p>
                </div>
              )}

              {txTab === "expense" && (
                <div className="p-6 rounded-xl bg-rose-950/20 border border-rose-900/40 text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-3">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-rose-300">Tổng Chi Tiêu Tháng Này: 18.450.000 đ</h3>
                  <p className="text-sm text-slate-400 mt-1">Đang nằm trong ngưỡng an toàn (62% ngân sách tháng).</p>
                </div>
              )}

              {txTab === "transfer" && (
                <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-900/40 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-3">
                    <Repeat className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-blue-300">Đã Chuyển Tiền 9 Lần Giữa Các Ví</h3>
                  <p className="text-sm text-slate-400 mt-1">Tất cả giao dịch chuyển tiền nguyên tử (ACID) đã hoàn tất an toàn.</p>
                </div>
              )}
            </FluidTabPanel>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* DEMO 2: Emerald Mint Wealth Theme - Timeframe Selector */}
        {/* ───────────────────────────────────────────────────────────── */}
        <section className="my-14 p-8 rounded-3xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">Demo Showcase 02</span>
              <h2 className="text-xl font-bold text-white mt-0.5">Khoảng Thời Gian Dòng Tiền (Emerald Mint Wealth)</h2>
              <p className="text-sm text-slate-400">Tone ngọc bích phát quang tượng trưng cho sự thịnh vượng tài chính.</p>
            </div>
            <FluidTabs
              tabs={timeframeTabs}
              activeTab={timeframeTab}
              onChange={handleTimeChange}
              variant="emerald"
              size="sm"
              layoutId="timeframe-pill"
            />
          </div>

          <div className="mt-4 p-6 rounded-2xl bg-emerald-950/30 border border-emerald-900/30">
            <FluidTabPanel tabKey={timeframeTab} direction={timeDirection}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">Kỳ báo cáo đang chọn</p>
                  <p className="text-2xl font-black text-white mt-1">
                    {timeframeTab === "today" && "Hôm nay (12/09/2026)"}
                    {timeframeTab === "week" && "Tuần này (07/09 - 13/09)"}
                    {timeframeTab === "month" && "Tháng 09/2026 (Toàn tháng)"}
                    {timeframeTab === "quarter" && "Quý 3/2026 (Tháng 7, 8, 9)"}
                    {timeframeTab === "year" && "Năm Tài Chính 2026"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-sm">
                    Tài sản ròng: <strong>+182.400.000 đ</strong>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 font-mono text-sm">
                    Tỷ lệ tiết kiệm: <strong>59.2%</strong>
                  </div>
                </div>
              </div>
            </FluidTabPanel>
          </div>
        </section>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* DEMO 3 & 4 Grid: Glass Dark & Platinum Minimal */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-14">
          {/* Demo 3: Glass Dark (OCR Tabs) */}
          <div className="p-7 rounded-3xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-xl">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">Demo Showcase 03</span>
            <h3 className="text-lg font-bold text-white mt-1 mb-4">Glass Dark Không Gian 3D (Hóa đơn AI)</h3>
            <FluidTabs
              tabs={ocrTabs}
              activeTab={ocrTab}
              onChange={handleOcrChange}
              variant="glassDark"
              size="md"
              layoutId="ocr-pill"
              className="w-full justify-between"
            />
            <div className="mt-5 p-5 rounded-2xl bg-black/40 border border-white/5 min-h-[120px] flex items-center justify-center text-sm text-slate-400">
              <FluidTabPanel tabKey={ocrTab} direction={ocrDirection}>
                {ocrTab === "general" && "Đã nhận diện: MST 0101248141 • Công ty FPT Software • Số HĐ 001248"}
                {ocrTab === "items" && "8 mặt hàng được trích xuất: Màn hình Dell UltraSharp, Bàn phím cơ..."}
                {ocrTab === "tax" && "Thuế suất GTGT 8%: 1.480.000 đ • Phân bổ vào chi phí Thiết bị văn phòng"}
              </FluidTabPanel>
            </div>
          </div>

          {/* Demo 4: Platinum Minimal */}
          <div className="p-7 rounded-3xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-xl">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-semibold">Demo Showcase 04</span>
            <h3 className="text-lg font-bold text-white mt-1 mb-4">Bạch Kim Hạng Sang (Monochrome Platinum)</h3>
            <FluidTabs
              tabs={platinumTabs}
              activeTab={platTab}
              onChange={setPlatTab}
              variant="platinum"
              size="md"
              layoutId="plat-pill"
              className="w-full justify-between"
            />
            <div className="mt-5 p-5 rounded-2xl bg-slate-800/30 border border-slate-700/40 min-h-[120px] flex items-center justify-center text-sm text-slate-300">
              {platTab === "wallets" && "Quản lý 4 ví hoạt động: Techcombank, Tiền mặt, MoMo, Quỹ VCB"}
              {platTab === "budgets" && "Ngân sách tháng 9: 25.000.000 đ • Đã tiêu: 16.200.000 đ (64.8%)"}
              {platTab === "security" && "Xác thực 2 lớp qua Email OTP • 2 phiên đăng nhập từ Chrome & Safari"}
            </div>
          </div>
        </div>

        {/* Footer Technical Note */}
        <div className="text-center pt-8 pb-16 text-xs text-slate-500 border-t border-slate-800/60">
          Thiết kế bằng <strong>Framer Motion 13 (layoutId Spring Physics)</strong> + <strong>TailwindCSS Glassmorphism</strong> cho CapitalFlow System.
        </div>
      </div>
    </div>
  );
}
