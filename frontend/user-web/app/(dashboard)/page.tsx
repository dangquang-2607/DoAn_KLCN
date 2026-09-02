'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  TrendingUp, RefreshCcw, Plus, 
  Upload, ArrowRight, Wallet,
  Lightbulb, CheckCircle2, Inbox
} from 'lucide-react';
import Link from 'next/link';
import { getHashColor, getCategoryIcon } from '@/lib/ui-helpers';

export default function DashboardOverview() {
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get('/accounts');
      return res.data;
    }
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/transactions', { params: { page_size: 5 } });
      return res.data;
    }
  });

  const accounts = accountsData?.items || [];
  const transactions = txData?.items || [];
  
  const totalBalance = accounts.reduce((sum: number, acc: { balance: number }) => sum + acc.balance, 0);

  // Calculate income/expense from all fetched transactions if available
  // If not, we can fall back to 0 or derive from real API stats if we have an endpoint
  // For now, we compute from the local fetched ones or default to 0
  const income = transactions.filter((tx: { amount: number }) => tx.amount > 0).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0);
  const expense = Math.abs(transactions.filter((tx: { amount: number }) => tx.amount < 0).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0));
  const netCashflow = income - expense;

  const isLoading = accountsLoading || txLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tổng quan</h1>
          <p className="text-slate-500 mt-1">Đây là tóm tắt tình trạng tài chính của bạn.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          Cập nhật lần cuối: Vừa xong
          <button className="p-2 hover:bg-slate-200 rounded-full transition-colors ml-1">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Main Cards) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Net Worth Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-64 h-64 rounded-full bg-indigo-50 blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-slate-600 font-semibold mb-4 uppercase tracking-wider text-xs">
                <Wallet className="w-4 h-4" /> TỔNG TÀI SẢN RÒNG
              </div>
              <div className="flex items-end gap-4 mb-8">
                <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight">
                  ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h2>
                {accounts.length > 0 && (
                  <div className="mb-2 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-sm font-bold">
                    <TrendingUp className="w-3.5 h-3.5" /> +0.0%
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/transactions">
                  <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
                    <Plus className="w-4 h-4" /> Thêm giao dịch
                  </button>
                </Link>
                <Link href="/ocr">
                  <button className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
                    <Upload className="w-4 h-4" /> Tải biên lai lên
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Giao dịch gần đây</h3>
              <Link href="/transactions" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-slate-500 font-medium animate-pulse">
                  Đang tải giao dịch...
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1">Chưa có giao dịch nào</h4>
                  <p className="text-sm text-slate-500 max-w-sm mb-6">Bạn chưa ghi nhận bất kỳ giao dịch nào. Bắt đầu bằng cách thêm giao dịch đầu tiên hoặc tải biên lai lên.</p>
                  <Link href="/ocr">
                    <button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                      Tải biên lai đầu tiên
                    </button>
                  </Link>
                </div>
              ) : (
                transactions.map((tx: { id: string; description: string; category_id?: string; transaction_date: string; amount: number }) => {
                  const Icon = getCategoryIcon(tx.category_id || tx.description);
                  const colors = getHashColor(tx.description);
                  
                  return (
                    <div key={tx.id} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{tx.description}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(tx.transaction_date).toLocaleDateString('vi-VN')} &bull; {tx.category_id ? 'Đã phân loại' : 'Chưa phân loại'}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount > 0 ? '$' : '-$'}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Side Cards) */}
        <div className="space-y-6">
          
          {/* Cashflow Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Dòng tiền (Tháng này)</h3>
              <button className="text-slate-400 hover:text-slate-600">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-current rounded-full"></span>
                  <span className="w-1 h-1 bg-current rounded-full"></span>
                  <span className="w-1 h-1 bg-current rounded-full"></span>
                </div>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">Chưa có dữ liệu dòng tiền</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-600">Thu nhập</span>
                    <span className="font-bold text-slate-900">${income.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: income > 0 ? '100%' : '0%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-600">Chi phí</span>
                    <span className="font-bold text-slate-900">${expense.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: expense > 0 ? (income > 0 ? Math.min((expense/income)*100, 100) : 100) + '%' : '0%' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-600">Dòng tiền thuần</span>
              <span className={`font-extrabold ${netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ${netCashflow.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Insights */}
          <div>
            <h3 className="font-bold text-slate-900 mb-4 text-base">Thông tin chi tiết nhanh</h3>
            <div className="space-y-3">
              
              {transactions.length > 0 ? (
                <>
                  <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-4 flex gap-4">
                    <div className="mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-[#fef08a] flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-[#ca8a04]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        Bạn đã có <strong>{transactions.length} giao dịch</strong> trong hệ thống. Hãy xem xét phân loại chúng để quản lý tốt hơn.
                      </p>
                      <Link href="/transactions" className="text-sm font-semibold text-[#b45309] mt-2 hover:underline block">Xem giao dịch</Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#f0fdf4] border border-[#dcfce3] rounded-xl p-4 flex gap-4">
                  <div className="mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-[#dcfce3] flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Chào mừng bạn! Hệ thống đã sẵn sàng để bạn ghi nhận tài chính của mình.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

