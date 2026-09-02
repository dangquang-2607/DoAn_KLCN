'use client';

import { HelpCircle, Mail } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hỗ trợ</h1>
          <p className="text-slate-500 mt-1">Trung tâm trợ giúp và liên hệ hỗ trợ khách hàng.</p>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Mail className="w-4 h-4" /> Gửi Yêu cầu
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <HelpCircle className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Tính năng đang được phát triển</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Trung tâm hỗ trợ khách hàng đang được hoàn thiện. Vui lòng quay lại sau hoặc liên hệ trực tiếp qua email: support@capitalflow.vn
        </p>
      </div>
    </div>
  );
}
