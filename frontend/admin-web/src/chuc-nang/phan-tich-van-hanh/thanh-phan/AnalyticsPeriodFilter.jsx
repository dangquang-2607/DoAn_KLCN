import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, periodOptions, shiftAnchor, units } from "../xu-ly/report-period";
import { dateLabel } from "../../../dung-chung/tien-ich/format";

export default function AnalyticsPeriodFilter({ unit, anchor, today, period, onUnit, onAnchor }) {
  const next = shiftAnchor(anchor, unit, 1);
  const options = periodOptions(today, unit, anchor);
  return <section className="sa-demo__filter" aria-label="Bộ lọc phân tích">
    <div className="sa-demo__filter-intro"><p className="sa-demo__section-label">PHẠM VI BÁO CÁO</p><h2>Chọn kỳ phân tích</h2><span>KPI, danh mục và cơ cấu cùng một phạm vi</span></div>
    <div className="sa-demo__filter-controls"><div className="sa-demo__granularity" role="group" aria-label="Đơn vị thời gian">{Object.entries(units).map(([key, label]) => <button key={key} type="button" aria-pressed={unit === key} onClick={() => onUnit(key)}>{label}</button>)}</div>
      <div className="sa-demo__period-select"><span>Kỳ đang xem</span><div className="cf-period-navigation"><button className="cf-icon-btn" type="button" aria-label="Kỳ trước" disabled={shiftAnchor(anchor, unit, -1) < "2000-01-01"} onClick={() => onAnchor(shiftAnchor(anchor, unit, -1))}><ChevronLeft size={18} /></button><select aria-label="Chọn kỳ phân tích" value={shiftAnchor(anchor, unit, 0) < "2000-01-01" ? "2000-01-01" : shiftAnchor(anchor, unit, 0)} onChange={(event) => onAnchor(event.target.value)}>{options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select><button className="cf-icon-btn" type="button" aria-label="Kỳ sau" disabled={next > today} onClick={() => onAnchor(next)}><ChevronRight size={18} /></button><details className="adm-live-date-picker"><summary aria-label="Chọn ngày tùy chỉnh" title="Chọn ngày tùy chỉnh"><CalendarDays size={18} /></summary><label>Ngày thuộc kỳ cần xem<input className="cf-input" aria-label="Ngày thuộc kỳ cần xem" type="date" min="2000-01-01" max={today} value={anchor} onChange={(event) => { if (event.target.value) onAnchor(event.target.value); }} /></label></details></div></div>
    </div>
    <div className="sa-demo__scope"><span className={period?.partial ? "is-partial" : "is-complete"}>{period ? period.partial ? "ĐANG DIỄN RA" : "ĐÃ KẾT THÚC" : "ĐANG TẢI"}</span><p>{period ? <><strong>{periodLabel(period)}</strong> · Dữ liệu đến {dateLabel(period.end)}</> : "Đang xác định phạm vi từ máy chủ…"}</p><button className="cf-btn cf-btn-sm" type="button" onClick={() => onAnchor(today)}>Kỳ hiện tại</button></div>
  </section>;
}
