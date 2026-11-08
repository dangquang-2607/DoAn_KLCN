import { localDate } from "@/dung-chung/tien-ich/finance";

export type ReportMode = "day" | "week" | "month" | "quarter" | "year" | "all" | "custom";
type ReportPeriod = { start: string; end: string; label: string; partial: boolean; valid: boolean };
export const REPORT_START_DATE = "2026-08-30";
export const SPENDING_REPORT_ID = "chi-tiet-khoan-chi";

const DAY = 86_400_000;
const pad = (value: number) => String(value).padStart(2, "0");
const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const short = (value: string) => { const date = parse(value); return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`; };

/**
 * Dịch chuyển ngày chỉ định thêm hoặc bớt một số ngày delta.
 */
function shiftReportDay(value: string, delta: number) { return iso(new Date(parse(value).getTime() + delta * DAY)); }

/**
 * Dịch chuyển mốc thời gian báo cáo theo chế độ xem (tuần, tháng, quý, năm).
 */
export function shiftReportPeriod(mode: ReportMode, anchor: string, delta: number) {
  if (mode === "day") return shiftReportDay(anchor, delta);
  if (mode === "week") return shiftReportDay(anchor, delta * 7);
  const date = parse(anchor);
  date.setUTCDate(1);
  if (mode === "month") date.setUTCMonth(date.getUTCMonth() + delta);
  if (mode === "quarter") date.setUTCMonth(Math.floor(date.getUTCMonth() / 3) * 3 + delta * 3);
  if (mode === "year") { date.setUTCMonth(0); date.setUTCFullYear(date.getUTCFullYear() + delta); }
  return iso(date);
}

export function resolveReportPeriod(mode: ReportMode, anchor: string, customStart: string, customEnd: string, today = localDate(), earliest = ""): ReportPeriod {
  if (mode === "all") return { start: "", end: today, label: "Toàn bộ lịch sử", partial: false, valid: true };
  if (mode === "day" && !anchor) return { start: "", end: "", label: "Chọn ngày báo cáo", partial: false, valid: false };
  if (mode === "custom") {
    const duration = customStart && customEnd ? (parse(customEnd).getTime() - parse(customStart).getTime()) / DAY : -1;
    const valid = duration >= 0 && duration <= 366 && customEnd <= today && customStart >= earliest;
    return { start: customStart, end: customEnd, label: valid ? `${short(customStart)} – ${short(customEnd)}` : "Khoảng ngày chưa hợp lệ", partial: false, valid };
  }
  const date = parse(anchor);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  let start = anchor, end = anchor, label = short(anchor);
  if (mode === "week") {
    start = shiftReportDay(anchor, -((date.getUTCDay() + 6) % 7));
    end = shiftReportDay(start, 6);
    label = `Tuần ${short(start)} – ${short(end)}`;
  }
  if (mode === "month") {
    start = `${year}-${pad(month + 1)}-01`;
    end = iso(new Date(Date.UTC(year, month + 1, 0, 12)));
    label = `Tháng ${month + 1}/${year}`;
  }
  if (mode === "quarter") {
    const quarter = Math.floor(month / 3);
    start = `${year}-${pad(quarter * 3 + 1)}-01`;
    end = iso(new Date(Date.UTC(year, quarter * 3 + 3, 0, 12)));
    label = `Quý ${quarter + 1}/${year}`;
  }
  if (mode === "year") { start = `${year}-01-01`; end = `${year}-12-31`; label = `Năm ${year}`; }
  const valid = start <= today && end >= earliest;
  const availableStart = start < earliest ? earliest : start;
  const availableEnd = end > today ? today : end;
  if (mode === "week" && earliest && availableStart !== start) {
    label = availableStart === availableEnd ? `Tuần · ${short(availableStart)}` : `Tuần ${short(availableStart)} – ${short(availableEnd)}`;
  }
  return { start: availableStart, end: availableEnd, label, partial: valid && end > today, valid };
}

// Open tabs may still render the previous filter while Next refreshes its modules.
export function compactReportLabel(mode: ReportMode, anchor: string, today = localDate()) {
  const period = resolveReportPeriod(mode, anchor, "", "", today);
  if (mode === "day" && anchor) {
    const label = short(anchor);
    if (anchor === today) return `Hôm nay · ${label.slice(0, 5)}`;
    if (anchor === shiftReportDay(today, -1)) return `Hôm qua · ${label.slice(0, 5)}`;
    return label;
  }
  if (mode === "week") return `${short(period.start).slice(0, 5)}–${short(shiftReportDay(period.start, 6))}`;
  return period.label;
}

/** A Monday–Sunday week belongs to the year containing its Thursday. */
export function reportPickerYear(mode: "week" | "month" | "quarter" | "year", anchor: string) {
  const value = mode === "week"
    ? shiftReportDay(resolveReportPeriod("week", anchor, "", "", anchor).start, 3)
    : anchor;
  return Number(value.slice(0, 4));
}

export function reportPickerOptions(mode: "week" | "month" | "quarter", year: number, today: string) {
  const options: { start: string; label: string; ordinal: number }[] = [];
  if (mode === "week") {
    // January 4 always belongs to the first ISO week.
    const firstWeek = (y: number) => resolveReportPeriod("week", `${y}-01-04`, "", "", today).start;
    const end = firstWeek(year + 1);
    for (let start = firstWeek(year), ordinal = 1; start < end && start <= today; start = shiftReportDay(start, 7), ordinal++) {
      const sunday = shiftReportDay(start, 6);
      if (sunday < REPORT_START_DATE) continue;
      const from = short(start < REPORT_START_DATE ? REPORT_START_DATE : start).slice(0, 5);
      const to = short(sunday > today ? today : sunday).slice(0, 5);
      options.push({ start, ordinal, label: from === to ? from : `${from} – ${to}` });
    }
  } else {
    const step = mode === "month" ? 1 : 3;
    for (let month = 1; month <= 12; month += step) {
      const start = `${year}-${pad(month)}-01`;
      if (start > today) break;
      if (shiftReportPeriod(mode, start, 1) <= REPORT_START_DATE) continue;
      const ordinal = (month - 1) / step + 1;
      options.push({ start, ordinal, label: mode === "month" ? `Tháng ${ordinal}` : `Quý ${ordinal}` });
    }
  }
  return options.reverse();
}

export type ReportTrendPoint = { date: string; income: number; expense: number; net: number; cumulative: number };

type ReportSummary = { income: number; expense: number; net: number };

/** Cùng hợp đồng dữ liệu; phạm vi tổng thể hoặc theo kỳ do query quyết định. */
export type FinancialReportData = {
  period: { start_date: string; end_date: string };
  summary: ReportSummary;
  previous_summary: ReportSummary;
  previous_period_available?: boolean;
  income_by_category?: Record<string, number>;
  expense_by_category: Record<string, number>;
  previous_expense_by_category: Record<string, number>;
  period_trend: ReportTrendPoint[];
};

export function reportDayCount({ start_date, end_date }: FinancialReportData["period"]) {
  return Math.max(1, (parse(end_date).getTime() - parse(start_date).getTime()) / DAY + 1);
}

export function spendingTrendBuckets(trend: ReportTrendPoint[], period: FinancialReportData["period"]) {
  return trend.map(({ date, expense }, index) => {
    const next = trend[index + 1];
    return {
      start: date < period.start_date ? period.start_date : date,
      end: next ? shiftReportDay(next.date, -1) : period.end_date,
      expense,
    };
  });
}
