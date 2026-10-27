/**
 * ============================================================================
 * TÊN FILE: AnalyticsVolumeChart.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích & Vận hành hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Biểu đồ cột/đường trực quan hóa khối lượng giao dịch và số lượng người dùng
 *   mới theo từng ngày/tuần/tháng trong kỳ báo cáo đã chọn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props data, thư viện Recharts (ResponsiveContainer, BarChart, LineChart).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export AnalyticsVolumeChart component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tối ưu hiển thị số lượng lớn điểm dữ liệu mà không gây giật lag giao diện.
 * ============================================================================
 */
import { useState, useMemo } from "react";
import { useMotionAllowed } from "../../../dung-chung/tien-ich/useMotionAllowed";
import { number, decimal } from "../../../dung-chung/tien-ich/adminPresentation";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./analytics-volume-chart.css";

const ranges = [{ value: 3, label: "3 kỳ" }, { value: 6, label: "6 kỳ" }, { value: "all", label: "Tất cả" }];

function VolumeTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const change = point.change === null ? (point.previousCount === undefined ? "Kỳ đầu chuỗi" : "Kỳ trước = 0; chưa có cơ sở tính %") : point.change === 0 ? "Không đổi so với kỳ trước" : `${point.change > 0 ? "Tăng" : "Giảm"} ${decimal.format(Math.abs(point.change))}% so với kỳ trước`;
  return <div className="cf-volume-tooltip"><span>{unit.toUpperCase()} {point.label}</span><strong>{number.format(point.count)} giao dịch</strong><small>{point.partial ? "Kỳ đang diễn ra; chưa so sánh với kỳ trọn vẹn" : change}</small></div>;
}

/**
 * Biểu đồ xu hướng khối lượng vận hành hệ thống theo dòng thời gian.
 */
export default function AnalyticsVolumeChart({ view, period }) {
  const motionAllowed = useMotionAllowed();
  const [range, setRange] = useState(6);

  const { data, peak, average, comparison, comparisonLabel } = useMemo(() => {
    const trend = view?.trend || [];
    const selectedIndex = trend.findIndex((item) => item.id === period?.id);
    const endIdx = selectedIndex === -1 ? trend.length : selectedIndex + 1;
    const timeline = trend.slice(0, endIdx).map((item, index, all) => {
      const previous = all[index - 1]?.count;
      const change = previous ? ((item.count - previous) / previous) * 100 : null;
      const color = item.partial ? "#dfa847" : change === null || change === 0 ? "#7898ae" : change > 0 ? "#258b80" : "#dc775a";
      return { ...item, previousCount: previous, change, color };
    });
    const sliceData = range === "all" ? timeline : timeline.slice(-range);
    const completed = sliceData.filter((item) => !item.partial);
    const peakItem = completed.length ? completed.reduce((best, item) => (item.count > best.count ? item : best), completed[0]) : null;
    const avg = completed.length ? completed.reduce((sum, item) => sum + item.count, 0) / completed.length : null;
    const comp = period?.previous ? (((period.comparableTotal ?? period.total ?? 0) - period.previous) / period.previous) * 100 : null;
    const compLabel = comp === null ? "—" : comp === 0 ? "Không đổi" : `${comp > 0 ? "+" : "−"}${decimal.format(Math.abs(comp))}%`;
    return { data: sliceData, peak: peakItem, average: avg, comparison: comp, comparisonLabel: compLabel };
  }, [view.trend, period, range]);

  return <section className="cf-volume" aria-labelledby="cf-volume-title">
    <header className="cf-volume-head">
      <div><p>PHÂN TÍCH / KHỐI LƯỢNG</p><h2 id="cf-volume-title">Nhịp giao dịch theo {view.label.toLowerCase()}</h2><span>Mỗi cột là một kỳ. Xanh: tăng · đỏ: giảm · vàng: kỳ đang diễn ra.</span></div>
      <div className="cf-volume-range" role="group" aria-label="Số kỳ hiển thị">{ranges.map(({ value, label }) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}</div>
    </header>

    <div className="cf-volume-body">
      <div className="cf-volume-plot" role="img" aria-label={`Biểu đồ giao dịch: ${data.map((item) => `${view.label.toLowerCase()} ${item.label} có ${item.count} giao dịch${item.partial ? ", đang diễn ra" : ""}`).join("; ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: -15, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="#e7e1db" strokeDasharray="4 6" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#66758a", fontSize: 12 }} dy={9} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#758194", fontSize: 11 }} width={40} allowDecimals={false} />
            <Tooltip cursor={{ fill: "#8474ad0d" }} content={<VolumeTooltip unit={view.label} />} />
            <Bar isAnimationActive={motionAllowed} dataKey="count" radius={[7, 7, 2, 2]}>{data.map((item) => <Cell key={item.id} fill={item.color} stroke={item.id === period.id ? "#243047" : "none"} strokeWidth={item.id === period.id ? 2 : 0} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <aside className="cf-volume-insights" aria-label="Các chỉ báo từ biểu đồ">
        <article className="cf-volume-highlight"><span>KỲ CAO NHẤT TRONG BIỂU ĐỒ</span><strong>{peak ? number.format(peak.count) : "—"}</strong><small>{peak ? `${view.label} ${peak.label} · kỳ đã kết thúc` : "Chưa có kỳ đã kết thúc"}</small></article>
        <div className="cf-volume-stat-grid"><article><span>BÌNH QUÂN</span><strong>{average === null ? "—" : decimal.format(average)}</strong><small>giao dịch / kỳ đã kết thúc</small></article><article className={comparison < 0 ? "is-down" : "is-up"}><span>SO VỚI KỲ ĐỐI CHIẾU</span><strong>{comparisonLabel}</strong><small>{number.format(period.comparableTotal ?? period.total)} so với {number.format(period.previous)} · {period.previousLabel}{comparison === null ? " · Kỳ trước = 0, không tính %" : ""}</small></article></div>
        <p className="cf-volume-comparison-note">{period.comparisonNote}</p>
      </aside>
    </div>
    <footer><span className="cf-volume-legend-dot is-up" /> Tăng <span className="cf-volume-legend-dot is-down" /> Giảm <span className="cf-volume-legend-dot is-current" /> Đang diễn ra <span className="cf-volume-legend-dot is-flat" /> Không đổi / chưa có cơ sở so sánh</footer>
  </section>;
}
