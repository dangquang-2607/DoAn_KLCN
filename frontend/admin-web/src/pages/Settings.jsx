import { useState } from 'react';
import { Shield, Bell, Database, Globe, Zap, ChevronRight } from 'lucide-react';

const groups = [
  {
    icon: Shield, iconBg: '#dbeafe', iconColor: '#1d4ed8',
    title: 'Bảo mật', desc: 'Cấu hình xác thực và quyền truy cập',
    items: [
      { label: 'Xác thực 2 lớp (2FA)', desc: 'Bắt buộc đối với tài khoản quản trị', type: 'toggle', key: '2fa', default: true },
      { label: 'Thời gian hết phiên', desc: 'Tự động đăng xuất sau 30 phút không hoạt động', type: 'toggle', key: 'timeout', default: true },
      { label: 'Ghi nhật ký đăng nhập', desc: 'Lưu lịch sử đăng nhập của tất cả tài khoản', type: 'toggle', key: 'log', default: true },
    ],
  },
  {
    icon: Bell, iconBg: '#fef3c7', iconColor: '#d97706',
    title: 'Thông báo', desc: 'Quản lý cảnh báo và thông báo hệ thống',
    items: [
      { label: 'Cảnh báo email', desc: 'Gửi email khi phát hiện hoạt động bất thường', type: 'toggle', key: 'email_alert', default: true },
      { label: 'Thông báo hệ thống', desc: 'Hiển thị thông báo real-time trong dashboard', type: 'toggle', key: 'sys_notify', default: true },
      { label: 'Báo cáo hàng tuần', desc: 'Tự động gửi báo cáo tóm tắt mỗi thứ Hai', type: 'toggle', key: 'weekly', default: false },
    ],
  },
  {
    icon: Database, iconBg: '#f3e8ff', iconColor: '#7c3aed',
    title: 'Dữ liệu & Lưu trữ', desc: 'Cấu hình backup và lưu trữ dữ liệu',
    items: [
      { label: 'Tự động sao lưu', desc: 'Backup tự động hàng ngày lúc 03:00 SA', type: 'toggle', key: 'backup', default: true },
      { label: 'Chế độ bảo trì', desc: 'Tạm ngừng dịch vụ cho người dùng cuối', type: 'toggle', key: 'maintenance', default: false },
    ],
  },
  {
    icon: Globe, iconBg: '#dcfce7', iconColor: '#15803d',
    title: 'Giao diện & Ngôn ngữ', desc: 'Tùy chỉnh giao diện quản trị',
    items: [
      { label: 'Ngôn ngữ mặc định', desc: 'Tiếng Việt (vi-VN)', type: 'link' },
      { label: 'Múi giờ hệ thống', desc: 'Asia/Ho_Chi_Minh (GMT+7)', type: 'link' },
      { label: 'Định dạng tiền tệ', desc: 'VND (₫) — Việt Nam Đồng', type: 'link' },
    ],
  },
];

const initToggles = () => {
  const obj = {};
  groups.forEach(g => g.items.filter(i => i.type === 'toggle').forEach(i => { obj[i.key] = i.default; }));
  return obj;
};

export default function Settings() {
  const [toggles, setToggles] = useState(initToggles());
  const set = (key, val) => setToggles(p => ({ ...p, [key]: val }));

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="mb-4">
        <h4 className="fw-bold mb-1" style={{ color: '#0d1117' }}>Cài đặt Hệ thống</h4>
        <p className="text-muted mb-0" style={{ fontSize: 13 }}>Cấu hình và tùy chỉnh hành vi của hệ thống CashFlow Admin.</p>
      </div>

      {/* Status banner */}
      <div className="alert d-flex align-items-center gap-3 mb-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={20} color="#15803d" />
        </div>
        <div className="flex-fill">
          <div className="fw-semibold mb-0" style={{ color: '#0d1117', fontSize: 14 }}>Hệ thống đang hoạt động bình thường</div>
          <div style={{ color: '#15803d', fontSize: 12 }}>Tất cả dịch vụ ổn định · Cập nhật lần cuối: vừa xong</div>
        </div>
        <span className="rounded-circle" style={{ width: 10, height: 10, background: '#15803d', display: 'block', animation: 'pulse 2s infinite', flexShrink: 0 }} />
      </div>

      {/* Setting groups */}
      <div className="d-flex flex-column gap-3">
        {groups.map(group => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="card border shadow-sm" style={{ borderRadius: 12, borderColor: '#e1e4e8' }}>
              <div className="card-header bg-light d-flex align-items-center gap-3 py-3" style={{ borderRadius: '12px 12px 0 0', borderColor: '#e1e4e8' }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: group.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={19} color={group.iconColor} />
                </div>
                <div>
                  <div className="fw-semibold" style={{ fontSize: 14, color: '#0d1117' }}>{group.title}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{group.desc}</div>
                </div>
              </div>
              <div className="card-body p-0">
                {group.items.map((item, idx) => (
                  <div key={item.label} className="d-flex align-items-center justify-content-between px-4 py-3"
                    style={{ borderBottom: idx < group.items.length - 1 ? '1px solid #f0f2f5' : 'none' }}>
                    <div>
                      <div className="fw-medium" style={{ fontSize: 14, color: '#0d1117' }}>{item.label}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{item.desc}</div>
                    </div>
                    {item.type === 'toggle' ? (
                      <div className="form-check form-switch mb-0">
                        <input className="form-check-input" type="checkbox" role="switch"
                          checked={toggles[item.key]}
                          onChange={e => set(item.key, e.target.checked)}
                          style={{ width: 40, height: 22, cursor: 'pointer' }} />
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-link text-decoration-none d-flex align-items-center gap-1 p-0" style={{ color: '#1f6feb', fontSize: 13 }}>
                        Chỉnh sửa <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="d-flex justify-content-end gap-2 mt-4">
        <button className="btn btn-outline-secondary" style={{ borderRadius: 8, fontSize: 13 }}>Đặt lại mặc định</button>
        <button className="btn-primary-dark">Lưu thay đổi</button>
      </div>
    </div>
  );
}
