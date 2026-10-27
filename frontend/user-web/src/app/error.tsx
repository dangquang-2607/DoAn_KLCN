'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi nhận lỗi runtime vào console hoặc logging service
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100">
          <AlertTriangle size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800">Đã xảy ra sự cố</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Hệ thống gặp sự cố ngoài dự kiến trong khi tải màn hình. Dữ liệu tài chính của bạn vẫn an toàn.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <RotateCcw size={16} />
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Home size={16} />
            Trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
