'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Download, Search, Calendar as CalendarIcon, 
  Inbox, ChevronDown, LayoutList
} from 'lucide-react';
import { getHashColor, getCategoryIcon } from '@/lib/ui-helpers';

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', page],
    queryFn: async () => {
      const res = await api.get('/transactions', { params: { page, page_size: pageSize } });
      return res.data;
    }
  });

  const transactions = txData?.items || [];
  const total = txData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch sử Giao dịch</h1>
          <p className="text-slate-500 mt-1">Quản lý và theo dõi dòng tiền qua tất cả các tài khoản.</p>
        </div>
        <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Download className="w-4 h-4" /> Xuất CSV
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Filters Sidebar */}
        <div className="w-full lg:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0 sticky top-24">
          <div className="flex items-center gap-2 font-bold text-slate-800 mb-6">
            <LayoutList className="w-5 h-5" /> Bộ lọc
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">KHOẢNG THỜI GIAN</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Tất cả thời gian</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">LOẠI</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="flex-1 text-sm py-1.5 px-2 bg-white rounded shadow-sm font-medium text-slate-800">Tất cả</button>
                <button className="flex-1 text-sm py-1.5 px-2 font-medium text-slate-600 hover:text-slate-800">Thu nhập</button>
                <button className="flex-1 text-sm py-1.5 px-2 font-medium text-slate-600 hover:text-slate-800">Chi phí</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">VÍ / TÀI KHOẢN</label>
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Tất cả tài khoản</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">DANH MỤC</label>
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Tất cả danh mục</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>

            <button className="w-full py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mt-4">
              Đặt lại Bộ lọc
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden w-full">
          {/* Table Header */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm font-medium text-slate-500">
              Đang hiển thị <span className="font-bold text-slate-800">{transactions.length > 0 ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)}</span> trong số <span className="font-bold text-slate-800">{total}</span> mục
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Tìm kiếm mô tả..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Table Body */}
          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-64 text-slate-400 font-medium animate-pulse">
                Đang tải dữ liệu giao dịch...
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Chưa có giao dịch</h2>
                <p className="text-slate-500 text-sm max-w-sm mb-4">Hiện tại không có giao dịch nào phù hợp với bộ lọc hoặc bạn chưa có giao dịch nào.</p>
                <button className="text-indigo-600 font-semibold hover:underline text-sm">
                  Thêm giao dịch mới
                </button>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4">Ngày</th>
                    <th className="px-6 py-4">Mô tả</th>
                    <th className="px-6 py-4 text-center">Danh mục</th>
                    <th className="px-6 py-4">Ví / Tài khoản</th>
                    <th className="px-6 py-4 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx: { id: string; transaction_date: string; description: string; category_id?: string; amount: number }) => {
                    const Icon = getCategoryIcon(tx.category_id || tx.description);
                    const colors = getHashColor(tx.description);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600">
                          {new Date(tx.transaction_date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colors.bg}`}>
                              <Icon className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <span className="font-bold text-slate-900">{tx.description}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {tx.category_id ? 'Đã phân loại' : 'Chưa phân loại'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-700">Tài khoản Nội bộ</div>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount > 0 ? '$' : '-$'}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Trước
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button 
                    key={p} 
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded font-bold text-sm transition-colors ${
                      page === p ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Tiếp
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
