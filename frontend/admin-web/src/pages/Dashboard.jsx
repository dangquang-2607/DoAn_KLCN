import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Activity, RefreshCw, Database, Download, AlertTriangle, Info } from 'lucide-react';
import api from '../services/api';

const alerts = [
  { icon: AlertTriangle, title: 'Đột biến Độ trễ', desc: 'Cluster-03 có độ trễ tăng', time: '2 phút trước', color: '#d97706', bg: '#fef3c7' },
  { icon: Database, title: 'Sử dụng Bộ nhớ', desc: 'Node-02 đạt mức 78%', time: '15 phút trước', color: '#d97706', bg: '#fef3c7' },
  { icon: Info, title: 'Sao lưu Thành công', desc: 'Backup hàng ngày hoàn tất', time: '1 giờ trước', color: '#2563eb', bg: '#dbeafe' },
  { icon: RefreshCw, title: 'Đồng bộ Cổng thông tin', desc: 'Quy tắc định tuyến cập nhật', time: '3 giờ trước', color: '#2563eb', bg: '#dbeafe' },
];

function LineChart({ filter }) {
  const data = {
    '1H':  [72, 75, 68, 80, 78, 82, 79, 85, 83, 80, 78, 82],
    '24H': [55, 60, 58, 65, 70, 68, 72, 75, 73, 70, 74, 78],
    '7N':  [60, 55, 65, 70, 68, 75, 72, 78, 74, 80, 76, 82],
  };
  const pts = data[filter] || data['24H'];
  const W = 560, H = 160, P = 10;
  const tx = i => P + (i / (pts.length - 1)) * (W - P * 2);
  const ty = v => H - P - (v / 100) * (H - P * 2);
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${tx(i)},${ty(v)}`).join(' ');
  const area = `${path} L${tx(pts.length - 1)},${H} L${tx(0)},${H} Z`;
  const labels = filter === '7N'
    ? ['T2','T3','T4','T5','T6','T7','CN']
    : filter === '1H'
    ? ['0m','10m','20m','30m','40m','50m','60m']
    : ['00:00','04:00','08:00','12:00','16:00','20:00','Bây giờ'];

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', height: 180 }}>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f6feb" stopOpacity=".18" />
          <stop offset="100%" stopColor="#1f6feb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25,50,75,100].map(v => (
        <g key={v}>
          <line x1={P} y1={ty(v)} x2={W-P} y2={ty(v)} stroke="#e1e4e8" strokeWidth="1" strokeDasharray="4 3" />
          <text x={P-4} y={ty(v)+4} textAnchor="end" fontSize="9" fill="#adb5bd">{v}%</text>
        </g>
      ))}
      <path d={area} fill="url(#g)" />
      <path d={path} fill="none" stroke="#1f6feb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((v, i) => <circle key={i} cx={tx(i)} cy={ty(v)} r="3.5" fill="#1f6feb" stroke="white" strokeWidth="2" />)}
      {labels.map((l, i) => (
        <text key={l} x={P + (i/(labels.length-1))*(W-P*2)} y={H+18} textAnchor="middle" fontSize="9" fill="#adb5bd">{l}</text>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const [filter, setFilter] = useState('24H');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard/stats');
      return data;
    },
    refetchInterval: 30_000, // tự refresh mỗi 30 giây
  });

  // Build KPI cards từ dữ liệu thật (fallback về 0 khi đang load)
  const kpis = [
    {
      label: 'Tổng số Người dùng',
      value: isLoading ? '...' : stats?.users?.total?.toLocaleString() ?? '0',
      sub: `${stats?.users?.banned ?? 0} bị khóa`,
      icon: Users, color: '#1d4ed8', bg: '#dbeafe',
    },
    {
      label: 'Tổng số Giao dịch',
      value: isLoading ? '...' : stats?.transactions?.total?.toLocaleString() ?? '0',
      sub: 'Tổng tích lũy',
      icon: Activity, color: '#15803d', bg: '#dcfce7',
    },
    {
      label: 'Tỷ lệ OCR Thành công',
      value: isLoading ? '...' : `${stats?.invoices?.ocr_success_rate ?? 0}%`,
      sub: `${stats?.invoices?.total ?? 0} hóa đơn tổng`,
      icon: RefreshCw, color: '#7c3aed', bg: '#f3e8ff',
    },
    {
      label: 'User Đang Hoạt động',
      value: isLoading ? '...' : stats?.users?.active?.toLocaleString() ?? '0',
      sub: 'Chưa bị khóa',
      icon: Database, color: '#d97706', bg: '#fef3c7',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: '#0d1117' }}>Tổng quan Hệ thống</h4>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>Các chỉ số thời gian thực từ database — tự cập nhật mỗi 30 giây.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge-active">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#15803d', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Hệ thống Hoạt động Tốt
          </span>
          <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" style={{ borderRadius: 8, fontSize: 13 }}>
            <Download size={14} /> Xuất Báo cáo
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="row g-3 mb-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div className="col-6 col-xl-3" key={kpi.label}>
              <div className="kpi-card h-100">
                <div className="d-flex align-items-start justify-content-between mb-3">
                  <p className="mb-0 text-muted" style={{ fontSize: 12, fontWeight: 500, maxWidth: '70%' }}>{kpi.label}</p>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={kpi.color} strokeWidth={2} />
                  </div>
                </div>
                <p className="fw-bold mb-2" style={{ fontSize: 28, color: '#0d1117' }}>{kpi.value}</p>
                <span className="text-muted" style={{ fontSize: 11 }}>{kpi.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Alerts */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 12, border: '1px solid #e1e4e8 !important' }}>
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between mb-3">
                <div>
                  <h6 className="fw-semibold mb-1" style={{ color: '#0d1117' }}>Sức khỏe & Hiệu suất Hệ thống</h6>
                  <p className="text-muted mb-0" style={{ fontSize: 12 }}>Thời gian hoạt động máy chủ và độ trễ API</p>
                </div>
                <div className="btn-group btn-group-sm">
                  {['1H','24H','7N'].map(f => (
                    <button key={f} type="button"
                      className={`btn ${filter === f ? 'btn-dark' : 'btn-outline-secondary'}`}
                      style={{ fontSize: 12 }}
                      onClick={() => setFilter(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <LineChart filter={filter} />
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
            <div className="card-body">
              <h6 className="fw-semibold mb-3" style={{ color: '#0d1117' }}>Cảnh báo Gần đây</h6>
              <div className="d-flex flex-column gap-2">
                {alerts.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="d-flex gap-2 p-2 rounded-3" style={{ background: '#f8f9fa' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} color={a.color} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="mb-0 fw-semibold" style={{ fontSize: 12, color: '#0d1117' }}>{a.title}</p>
                        <p className="mb-0 text-truncate text-muted" style={{ fontSize: 11 }}>{a.desc}</p>
                        <p className="mb-0 text-muted" style={{ fontSize: 11 }}>{a.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-sm btn-outline-secondary w-100 mt-3" style={{ fontSize: 12, borderRadius: 8 }}>
                Xem Tất cả Cảnh báo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
