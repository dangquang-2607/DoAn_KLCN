'use client';

import { Layers, Plus } from 'lucide-react';

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Danh mục</h1>
          <p className="text-slate-500 mt-1">Quản lý và tùy chỉnh các danh mục thu chi của bạn.</p>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Thêm Danh mục
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Tính năng đang được phát triển</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Trang quản lý danh mục chi tiết đang được chúng tôi xây dựng và sẽ sớm ra mắt trong phiên bản tiếp theo.
        </p>
      </div>
    </div>
  );
}
