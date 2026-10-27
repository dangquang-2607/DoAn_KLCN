/**
 * ============================================================================
 * TÊN FILE: error.tsx
 * MÀN HÌNH / PHÂN HỆ: Xử lý lỗi toàn cục (Global Error Boundary)
 * NHÓM VỆ TINH: app (Next.js Error Handler)
 * MỤC ĐÍCH CỤ THỂ:
 *   Bắt và hiển thị giao diện thông báo lỗi thân thiện khi xảy ra lỗi runtime ngoài ý muốn
 *   ở cấp độ client, ngăn chặn ứng dụng bị crash trắng màn hình.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props error (chứa chi tiết lỗi và mã digest) và hàm reset() để thử tải lại.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Component GlobalError hiển thị hộp thoại cảnh báo và nút thao tác khôi phục.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không để lộ stack trace nhạy cảm ra giao diện người dùng; bảo vệ dữ liệu tài chính.
 * ============================================================================
 */
'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Component hiển thị màn hình báo lỗi runtime toàn cục của ứng dụng.
 * 
 * @param error - Đối tượng lỗi runtime kèm mã định danh sự cố (digest).
 * @param reset - Hàm đặt lại ranh giới lỗi để thử khôi phục render giao diện.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi nhận lỗi runtime vào console hoặc logging service phục vụ giám sát
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
