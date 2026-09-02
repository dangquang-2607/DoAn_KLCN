'use client';

import { Settings, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Cài đặt</h1>
          <p className="text-slate-500 mt-1">Tùy chỉnh tài khoản và cấu hình hệ thống của bạn.</p>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Save className="w-4 h-4" /> Lưu thay đổi
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Tính năng đang được phát triển</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Trang cài đặt hệ thống chi tiết đang được chúng tôi xây dựng và sẽ sớm ra mắt trong phiên bản tiếp theo.
        </p>
      </div>
    </div>
  );
}
