import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { StatCard, Badge, Spinner, EmptyState } from '../components/ui';

function OcrProgressRing({ pct, size = 120 }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#f43f5e';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#f0f0f0" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r}
        fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="bold" fill={color}>
        {pct}%
      </text>
      <text x="50" y="64" textAnchor="middle" fontSize="8" fill="#9ca3af">
        success
      </text>
    </svg>
  );
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function OcrMonitor() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ocr-monitor'],
    queryFn: () => api.get('/admin/system/ocr-monitor').then(r => r.data),
    refetchInterval: 30_000, // refresh mỗi 30 giây
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
  );
  if (isError) return (
    <EmptyState icon="⚠️" title="Không thể tải dữ liệu OCR" desc="Vui lòng thử lại" />
  );

  const { invoices, ocr_jobs, recent_failures } = data || {};
  const successRate = invoices?.success_rate_pct || 0;
  const errorRate = ocr_jobs?.error_rate_pct || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OCR System Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Giám sát vận hành hệ thống OCR — chỉ số kỹ thuật, không hiển thị nội dung hóa đơn
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium transition-colors"
        >
          🔄 Làm mới
        </button>
      </div>

      {/* Success Rate + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ring chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <p className="text-sm font-semibold text-gray-600 mb-4">Tỷ lệ OCR thành công</p>
          <OcrProgressRing pct={successRate} size={140} />
          <p className="text-xs text-gray-400 mt-3">
            {invoices?.completed || 0} / {invoices?.total || 0} hóa đơn hoàn thành
          </p>
        </div>

        {/* Invoice status breakdown */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 col-span-2">
          <p className="text-sm font-semibold text-gray-600 mb-4">Phân loại trạng thái hóa đơn</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Tổng hóa đơn', value: invoices?.total, icon: '📁', color: 'bg-gray-50 border-gray-200' },
              { label: 'Hoàn thành', value: invoices?.completed, icon: '✅', color: 'bg-emerald-50 border-emerald-200' },
              { label: 'Thất bại', value: invoices?.failed, icon: '❌', color: 'bg-red-50 border-red-200' },
              { label: 'Đang xử lý', value: invoices?.processing, icon: '⚙️', color: 'bg-blue-50 border-blue-200' },
              { label: 'Chờ xác nhận', value: invoices?.review_required, icon: '👁️', color: 'bg-amber-50 border-amber-200' },
              { label: 'Mới upload', value: invoices?.uploaded, icon: '📤', color: 'bg-purple-50 border-purple-200' },
            ].map((item) => (
              <div key={item.label} className={`border rounded-xl p-4 ${item.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <span className="text-xs text-gray-500">{item.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{item.value || 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OCR Jobs stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="🔧" label="Tổng OCR jobs" value={ocr_jobs?.total?.toLocaleString('vi-VN') || 0} color="indigo" />
        <StatCard icon="💥" label="Jobs thất bại" value={ocr_jobs?.failed || 0} color="rose" />
        <StatCard
          icon="📊"
          label="Tỷ lệ lỗi"
          value={`${errorRate}%`}
          sub={errorRate < 10 ? '✅ Trong ngưỡng an toàn' : '⚠️ Cần kiểm tra'}
          color={errorRate < 10 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Recent failures */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">
            Lỗi OCR gần đây
            <span className="ml-2 text-xs text-gray-400 font-normal">(Chỉ hiển thị thông báo lỗi kỹ thuật)</span>
          </h3>
        </div>
        {!recent_failures || recent_failures.length === 0 ? (
          <EmptyState icon="✅" title="Không có lỗi gần đây" desc="Hệ thống OCR đang hoạt động bình thường" />
        ) : (
          <div className="divide-y divide-gray-100">
            {recent_failures.map((f) => (
              <div key={f.job_id} className="px-6 py-4 flex items-start gap-4 hover:bg-red-50 transition-colors">
                <span className="text-xl mt-0.5">💥</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {f.error || 'Lỗi không xác định'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{formatDate(f.created_at)}</p>
                </div>
                <Badge variant="danger">FAILED</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
