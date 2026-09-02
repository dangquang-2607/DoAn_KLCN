'use client';

import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { Home, TrendingUp, ArrowUpDown, MoreHorizontal } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category_id?: string;
}

interface MonthlyStat {
  name: string;
  income: number;
  expense: number;
  timestamp: number;
}

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg text-sm">
        <p className="font-bold text-slate-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="font-semibold">
            {entry.name === 'income' ? 'Thu nhập' : 'Chi phí'}: ${entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: async () => {
      // Fetch a larger page size to get a representative dataset for analytics
      const res = await api.get('/transactions', { params: { page: 1, page_size: 1000 } });
      return res.data;
    }
  });

  const transactions = txData?.items || [];
  const hasData = transactions.length > 0;

  // Calculate top expenses for PieChart
  const expenses = transactions.filter((tx: Transaction) => tx.amount < 0);
  const totalExpense = expenses.reduce((sum: number, tx: Transaction) => sum + Math.abs(tx.amount), 0);
  
  // Group expenses by a simple heuristic (description or category_id) for pie chart
  const expenseByCategory = expenses.reduce((acc: Record<string, number>, tx: Transaction) => {
    const cat = tx.category_id || 'Chưa phân loại';
    acc[cat] = (acc[cat] || 0) + Math.abs(tx.amount);
    return acc;
  }, {});

  const pieColors = ['#0f172a', '#475569', '#94a3b8', '#cbd5e1', '#f1f5f9'];
  const pieData = (Object.entries(expenseByCategory) as [string, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([name, value], idx) => ({
      name,
      value: Math.round(value),
      color: pieColors[idx % pieColors.length]
    }));

  if (Object.keys(expenseByCategory).length > 4) {
    const others = (Object.entries(expenseByCategory) as [string, number][])
      .sort(([, a], [, b]) => b - a)
      .slice(4)
      .reduce((sum, [, val]) => sum + val, 0);
    pieData.push({ name: 'Khác', value: Math.round(others), color: pieColors[4] });
  }

  // Calculate monthly income/expense for BarChart
  const monthlyStats = transactions.reduce((acc: Record<string, MonthlyStat>, tx: Transaction) => {
    const date = new Date(tx.transaction_date);
    const monthYear = `Thg ${date.getMonth() + 1}`;
    if (!acc[monthYear]) acc[monthYear] = { name: monthYear, income: 0, expense: 0, timestamp: date.getTime() };
    if (tx.amount > 0) acc[monthYear].income += tx.amount;
    else acc[monthYear].expense += Math.abs(tx.amount);
    return acc;
  }, {});

  const barData = (Object.values(monthlyStats) as MonthlyStat[])
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6); // Last 6 months

  const topCategoryName = pieData.length > 0 ? pieData[0].name : 'Chưa có';
  const topCategoryPercentage = totalExpense > 0 && pieData.length > 0 
    ? Math.round((pieData[0].value / totalExpense) * 100) 
    : 0;

  const totalIncome = transactions.reduce((sum: number, tx: Transaction) => sum + (tx.amount > 0 ? tx.amount : 0), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const netCashFlow = totalIncome - totalExpense;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Báo cáo & Phân tích</h1>
          <p className="text-slate-500 mt-1">Đi sâu vào hiệu suất tài chính của bạn.</p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-1">
          <button className="px-4 py-1.5 text-sm font-semibold rounded-md text-slate-600 hover:bg-slate-50">Tháng</button>
          <button className="px-4 py-1.5 text-sm font-semibold rounded-md bg-slate-100 text-slate-900 shadow-sm">Quý</button>
          <button className="px-4 py-1.5 text-sm font-semibold rounded-md text-slate-600 hover:bg-slate-50">Năm</button>
        </div>
      </div>

      {/* Top Metrics */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse">
          Đang tính toán dữ liệu phân tích...
        </div>
      ) : !hasData ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Chưa có dữ liệu phân tích</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Bạn cần có ít nhất một giao dịch để hệ thống bắt đầu vẽ biểu đồ và phân tích chi tiêu.
          </p>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
            Thêm Giao dịch
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">DANH MỤC CHI TIÊU HÀNG ĐẦU</div>
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center">
              <Home className="w-3 h-3 text-rose-600" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">{topCategoryName}</h2>
          <p className="text-sm font-medium text-slate-500 mt-2">{topCategoryPercentage}% tổng chi phí quý này</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỶ LỆ TIẾT KIỆM</div>
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-extrabold text-slate-900">{savingsRate.toFixed(1)}%</h2>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">+0.0%</span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-2">So với quý trước</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">LƯU CHUYỂN TIỀN THUẦN</div>
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <ArrowUpDown className="w-3 h-3 text-blue-600" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">
            {netCashFlow < 0 ? '-' : ''}${Math.abs(netCashFlow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2">Tổng thu trừ tổng chi</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Donut Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 text-lg">Phân bổ chi tiêu</h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-1 min-h-[250px] relative flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry: { name: string; value: number; color: string }, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng chi phí</span>
              <span className="text-2xl font-extrabold text-slate-900">${totalExpense.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-4 mt-6">
            {pieData.map((item: { name: string; value: number; color: string }, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs font-semibold text-slate-700">{item.name} ({totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Thu nhập vs Chi phí</h3>
              <p className="text-sm font-medium text-slate-500">Quỹ đạo 6 tháng qua</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-900"></div>Thu nhập</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-slate-300"></div>Chi phí</div>
            </div>
          </div>

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={true} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="income" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
        </>
      )}
    </div>
  );
}
