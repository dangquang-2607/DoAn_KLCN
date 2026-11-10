"use client";

import { useEffect, useRef } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Grid2X2,
  Infinity,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { localDate } from "@/dung-chung/tien-ich/finance";
import {
  REPORT_START_DATE,
  reportPickerOptions,
  reportPickerYear,
  resolveReportPeriod,
  type ReportMode,
} from "@/dung-chung/nghiep-vu/report";
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

type ListMode = "week" | "month" | "quarter" | "year";

function PeriodSelect({ mode, anchor, today, onAnchor }: {
  mode: ListMode; anchor: string; today: string; onAnchor: (value: string) => void;
}) {
  const year = reportPickerYear(mode, anchor);
  const latest = reportPickerYear(mode, today);
  const earliest = reportPickerYear(mode, REPORT_START_DATE);
  const start = resolveReportPeriod(mode, anchor, "", "", today).start;
  const options = mode === "year" ? [] : reportPickerOptions(mode, year, today);
  const label = { week: "tuần", month: "tháng", quarter: "quý", year: "năm" }[mode];
  function selectYear(nextYear: number) {
    if (mode === "year") return onAnchor(`${nextYear}-01-01`);
    const nextOptions = reportPickerOptions(mode, nextYear, today);
    const ordinal = options.find(option => option.start === start)?.ordinal;
    if (!nextOptions.length) return;
    const choice = nextOptions.find(option => ordinal !== undefined && option.ordinal <= ordinal);
    onAnchor((choice ?? nextOptions[nextOptions.length - 1]).start);
  }
  return <div className={styles.periodControls}>
    {mode !== "year" && <select aria-label={`Chọn ${label} báo cáo`} value={start}
      onChange={event => onAnchor(event.target.value)}>
      {options.map(option => <option key={option.start} value={option.start}>{option.label}</option>)}
    </select>}
    <select aria-label="Chọn năm báo cáo" value={year} onChange={event => selectYear(Number(event.target.value))}>
      {Array.from({ length: latest - earliest + 1 }, (_, i) => latest - i).map(value =>
        <option key={value} value={value}>{mode === "year" ? `Năm ${value}` : value}</option>)}
    </select>
  </div>;
}

/**
 * Thanh công cụ lọc và chuyển đổi kỳ báo cáo tài chính linh hoạt.
 */
export default function ReportPeriodFilter({
  mode,
  anchor,
  customStart,
  customEnd,
  onMode,
  onAnchor,
  onCustomStart,
  onCustomEnd,
}: {
  mode: ReportMode;
  anchor: string;
  customStart: string;
  customEnd: string;
  onMode: (mode: ReportMode) => void;
  onAnchor: (value: string) => void;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
}) {
  const today = localDate();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        menuRef.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const selected = modes.find((item) => item.value === mode) ?? modes[2];
  const Icon = selected.icon;
  const current = resolveReportPeriod(mode, anchor, "", "", today);
  const currentToday = resolveReportPeriod(mode, today, "", "", today);
  return (
    <div
      className={styles.filter}
      role="group"
      aria-label="Bộ lọc thời gian báo cáo"
    >
      <details className={styles.modeMenu} ref={menuRef}
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuRef.current?.open) {
            menuRef.current.open = false;
            menuRef.current.querySelector("summary")?.focus();
          }
        }}>
        <summary aria-label={`Phạm vi: ${selected.label}`}>
          <Icon size={16} strokeWidth={1.8} />
          <span>{selected.label}</span>
          <ChevronDown size={14} />
        </summary>
        <div
          className={styles.modeOptions}
          role="group"
          aria-label="Chọn phạm vi thời gian"
        >
          <span>XEM BÁO CÁO THEO</span>
          {modes.map((item) => {
            const OptionIcon = item.icon;
            return (
              <button
                type="button"
                key={item.value}
                className={mode === item.value ? styles.active : ""}
                aria-current={mode === item.value ? "true" : undefined}
                onClick={() => {
                  onMode(item.value);
                  menuRef.current?.removeAttribute("open");
                  menuRef.current?.querySelector("summary")?.focus();
                }}
              >
                <OptionIcon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </details>
      <span className={styles.filterDivider} aria-hidden="true" />
      {mode === "custom" ? (
        <div className={styles.dates}>
          <div>
            <label htmlFor="analytics-start">Từ</label>
            <DateInput id="analytics-start" value={customStart} min={REPORT_START_DATE} max={today} onChange={onCustomStart} />
          </div>
          <span aria-hidden="true">–</span>
          <div>
            <label htmlFor="analytics-end">Đến</label>
            <DateInput id="analytics-end" value={customEnd} min={customStart || REPORT_START_DATE} max={today} onChange={onCustomEnd} />
          </div>
        </div>
      ) : mode === "all" ? (
        <span className={styles.allLabel}>Toàn bộ giao dịch</span>
      ) : (
        <>
          {mode === "day" ? (
            <div className={styles.dayPicker}>
              <label className={styles.srOnly} htmlFor="analytics-day">Ngày báo cáo</label>
              <DateInput id="analytics-day" value={anchor} min={REPORT_START_DATE} max={today} onChange={onAnchor} />
            </div>
          ) : <PeriodSelect mode={mode} anchor={anchor} today={today} onAnchor={onAnchor} />}
          {current.start !== currentToday.start && (
            <button type="button" className={styles.reset} onClick={() => onAnchor(today)}>
              <RotateCcw size={15} aria-hidden="true" />{mode === "day" ? "Hôm nay" : `${selected.label} này`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
