'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { 
  LayoutDashboard, Wallet, Receipt, PieChart, FileScan, 
  Layers, BarChart3, Settings, HelpCircle, LogOut, Menu, X, 
  Search, Bell, Activity 
} from 'lucide-react';

const MENU_TOP = [
  { href: '/', label: 'Bảng điều khiển của tôi', icon: LayoutDashboard },
  { href: '/accounts', label: 'Ví & Tài khoản', icon: Wallet },
  { href: '/transactions', label: 'Giao dịch', icon: Receipt },
  { href: '/budgets', label: 'Ngân sách', icon: PieChart },
  { href: '/ocr', label: 'Hóa đơn & Nhận dạng', icon: FileScan },
  { href: '/categories', label: 'Danh mục', icon: Layers },
  { href: '/analytics', label: 'Phân tích', icon: BarChart3 },
];

const MENU_BOTTOM = [
  { href: '/settings', label: 'Cài đặt', icon: Settings },
  { href: '/support', label: 'Hỗ trợ', icon: HelpCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ full_name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        if (res.data.is_banned) throw new Error('Banned');
        setUser(res.data);
      })
      .catch(() => {
        sessionStorage.removeItem('user_access_token');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('user_access_token');
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/transactions?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Activity className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const renderNavItems = (items: typeof MENU_TOP) => (
    <nav className="px-4 space-y-1">
      {items.map(item => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              active 
                ? 'bg-[#e2e8f0] text-[#1e293b] font-semibold' // Light grayish-blue bg for active, dark text
                : 'text-slate-400 hover:bg-[#1e293b] hover:text-slate-200'
            }`}>
              <item.icon className={`w-5 h-5 ${active ? 'text-[#1e293b]' : 'text-slate-400'}`} />
              <span className="text-sm">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0f172a] text-slate-300 fixed inset-y-0 z-10 shadow-xl border-r border-[#1e293b]">
        {/* Logo */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <Activity className="text-[#0f172a] w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white tracking-tight leading-none">CapitalFlow</h1>
              <p className="text-[11px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">Tài chính Doanh nghiệp</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-8 custom-scrollbar">
          {renderNavItems(MENU_TOP)}
          <div className="mt-auto">
            {renderNavItems(MENU_BOTTOM)}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-20">
          {/* Mobile Menu Toggle & Logo */}
          <div className="md:hidden flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="text-slate-600">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-[#0f172a] flex items-center justify-center">
                <Activity className="text-white w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <form onSubmit={handleSearch} className="w-full relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="Tìm kiếm giao dịch, tài khoản..."
              />
            </form>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-4 md:gap-6 ml-auto">
            <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors hidden md:block">
              <HelpCircle className="w-5 h-5" />
            </button>
            
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
            
            <div className="flex items-center gap-3 cursor-pointer group relative">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-700 leading-none">{user.full_name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shadow-sm">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e0e7ff&color=4338ca`} alt="Avatar" />
              </div>

              {/* Simple dropdown for logout on hover */}
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto z-50">
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-slate-50 rounded-xl flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="fixed inset-y-0 left-0 w-64 bg-[#0f172a] z-50 flex flex-col shadow-2xl md:hidden text-slate-300"
              >
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                      <Activity className="text-[#0f172a] w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg text-white">CapitalFlow</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-8">
                  {renderNavItems(MENU_TOP)}
                  <div className="mt-auto">
                    {renderNavItems(MENU_BOTTOM)}
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <div className="flex-1 p-6 lg:p-10 w-full relative">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="max-w-[1400px] mx-auto w-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
