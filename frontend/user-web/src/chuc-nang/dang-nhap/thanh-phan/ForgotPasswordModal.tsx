/**
 * ============================================================================
 * TÊN FILE: ForgotPasswordModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập / Đăng ký
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối các bước gửi OTP và đặt lại mật khẩu.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất ForgotPasswordModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
﻿'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, X, Mail, RotateCw, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordModalProps {
  show: boolean;
  step: number;
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  resendCountdown: number;
  onClose: () => void;
  onEmailChange: (v: string) => void;
  onOtpChange: (v: string) => void;
  onNewPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onSendOtp: (e: React.FormEvent) => void;
  onResetPassword: (e: React.FormEvent) => void;
  onResend: () => void;
  onGoToLogin: () => void;
}

export default function ForgotPasswordModal({
  show,
  step,
  email,
  otp,
  newPassword,
  confirmPassword,
  loading,
  error,
  resendCountdown,
  onClose,
  onEmailChange,
  onOtpChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSendOtp,
  onResetPassword,
  onResend,
  onGoToLogin,
}: ForgotPasswordModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
          >
            {/* Đầu modal khôi phục mật khẩu. */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Khôi phục mật khẩu</h3>
                  <p className="text-xs text-slate-500">Bước {step} trên 3</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thông báo lỗi của bước hiện tại. */}
            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                {error}
              </div>
            )}

            {/* Bước 1: Nhập email nhận OTP. */}
            {step === 1 && (
              <form onSubmit={onSendOtp} className="mt-5 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi sẽ gửi mã OTP 6 số để xác thực bảo mật.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Địa chỉ email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Gửi mã xác thực OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Bước 2: Nhập OTP và mật khẩu mới. */}
            {step === 2 && (
              <form onSubmit={onResetPassword} className="mt-5 space-y-4">
                <p className="text-xs text-slate-600">
                  Mã xác thực đã được gửi tới <strong className="text-slate-900">{email}</strong>. Vui lòng kiểm tra hộp thư.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mã OTP (6 chữ số)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => onOtpChange(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.4em] font-mono text-lg font-bold py-2.5 bg-slate-50 focus:bg-white text-slate-900 rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => onConfirmPasswordChange(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Cập nhật mật khẩu mới</span>
                  )}
                </button>
                <div className="text-center pt-1">
                  <button
                    type="button"
                    disabled={resendCountdown > 0 || loading}
                    onClick={() => onResend()}
                    className="text-xs text-blue-600 hover:underline disabled:text-slate-400 font-semibold"
                  >
                    {resendCountdown > 0
                      ? `Gửi lại mã OTP sau ${resendCountdown}s`
                      : 'Chưa nhận được mã? Gửi lại ngay'}
                  </button>
                </div>
              </form>
            )}

            {/* Bước 3: Thông báo đặt lại mật khẩu thành công. */}
            {step === 3 && (
              <div className="mt-6 text-center space-y-4 py-2">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Đặt lại mật khẩu thành công!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Mật khẩu của bạn đã được cập nhật an toàn. Hãy sử dụng mật khẩu mới để đăng nhập.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  Quay lại đăng nhập ngay
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
