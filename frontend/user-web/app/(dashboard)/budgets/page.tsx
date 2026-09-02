'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, LayoutGrid, List, Wallet, 
  TrendingUp, CheckCircle2, Inbox
} from 'lucide-react';
import { getHashColor, getCategoryIcon } from '@/lib/ui-helpers';

export default function BudgetsPage() {
  const { data: budgetsData, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      // Assuming this endpoint exists based on earlier schemas
      const res = await api.get('/budgets');
      return res.data;
    }
  });

  const budgets = budgetsData?.items || [];
  const totalLimit = budgets.reduce((sum: number, b: { amount?: number }) => sum + Number(b.amount || 0), 0);
  const totalSpent = budgets.reduce((sum: number, b: { spent?: number }) => sum + Number(b.spent || 0), 0);
  const remaining = totalLimit - totalSpent;
  const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ngân sách</h1>
          <p className="text-slate-500 mt-1">Theo dõi hạn mức danh mục và chi tiêu hiện tại của bạn.</p>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Thiết lập Ngân sách Mới
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Tổng Ngân sách Hàng tháng
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900">${totalLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          <p className="text-sm font-medium text-slate-500 mt-4">Qua {budgets.length} danh mục hoạt động</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Tổng chi tiêu
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: `${Math.min(totalPercentage, 100)}%` }}></div>
            </div>
            <span className="text-sm font-bold text-slate-500">{totalPercentage.toFixed(0)}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Số dư Còn lại
          </div>
          <h2 className={`text-4xl font-extrabold ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h2>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 font-medium">
            {remaining >= 0 ? 'Đang trên đà tiết kiệm tốt' : 'Đã chi tiêu vượt hạn mức tổng'}
          </div>
        </div>
      </div>

      {/* Active Categories */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Danh mục đang hoạt động</h2>
          <div className="flex items-center gap-2 text-slate-400">
            <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-800 transition-colors bg-slate-100">
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 font-medium animate-pulse border border-slate-200 rounded-2xl bg-white shadow-sm">
            Đang tải dữ liệu ngân sách...
          </div>
        ) : budgets.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Chưa thiết lập ngân sách</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-6">
              Bạn chưa có kế hoạch ngân sách nào cho tháng này. Hãy thiết lập ngân sách cho các danh mục để kiểm soát chi tiêu tốt hơn.
            </p>
            <button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-lg font-bold transition-colors">
              Tạo ngân sách đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {budgets.map((b: { id: string; amount?: number; spent?: number; category_id?: string; month: number; year: number }) => {
              const bLimit = Number(b.amount || 0);
              const bSpent = Number(b.spent || 0);
              const pct = bLimit > 0 ? Math.min((bSpent / bLimit) * 100, 100) : 100;
              const isOver = bSpent > bLimit;
              const isDanger = pct >= 90 || isOver;
              const barColor = isDanger ? 'bg-rose-600' : 'bg-slate-900';
              const cardStyle = isOver ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white';
              const remainingAmt = bLimit - bSpent;
              
              const catName = b.category_id || 'Danh mục chưa tên';
              const Icon = getCategoryIcon(catName);
              const colors = getHashColor(catName);

              return (
                <div key={b.id} className={`rounded-2xl p-6 shadow-sm border ${cardStyle}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{catName}</h3>
                        <p className="text-sm font-medium text-slate-500">Tháng {b.month}/{b.year}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                        ${bSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-semibold text-slate-400">/ giới hạn ${bLimit.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span className={isOver ? 'text-rose-600' : ''}>Đã dùng {pct.toFixed(0)}%</span>
                      <span className={isOver ? 'text-rose-600' : ''}>
                        {isOver ? `Vượt quá -$${Math.abs(remainingAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `Còn lại $${remainingAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    {isOver ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 text-white">
                        Đã Vượt Hạn mức
                      </span>
                    ) : pct >= 90 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-600">
                        Sắp Hết Hạn mức
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-slate-500">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Đúng Tiến độ
                      </span>
                    )}
                    <button className={`text-sm font-bold hover:underline ${isOver ? 'text-rose-600' : 'text-slate-600'}`}>
                      Xem Chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
