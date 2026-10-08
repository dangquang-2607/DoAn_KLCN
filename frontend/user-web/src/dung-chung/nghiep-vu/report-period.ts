import { localDate } from "@/dung-chung/tien-ich/finance";

export type ReportMode = "day" | "week" | "month" | "quarter" | "year" | "all" | "custom";
export type ReportPeriod = { start: string; end: string; label: string; partial: boolean; valid: boolean };

const DAY = 86_400_000;
const pad = (value: number) => String(value).padStart(2, "0");
const parse = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const short = (value: string) => { const date = parse(value); return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`; };

export function shiftReportDay(value: string, delta: number) { return iso(new Date(parse(value).getTime() + delta * DAY)); }

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

export function resolveReportPeriod(mode: ReportMode, anchor: string, customStart: string, customEnd: string, today = localDate()): ReportPeriod {
  if (mode === "all") return { start: "", end: today, label: "Toàn bộ lịch sử", partial: false, valid: true };
  if (mode === "custom") {
    const duration = customStart && customEnd ? (parse(customEnd).getTime() - parse(customStart).getTime()) / DAY : -1;
    const valid = duration >= 0 && duration <= 366 && customEnd <= today;
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
  const valid = start <= today;
  return { start, end: end > today ? today : end, label, partial: valid && end > today, valid };
}

export function compactReportLabel(mode: ReportMode, anchor: string, today = localDate()) {
  const period = resolveReportPeriod(mode, anchor, "", "", today);
  if (mode === "day") {
    if (anchor === today) return `Hôm nay · ${short(anchor).slice(0, 5)}`;
    if (anchor === shiftReportDay(today, -1)) return `Hôm qua · ${short(anchor).slice(0, 5)}`;
    return short(anchor);
  }
  if (mode === "week") return `${short(period.start).slice(0, 5)}–${short(shiftReportDay(period.start, 6))}`;
  return period.label;
}
