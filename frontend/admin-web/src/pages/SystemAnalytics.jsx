import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import { StatCard, Spinner, EmptyState } from '../components/ui';

const CATEGORY_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export default function SystemAnalytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['system-analytics'],
    queryFn: () => api.get('/admin/system/analytics').then(r => r.data),
    refetchInterval: 60_000, // tự refresh mỗi 1 phút
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
  );
  if (isError) return (
    <EmptyState icon="⚠️" title="Không thể tải dữ liệu" desc="Vui lòng thử lại sau" />
  );

  const { transactions, active_users_this_month, top_categories, period } = data || {};

  const typeChartData = [
    { name: 'Thu nhập', value: transactions?.income_count || 0, color: '#10b981' },
    { name: 'Chi tiêu', value: transactions?.expense_count || 0, color: '#f43f5e' },
  ];

  const categoryChartData = (top_categories || []).map((c, i) => ({
    name: c.name,
    value: c.transaction_count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">System Analytics</h1>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            Tháng {period?.month}/{period?.year}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Thống kê vận hành hệ thống — dữ liệu tổng hợp, không bao gồm thông tin cá nhân
        </p>
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-blue-500 text-lg mt-0.5">🛡️</span>
        <div>
          <p className="text-blue-800 font-semibold text-sm">Chính sách bảo mật dữ liệu</p>
          <p className="text-blue-600 text-xs mt-0.5">
            Trang này chỉ hiển thị số liệu tổng hợp. Quản trị viên không thể xem giao dịch cụ thể của từng người dùng.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💳" label="Tổng giao dịch (all-time)" value={transactions?.total_all_time?.toLocaleString('vi-VN') || 0} color="indigo" />
        <StatCard icon="📅" label="Giao dịch tháng này" value={transactions?.this_month?.toLocaleString('vi-VN') || 0} color="blue" />
        <StatCard icon="📈" label="Giao dịch thu nhập" value={transactions?.income_count?.toLocaleString('vi-VN') || 0} color="emerald" />
        <StatCard icon="👥" label="User active tháng này" value={active_users_this_month || 0} sub="Có ít nhất 1 giao dịch" color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction type split */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Phân loại giao dịch</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeChartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val) => [val.toLocaleString('vi-VN'), 'Số lượng']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {typeChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top categories */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Top 5 danh mục phổ biến</h3>
          {categoryChartData.length === 0 ? (
            <EmptyState icon="📊" title="Chưa có dữ liệu danh mục" />
          ) : (
            <div className="space-y-3">
              {categoryChartData.map((cat, i) => {
                const max = categoryChartData[0]?.value || 1;
                const pct = Math.round((cat.value / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{cat.name}</span>
                      <span className="text-gray-500">{cat.value.toLocaleString('vi-VN')} GD</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
