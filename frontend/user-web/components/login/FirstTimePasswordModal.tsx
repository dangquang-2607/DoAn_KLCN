'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';

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
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Thiet lap mat khau lan dau</h3>
                <p className="text-xs text-slate-500">Bao mat tai khoan truoc khi tiep tuc</p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="text-center py-4 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Doi mat khau thanh cong!</p>
                <p className="text-xs text-slate-500">Dang chuyen ban vao trang Dashboard...</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Day la lan dau tien ban dang nhap vao he thong. Vi ly do an toan, vui long doi mat khau mac dinh sang mat khau rieng tu cua ban.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mat khau moi
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder="Toi thieu 6 ky tu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Xac nhan mat khau moi
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => onConfirmChange(e.target.value)}
                    placeholder="Nhap lai mat khau moi"
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
                    <span>Luu mat khau & Vao Dashboard</span>
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