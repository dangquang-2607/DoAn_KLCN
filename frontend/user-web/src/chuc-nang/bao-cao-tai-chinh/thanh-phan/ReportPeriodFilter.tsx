"use client";

import { useEffect, useRef } from "react";
import { Calendar, CalendarClock, CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Grid2X2, Infinity, RotateCcw, SlidersHorizontal } from "lucide-react";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { localDate } from "@/dung-chung/tien-ich/finance";
import { compactReportLabel, resolveReportPeriod, shiftReportPeriod, type ReportMode } from "@/dung-chung/nghiep-vu/report-period";
import styles from "../CSS/analytics.module.css";

const modes = [
  { value: "day", label: "Ngày", icon: CalendarDays },
  { value: "week", label: "Tuần", icon: CalendarRange },
  { value: "month", label: "Tháng", icon: Calendar },
  { value: "quarter", label: "Quý", icon: Grid2X2 },
  { value: "year", label: "Năm", icon: CalendarClock },
  { value: "all", label: "Tất cả", icon: Infinity },
  { value: "custom", label: "Tùy chỉnh", icon: SlidersHorizontal },
] as const;

export default function ReportPeriodFilter({ mode, anchor, customStart, customEnd, onMode, onAnchor, onCustomStart, onCustomEnd }: {
  mode: ReportMode; anchor: string; customStart: string; customEnd: string;
  onMode: (mode: ReportMode) => void; onAnchor: (value: string) => void;
  onCustomStart: (value: string) => void; onCustomEnd: (value: string) => void;
}) {
  const today = localDate();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const selected = modes.find((item) => item.value === mode) ?? modes[2];
  const Icon = selected.icon;
  const previous = shiftReportPeriod(mode, anchor, -1);
  const next = shiftReportPeriod(mode, anchor, 1);
  const current = resolveReportPeriod(mode, anchor, "", "", today);
  const currentToday = resolveReportPeriod(mode, today, "", "", today);
  return <div className={styles.filter} role="group" aria-label="Bộ lọc thời gian báo cáo">
    <details className={styles.modeMenu} ref={menuRef}>
      <summary aria-label={`Phạm vi: ${selected.label}`}><Icon size={16} strokeWidth={1.8} /><span>{selected.label}</span><ChevronDown size={14} /></summary>
      <div className={styles.modeOptions} role="group" aria-label="Chọn phạm vi thời gian">
        <span>XEM BÁO CÁO THEO</span>
        {modes.map((item) => { const OptionIcon = item.icon; return <button type="button" key={item.value} className={mode === item.value ? styles.active : ""} aria-current={mode === item.value ? "true" : undefined} onClick={() => { onMode(item.value); menuRef.current?.removeAttribute("open"); }}><OptionIcon size={16} />{item.label}</button>; })}
      </div>
    </details>
    <span className={styles.filterDivider} aria-hidden="true" />
    {mode === "custom" ? <div className={styles.dates}>
      <div><label htmlFor="analytics-start">Từ</label><DateInput id="analytics-start" value={customStart} max={today} onChange={onCustomStart} /></div>
      <span aria-hidden="true">–</span>
      <div><label htmlFor="analytics-end">Đến</label><DateInput id="analytics-end" value={customEnd} min={customStart || undefined} max={today} onChange={onCustomEnd} /></div>
    </div> : mode === "all" ? <span className={styles.allLabel}>Toàn bộ giao dịch</span> : <>
      <div className={styles.periodPicker}>
        <button type="button" aria-label="Kỳ trước" onClick={() => onAnchor(previous)}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{compactReportLabel(mode, anchor, today)}</span>
        <button type="button" aria-label="Kỳ tiếp theo" disabled={!resolveReportPeriod(mode, next, "", "", today).valid} onClick={() => onAnchor(next)}><ChevronRight size={18} /></button>
      </div>
      {current.start !== currentToday.start && <button type="button" className={styles.reset} title="Về kỳ hiện tại" aria-label="Về kỳ hiện tại" onClick={() => onAnchor(today)}><RotateCcw size={15} /></button>}
    </>}
  </div>;
}
