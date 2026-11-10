export const units = { day: "Ngày", week: "Tuần", month: "Tháng" };

export function todayInVietnam() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftAnchor(anchor, unit, direction) {
  const date = new Date(`${anchor}T12:00:00Z`);
  if (unit === "month") { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + direction); }
  else if (unit === "week") { date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 7 * direction); }
  else date.setUTCDate(date.getUTCDate() + direction);
  return date.toISOString().slice(0, 10);
}

export function periodLabel(period, short = false) {
  const [year, month, day] = period.start.split("-");
  if (period.unit === "month") return short ? `T${Number(month)}/${year.slice(2)}` : `Tháng ${month}/${year}`;
  if (period.unit === "week") return short ? `${day}/${month}` : `Tuần ${day}/${month} – ${period.calendar_end.slice(8)}/${period.calendar_end.slice(5, 7)}/${period.calendar_end.slice(0, 4)}`;
  return short ? `${day}/${month}` : `Ngày ${day}/${month}/${year}`;
}

export function periodOptions(today, unit, anchor) {
  const selected = shiftAnchor(anchor, unit, 0);
  const starts = [selected, ...Array.from({ length: 12 }, (_, index) => shiftAnchor(today, unit, -index))];
  return [...new Set(starts)].filter((start) => (unit === "week" ? shiftAnchor(start, "day", 6) : start) >= "2000-01-01" && start <= today)
    .sort((a, b) => b.localeCompare(a))
    .map((start) => ({ value: start < "2000-01-01" ? "2000-01-01" : start, label: periodLabel({ unit, start, calendar_end: shiftAnchor(start, "day", 6) }) }));
}
