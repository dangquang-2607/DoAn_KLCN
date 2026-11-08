import DateInput from "../../../dung-chung/UI-chung/DateInput";
import { periodLabel, periodOptions, shiftAnchor, units } from "../xu-ly/report-period";
import { dateLabel } from "../../../dung-chung/tien-ich/format";

/**
 * Thanh điều khiển chọn mốc thời gian phân tích vận hành hệ thống.
 */
export default function AnalyticsPeriodFilter({ unit, anchor, today, period, onUnit, onAnchor }) {
  const options = periodOptions(today, unit, anchor);
  return <section className="adm-analytics__filter" aria-label="Bộ lọc phân tích">
    <div className="adm-analytics__filter-intro"><p className="adm-analytics__section-label">PHẠM VI BÁO CÁO</p><h2>Chọn kỳ phân tích</h2><span>KPI, danh mục và cơ cấu cùng một phạm vi</span></div>
    <div className="adm-analytics__filter-controls"><div className="adm-analytics__granularity" role="group" aria-label="Đơn vị thời gian">{Object.entries(units).map(([key, label]) => <button key={key} type="button" aria-pressed={unit === key} onClick={() => onUnit(key)}>{label}</button>)}</div>
      <div className="adm-analytics__period-select">
        <span>Kỳ đang xem</span>
        <div className="cf-period-navigation">
          <select aria-label="Chọn kỳ phân tích" value={shiftAnchor(anchor, unit, 0) < "2000-01-01" ? "2000-01-01" : shiftAnchor(anchor, unit, 0)} onChange={(event) => onAnchor(event.target.value)}>
            {options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <DateInput
            aria-label="Ngày thuộc kỳ cần xem"
            min="2000-01-01"
            max={today}
            value={anchor}
            onChange={(value) => { if (value) onAnchor(value); }}
          />
        </div>
      </div>
    </div>
    <div className="adm-analytics__scope"><span className={period?.partial ? "is-partial" : "is-complete"}>{period ? period.partial ? "ĐANG DIỄN RA" : "ĐÃ KẾT THÚC" : "ĐANG TẢI"}</span><p>{period ? <><strong>{periodLabel(period)}</strong> · Dữ liệu đến {dateLabel(period.end)}</> : "Đang xác định phạm vi từ máy chủ…"}</p><button className="cf-btn cf-btn-sm" type="button" onClick={() => onAnchor(today)}>Kỳ hiện tại</button></div>
  </section>;
}
