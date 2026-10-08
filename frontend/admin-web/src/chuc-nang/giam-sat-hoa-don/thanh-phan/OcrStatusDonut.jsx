import { BadgeCheck, CircleAlert, FileClock, ScanLine, UserRoundCheck } from "lucide-react";
import "./ocr-status-donut.css";

const palette = {
  slate: "#8295a5",
  blue: "#5788c2",
  amber: "#dfa847",
  teal: "#258b80",
  coral: "#dc775a",
};

const callouts = {
  uploaded: { Icon: FileClock },
  processing: { Icon: ScanLine },
  reviewRequired: { Icon: UserRoundCheck },
  confirmed: { Icon: BadgeCheck },
  failed: { Icon: CircleAlert },
};

const percentage = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const radius = 90;
const circumference = 2 * Math.PI * radius;
const center = { x: 350, y: 210 };

export default function OcrStatusDonut({ segments, centerLabel }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const active = segments.filter((segment) => segment.value > 0).reduce((items, segment) => {
    const start = items.length ? items[items.length - 1].start + items[items.length - 1].fraction : 0;
    const fraction = segment.value / total;
    const midpoint = start + fraction / 2;
    const anchor = {
      x: center.x + Math.sin(midpoint * Math.PI * 2) * (radius + 18),
      y: center.y - Math.cos(midpoint * Math.PI * 2) * (radius + 18),
    };
    return [...items, { ...segment, fraction, start, anchor, ...callouts[segment.key] }];
  }, []);
  // Sort anchors on each side, keeping connectors in the same vertical order.
  // Fixed positions from the mockup cross when all five statuses are non-zero.
  for (const right of [false, true]) {
    const side = active.filter((item) => (item.anchor.x >= center.x) === right).sort((a, b) => a.anchor.y - b.anchor.y);
    side.forEach((item, index) => {
      item.x = right ? 570 : 130;
      item.y = side.length === 1 ? Math.max(70, Math.min(350, item.anchor.y)) : 70 + index * 280 / (side.length - 1);
    });
  }
  const stops = active.map((segment) => `${palette[segment.color]} ${segment.start * 100}% ${(segment.start + segment.fraction) * 100}%`);
  const description = total
    ? `${total} ${centerLabel}. ${segments.map((segment) => `${segment.label}: ${segment.value} (${percentage.format(segment.value / total * 100)}%)`).join("; ")}`
    : `Chưa có ${centerLabel}`;

  return <figure className="cf-ocr-orbit" aria-label={description}>
    <svg className="cf-ocr-orbit-desktop" viewBox="0 0 700 420" role="img" aria-label={description}>
      <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#edf0f1" strokeWidth="30" />
      {active.map((segment) => {
        const length = segment.fraction * circumference;
        const gap = Math.min(3, length * .1);
        return <circle key={segment.key} cx={center.x} cy={center.y} r={radius} fill="none" stroke={palette[segment.color]} strokeWidth="30" strokeDasharray={`${length - gap} ${circumference - length + gap}`} strokeDashoffset={-(segment.start * circumference + gap / 2)} transform={`rotate(-90 ${center.x} ${center.y})`} />;
      })}
      {active.map((segment) => <g key={`${segment.key}-callout`}>
        <line x1={segment.anchor.x} y1={segment.anchor.y} x2={segment.x} y2={segment.y} stroke={palette[segment.color]} strokeWidth="2" />
        <circle cx={segment.anchor.x} cy={segment.anchor.y} r="4" fill={palette[segment.color]} />
        <foreignObject x={segment.x - 64} y={segment.y - 45} width="128" height="100">
          <div className="cf-ocr-orbit-callout" style={{ "--orbit-color": palette[segment.color] }}>
            <strong>{percentage.format(segment.fraction * 100)}%</strong>
            <span className="cf-ocr-orbit-callout-icon"><segment.Icon size={20} aria-hidden="true" /></span>
            <small>{segment.label}</small>
          </div>
        </foreignObject>
      </g>)}
      <text x={center.x} y={center.y + 2} textAnchor="middle" className="cf-ocr-orbit-total">{total}</text>
      <text x={center.x} y={center.y + 26} textAnchor="middle" className="cf-ocr-orbit-center-label">{centerLabel}</text>
    </svg>

    <div className="cf-ocr-orbit-mobile">
      <div className="cf-ocr-orbit-mobile-ring" style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "#edf0f1" }} role="img" aria-label={description}><span><strong>{total}</strong><small>{centerLabel}</small></span></div>
      <ul>{active.map((segment) => <li key={segment.key} style={{ "--orbit-color": palette[segment.color] }}><span className="cf-ocr-orbit-mobile-icon"><segment.Icon size={17} aria-hidden="true" /></span><span>{segment.label}</span><strong>{percentage.format(segment.fraction * 100)}%</strong></li>)}</ul>
    </div>
    <figcaption>Vòng chỉ gắn tỷ lệ cho trạng thái có hóa đơn; danh sách trạng thái vẫn hiển thị đầy đủ các giá trị 0.</figcaption>
  </figure>;
}
