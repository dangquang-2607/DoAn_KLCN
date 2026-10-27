import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100">
          <FileQuestion size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-800">Không tìm thấy trang (404)</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển sang vị trí mới.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
            Về không gian chính
          </Link>
        </div>
      </div>
    </main>
  );
}
