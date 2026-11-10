"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  Eye,
  EyeOff,
} from "lucide-react";

interface FirstTimePasswordModalProps {
  show: boolean;
  password: string;
  confirmPassword: string;
  loading: boolean;
  error: string;
  success: boolean;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

// Modal chỉ thu thập dữ liệu; page cha gọi API và hủy phiên tạm sau khi đổi thành công.
export default function FirstTimePasswordModal({
  show,
  password,
  confirmPassword,
  loading,
  error,
  success,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}: FirstTimePasswordModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-[6px] p-6 sm:p-8 shadow-lg border border-slate-100 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Thiết lập mật khẩu lần đầu
                </h3>
                <p className="text-xs text-slate-500">
                  Bảo mật tài khoản trước khi tiếp tục
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-[6px] bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  Đổi mật khẩu thành công!
                </p>
                <p className="text-xs text-slate-500">
                  Vui lòng đăng nhập lại bằng mật khẩu mới.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đây là lần đầu tiên bạn đăng nhập vào hệ thống. Vì lý do an
                  toàn, vui lòng đổi mật khẩu mặc định sang mật khẩu riêng của
                  bạn.
                </p>
                <div className="space-y-1.5">
                  <label
                    htmlFor="first-time-password"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    {" "}
                    Mật khẩu mới{" "}
                  </label>
                  <div className="relative">
                    <input
                      id="first-time-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border border-slate-200 focus:border-blue-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={
                        showPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"
                      }
                      aria-controls="first-time-password"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="first-time-confirm-password"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    {" "}
                    Xác nhận mật khẩu mới{" "}
                  </label>
                  <div className="relative">
                    <input
                      id="first-time-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => onConfirmChange(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border border-slate-200 focus:border-blue-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Ẩn xác nhận mật khẩu mới"
                          : "Hiện xác nhận mật khẩu mới"
                      }
                      aria-controls="first-time-confirm-password"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Lưu mật khẩu</span>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
