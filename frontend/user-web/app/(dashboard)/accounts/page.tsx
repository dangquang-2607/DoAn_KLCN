'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion } from 'framer-motion';
import { 
  Plus, MoreVertical, RefreshCw, TrendingUp, TrendingDown, Inbox
} from 'lucide-react';
import { getAccountIcon } from '@/lib/ui-helpers';

export default function AccountsPage() {
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get('/accounts');
      return res.data;
    }
  });

  const accounts = accountsData?.items || [];

  return (
    <div className="bg-[#0f172a] -m-6 lg:-m-10 p-6 lg:p-10 min-h-[calc(100vh-80px)] text-white rounded-tl-3xl shadow-inner">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ví & Tài khoản</h1>
            <p className="text-slate-400 mt-1">Quản lý các tổ chức đã kết nối và số dư thủ công.</p>
          </div>
          <button className="text-sm font-semibold hover:text-indigo-300 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Liên kết Tài khoản
          </button>
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400 animate-pulse">
            Đang tải dữ liệu tài khoản...
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Chưa có tài khoản nào</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Bạn chưa liên kết hoặc tạo tài khoản nào. Hãy thêm tài khoản đầu tiên để bắt đầu theo dõi số dư của mình.
            </p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
              Tạo tài khoản đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map((acc: { id: string; name: string; account_type?: string; balance: number }, index: number) => {
              const Icon = getAccountIcon(acc.account_type || acc.name);
              // Provide some defaults for missing properties
              const bank = acc.account_type || 'Tài khoản Nội bộ';
              const trendUp: boolean | null = acc.id ? true : (acc.name ? false : null); // Placeholder since API might not return this
              const trend = '+0.0% so với tháng trước'; // Placeholder
              const iconBg = 'bg-blue-100';
              const iconColor = 'text-blue-600';
              const cardBg = 'bg-gradient-to-br from-white to-slate-50';
              const syncTime = 'Vừa cập nhật';

              return (
                <motion.div
                  key={acc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative overflow-hidden rounded-3xl ${cardBg} text-slate-900 p-8 shadow-lg border border-white/20`}
                >
                  {/* Decorative blob */}
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 rounded-full bg-slate-200/50 blur-3xl pointer-events-none"></div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
                          <Icon className={`w-6 h-6 ${iconColor}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm tracking-widest text-slate-500 uppercase">{acc.name}</h3>
                          <p className="text-slate-700 font-medium">{bank}</p>
                        </div>
                      </div>
                      <button className="text-slate-400 hover:text-slate-700">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mb-8">
                      <h2 className="text-5xl font-extrabold tracking-tight mb-3">
                        ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </h2>
                      <div className={`text-sm font-semibold flex items-center gap-1.5 ${
                        trendUp ? 'text-emerald-600' : 
                        trendUp === false ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {trendUp && <TrendingUp className="w-4 h-4" />}
                        {trendUp === false && <TrendingDown className="w-4 h-4" />}
                        {trendUp === null && <span className="text-lg leading-none">-</span>}
                        {trend}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <RefreshCw className="w-4 h-4" /> {syncTime}
                      </div>
                      <button className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
