import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Badge, Pagination, Spinner, EmptyState } from '../components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function actionLabel(action) {
  const map = {
    BAN_USER: { label: 'Khóa tài khoản', variant: 'danger' },
    UNBAN_USER: { label: 'Mở khóa tài khoản', variant: 'success' },
    CREATE_CATEGORY: { label: 'Tạo danh mục', variant: 'info' },
    UPDATE_CATEGORY: { label: 'Sửa danh mục', variant: 'warning' },
    DELETE_CATEGORY: { label: 'Xóa danh mục', variant: 'danger' },
  };
  return map[action] || { label: action, variant: 'default' };
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => api.get(`/admin/audit-logs?page=${page}&page_size=${PAGE_SIZE}`).then(r => r.data),
    keepPreviousData: true,
  });

  const items = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật ký quản trị</h1>
          <p className="text-sm text-gray-500 mt-1">Lịch sử hành động của tất cả quản trị viên trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <span className="text-amber-600 text-lg">🔒</span>
          <span className="text-amber-700 text-sm font-medium">Chỉ đọc — Không thể chỉnh sửa</span>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">
            Tổng cộng: <span className="text-indigo-600">{total}</span> bản ghi
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : isError ? (
          <EmptyState icon="⚠️" title="Không thể tải dữ liệu" desc="Vui lòng thử lại sau" />
        ) : items.length === 0 ? (
          <EmptyState icon="📋" title="Chưa có nhật ký" desc="Các hành động quản trị sẽ được ghi lại ở đây" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Thời gian</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hành động</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Đối tượng</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID đối tượng</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((log) => {
                  const { label, variant } = actionLabel(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        <span className="font-mono text-xs">{formatDate(log.created_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={variant}>{label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium capitalize">{log.target_type}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {log.target_id || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          {log.admin_id?.slice(0, 8)}…
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
