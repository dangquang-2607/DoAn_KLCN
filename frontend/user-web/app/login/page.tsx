'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion';
import api from '@/lib/api';
import {
  Activity, Shield, Zap, Eye, EyeOff, CheckCircle2,
  AlertCircle, ArrowRight, Lock, Mail, User as UserIcon,
  KeyRound, Sparkles, Check, X, Fingerprint, Landmark,
  RotateCw, UserPlus, LogIn, TrendingUp, Layers, PieChart, ShieldCheck
} from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Field Error Helper ────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-[12px] text-rose-600 mt-1.5 flex items-center gap-1.5 font-semibold"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
      <span>{msg}</span>
    </motion.p>
  );
}

// ─── Stagger Variants for Form Content ─────────────────────────────────────────
const formFadeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.25, 1, 0.5, 1],
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

const formItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 24,
    },
  },
};

export default function LoginPage() {
  const router = useRouter();

  // ── Tab state (true = Login, false = Register)
  const [isLogin, setIsLogin] = useState(true);

  // ── Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState('');
  const [loginPassError, setLoginPassError] = useState('');
  const [loginRemember, setLoginRemember] = useState(true);

  // ── Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [showRegisterPass, setShowRegisterPass] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [regNameError, setRegNameError] = useState('');
  const [regEmailError, setRegEmailError] = useState('');
  const [regPassError, setRegPassError] = useState('');
  const [regConfirmError, setRegConfirmError] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // ── Global status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // ── Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotResendCountdown, setForgotResendCountdown] = useState(0);

  // ── First-time password modal
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [firstTimePass, setFirstTimePass] = useState('');
  const [firstTimeConfirmPass, setFirstTimeConfirmPass] = useState('');
  const [showFirstTimePass, setShowFirstTimePass] = useState(false);
  const [firstTimeError, setFirstTimeError] = useState('');
  const [firstTimeLoading, setFirstTimeLoading] = useState(false);
  const [firstTimeSuccess, setFirstTimeSuccess] = useState(false);

  // ── Brute-force lockout (client-side)
  const [failCount, setFailCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem('user_fail_count') || '0', 10);
  });
  const [lockUntil, setLockUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem('user_lock_until') || '0', 10);
  });
  const [remainingLockSec, setRemainingLockSec] = useState(0);

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 600);
  };

  const clearErrors = () => {
    setError('');
    setLoginEmailError('');
    setLoginPassError('');
    setRegNameError('');
    setRegEmailError('');
    setRegPassError('');
    setRegConfirmError('');
  };

  const switchTab = (toLogin: boolean) => {
    if (toLogin === isLogin) return;
    clearErrors();
    setIsLogin(toLogin);
  };

  // ── Lockout countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockUntil > now) {
        setRemainingLockSec(Math.ceil((lockUntil - now) / 1000));
      } else {
        setRemainingLockSec(0);
        if (lockUntil > 0) {
          setLockUntil(0);
          setFailCount(0);
          sessionStorage.removeItem('user_fail_count');
          sessionStorage.removeItem('user_lock_until');
        }
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // ── OTP Resend countdown timer
  useEffect(() => {
    if (forgotResendCountdown <= 0) return;
    const timer = setInterval(() => {
      setForgotResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotResendCountdown]);

  // ── 3D Interactive Parallax Mouse Physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 120 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-300, 300], [3.5, -3.5]);
  const rotateY = useTransform(smoothMouseX, [-300, 300], [-3.5, 3.5]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // ── Password Strength Calculator
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const regPassStrength = getPasswordStrength(registerPassword);
  const getStrengthLabel = (score: number) => {
    if (score <= 1) return { text: 'Rất yếu', color: 'bg-rose-500', textColor: 'text-rose-600' };
    if (score === 2) return { text: 'Yếu', color: 'bg-amber-500', textColor: 'text-amber-600' };
    if (score === 3) return { text: 'Trung bình', color: 'bg-blue-500', textColor: 'text-blue-600' };
    if (score === 4) return { text: 'Mạnh', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
    return { text: 'Rất an toàn', color: 'bg-emerald-600', textColor: 'text-emerald-600' };
  };

  // ── Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingLockSec > 0) return;

    let hasErr = false;
    setLoginEmailError('');
    setLoginPassError('');
    setError('');

    if (!loginEmail.trim()) {
      setLoginEmailError('Vui lòng nhập email');
      hasErr = true;
    } else if (!isValidEmail(loginEmail)) {
      setLoginEmailError('Email không hợp lệ (ví dụ: name@domain.com)');
      hasErr = true;
    }
    if (!loginPassword) {
      setLoginPassError('Vui lòng nhập mật khẩu');
      hasErr = true;
    }

    if (hasErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      // Backend expects JSON: { email, password }
      const res = await api.post('/auth/login', {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      const { access_token, refresh_token, must_change_password } = res.data;

      // Store tokens for session & remember me
      sessionStorage.setItem('user_access_token', access_token);
      if (refresh_token) sessionStorage.setItem('user_refresh_token', refresh_token);
      
      if (loginRemember) {
        localStorage.setItem('user_access_token', access_token);
        if (refresh_token) localStorage.setItem('user_refresh_token', refresh_token);
      }

      // Fetch user profile from /auth/me
      try {
        const meRes = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        sessionStorage.setItem('user', JSON.stringify(meRes.data));
        if (loginRemember) localStorage.setItem('user', JSON.stringify(meRes.data));
      } catch (_) {}

      // Reset brute-force lockout
      setFailCount(0);
      setLockUntil(0);
      sessionStorage.removeItem('user_fail_count');
      sessionStorage.removeItem('user_lock_until');

      // Check first-time setup password
      if (must_change_password) {
        setShowFirstTimeModal(true);
        setLoading(false);
        return;
      }

      setSuccessToast('Đăng nhập thành công! Đang chuyển hướng...');
      setTimeout(() => {
        router.push('/');
      }, 700);
    } catch (err: any) {
      triggerShake();
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 400 || status === 401) {
        const nextFail = failCount + 1;
        setFailCount(nextFail);
        sessionStorage.setItem('user_fail_count', String(nextFail));

        if (nextFail >= MAX_ATTEMPTS) {
          const lockedTime = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockUntil(lockedTime);
          sessionStorage.setItem('user_lock_until', String(lockedTime));
          setError(`Bạn đã nhập sai ${MAX_ATTEMPTS} lần liên tiếp. Tài khoản bị tạm khóa 30 giây để bảo vệ an toàn.`);
        } else {
          setError(
            typeof detail === 'string'
              ? detail
              : `Email hoặc mật khẩu không chính xác! (Còn ${MAX_ATTEMPTS - nextFail} lần thử)`
          );
        }
      } else if (status === 403) {
        setError(typeof detail === 'string' ? detail : 'Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasErr = false;
    setRegNameError('');
    setRegEmailError('');
    setRegPassError('');
    setRegConfirmError('');
    setError('');

    if (!registerName.trim()) {
      setRegNameError('Vui lòng nhập họ và tên của bạn');
      hasErr = true;
    }
    if (!registerEmail.trim()) {
      setRegEmailError('Vui lòng nhập địa chỉ email');
      hasErr = true;
    } else if (!isValidEmail(registerEmail)) {
      setRegEmailError('Email không hợp lệ');
      hasErr = true;
    }
    if (!registerPassword) {
      setRegPassError('Vui lòng tạo mật khẩu');
      hasErr = true;
    } else if (registerPassword.length < 6) {
      setRegPassError('Mật khẩu phải có ít nhất 6 ký tự');
      hasErr = true;
    }
    if (registerPassword !== registerConfirm) {
      setRegConfirmError('Mật khẩu xác nhận không khớp');
      hasErr = true;
    }
    if (!agreeTerms) {
      setError('Vui lòng đồng ý với Điều khoản & Chính sách bảo mật');
      hasErr = true;
    }

    if (hasErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: registerName.trim(),
        email: registerEmail.trim().toLowerCase(),
        password: registerPassword,
      });

      setSuccessToast('Tạo tài khoản thành công! Đang chuyển sang màn hình đăng nhập...');
      setTimeout(() => {
        setLoginEmail(registerEmail.trim());
        setLoginPassword(registerPassword);
        switchTab(true);
        setSuccessToast('');
      }, 1200);
    } catch (err: any) {
      triggerShake();
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  // ── Send Forgot OTP
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !isValidEmail(forgotEmail)) {
      setForgotError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setForgotStep(2);
      setForgotResendCountdown(60);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setForgotError(typeof detail === 'string' ? detail : 'Không tìm thấy tài khoản với email này.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Reset Password with OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      setForgotError('Vui lòng nhập mã OTP 6 số');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('Mật khẩu mới phải từ 6 ký tự');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/auth/reset-password', {
        email: forgotEmail.trim().toLowerCase(),
        otp_code: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });
      setForgotStep(3);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setForgotError(typeof detail === 'string' ? detail : 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Handle First-Time Setup Password
  const handleFirstTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstTimePass || firstTimePass.length < 6) {
      setFirstTimeError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (firstTimePass !== firstTimeConfirmPass) {
      setFirstTimeError('Xác nhận mật khẩu không khớp');
      return;
    }

    setFirstTimeLoading(true);
    setFirstTimeError('');
    try {
      await api.post('/auth/first-time-password', { new_password: firstTimePass.trim() });
      setFirstTimeSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setFirstTimeError(typeof detail === 'string' ? detail : 'Đổi mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setFirstTimeLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="min-h-screen bg-[#F8FAFC] text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white"
    >
      {/* ── Dynamic Ambient Mesh Gradients (Cobalt Light) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[25%] -left-[15%] w-[650px] h-[650px] rounded-full bg-blue-100/70 blur-[130px]" />
        <div className="absolute -bottom-[25%] -right-[15%] w-[700px] h-[700px] rounded-full bg-indigo-100/60 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-sky-50/50 blur-[100px]" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* ── Success Toast ── */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center gap-3 border border-emerald-400/30 text-sm font-semibold"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3D Floating Master Container (Option A: Split Sliding Layout) ── */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          perspective: 1400,
        }}
        className={`w-full max-w-5xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-[32px] shadow-[0_24px_60px_-15px_rgba(30,58,138,0.14),0_10px_30px_-10px_rgba(0,0,0,0.04)] overflow-hidden relative z-10 transition-shadow duration-500 ${
          isShake ? 'animate-shake' : ''
        }`}
      >
        <div className="flex flex-col lg:flex-row relative min-h-[660px]">
          
          {/* ══════════════════════════════════════════════════════════════════════
              PANEL 1: Showcase Panel (Slides Left <-> Right: 0% <-> 140%)
              ══════════════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={false}
            animate={{
              x: isLogin ? '0%' : '140%',
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 25,
              mass: 0.8,
            }}
            className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-10 flex-col justify-between relative overflow-hidden text-white z-20 shadow-2xl"
          >
            {/* Ambient orb & glass highlights */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-400/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />
            
            {/* Header / Brand */}
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg shadow-black/10">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-1.5">
                    CapitalFlow
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-blue-100">
                      AI 3D
                    </span>
                  </span>
                  <p className="text-xs text-blue-100/80 font-medium">Hệ sinh thái quản trị tài chính đa kênh</p>
                </div>
              </div>

              {/* Dynamic Content Morphing with AnimatePresence */}
              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.div
                    key="showcase-login"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.28 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-semibold text-blue-100 backdrop-blur-md shadow-sm">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Chào mừng quay trở lại</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
                      Nắm bắt dòng tiền, <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-sky-100 to-white">
                        Kiến tạo tương lai.
                      </span>
                    </h2>
                    <p className="text-sm text-blue-100/85 leading-relaxed">
                      Theo dõi chi tiêu thời gian thực, quét hóa đơn bằng AI OCR và nhận báo cáo ngân sách tự động chỉ với 1 cú click.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="showcase-register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.28 }}
                    className="space-y-4"
                  >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-xs font-semibold text-emerald-200 backdrop-blur-md shadow-sm">
                      <Zap className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Miễn phí 100% trải nghiệm</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
                      Khởi đầu tự do tài chính, <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-100 to-white">
                        Thông minh & An toàn.
                      </span>
                    </h2>
                    <p className="text-sm text-blue-100/85 leading-relaxed">
                      Thiết lập tài khoản trong 30 giây để kích hoạt AI phân tích danh mục, quản lý đa ví và bảo mật dữ liệu chuẩn ngân hàng.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3D Floating Feature Badge */}
            <div className="relative z-10 my-6">
              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.div
                    key="badge-login"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.28 }}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl space-y-3 shadow-xl"
                  >
                    <div className="flex items-center justify-between text-xs text-blue-100">
                      <span className="font-semibold flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-300" /> Hiệu suất ngân sách
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                        +24.8% Tiết kiệm
                      </span>
                    </div>
                    <div className="w-full bg-white/15 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '76%' }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-blue-200/80 pt-1">
                      <span>OCR Hóa đơn AI: Hoạt động</span>
                      <span>Bảo mật 2 lớp: Bật</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="badge-register"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.28 }}
                    className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl space-y-3 shadow-xl"
                  >
                    <div className="flex items-center justify-between text-xs text-blue-100">
                      <span className="font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-sky-300" /> Đặc quyền thành viên
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-sky-200 text-[11px] font-bold">
                        Trọn đời
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-100/90 pt-1">
                      <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
                        <Check className="w-3.5 h-3.5 text-emerald-300" /> Không giới hạn ví
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg">
                        <Check className="w-3.5 h-3.5 text-emerald-300" /> Quét ảnh tự động
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Trust Markers */}
            <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100/70 font-medium">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-300" /> Mã hóa AES-256
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-sky-300" /> Liên kết 20+ Ngân hàng
              </span>
            </div>
          </motion.div>

          {/* ══════════════════════════════════════════════════════════════════════
              PANEL 2: Form Panel (Slides Right <-> Left: 0% <-> -71.428%)
              ══════════════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={false}
            animate={{
              x: isLogin ? '0%' : '-71.4285%',
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 25,
              mass: 0.8,
            }}
            className="w-full lg:w-7/12 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white relative z-10"
          >
            
            {/* ── Top Floating Segmented Tab Switcher ── */}
            <div className="flex items-center justify-between mb-8">
              {/* Segmented Control Pill with Fluid Layout Indicator */}
              <div className="relative p-1 bg-slate-100/90 border border-slate-200/80 rounded-2xl flex items-center shadow-inner max-w-xs w-full">
                <button
                  type="button"
                  onClick={() => switchTab(true)}
                  className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 z-10 ${
                    isLogin ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng Nhập</span>
                  {isLogin && (
                    <motion.div
                      layoutId="activeTabIndicatorA"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/60 -z-10"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchTab(false)}
                  className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 z-10 ${
                    !isLogin ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng Ký</span>
                  {!isLogin && (
                    <motion.div
                      layoutId="activeTabIndicatorA"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/60 -z-10"
                    />
                  )}
                </button>
              </div>

              {/* Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Hệ thống ổn định</span>
              </div>
            </div>

            {/* ── Global Alert Banner ── */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs sm:text-sm font-medium flex items-start gap-3 shadow-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-800">Thông báo từ hệ thống</p>
                    <p className="mt-0.5 leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={() => setError('')}
                    className="text-rose-400 hover:text-rose-700 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Option A: Form Swapping with Spring Motion ── */}
            <div className="relative min-h-[400px]">
              <AnimatePresence mode="wait">
                {isLogin ? (
                  /* ── FORM LOGIN ─────────────────────────────────────────── */
                  <motion.form
                    key="form-login-option-a"
                    variants={formFadeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleLogin}
                    className="space-y-5"
                  >
                    <motion.div variants={formItemVariants}>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Đăng nhập tài khoản
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Nhập thông tin xác thực để truy cập hệ sinh thái tài chính của bạn
                      </p>
                    </motion.div>

                    {/* Email Field */}
                    <motion.div variants={formItemVariants} className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Địa chỉ Email
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => {
                            setLoginEmail(e.target.value);
                            if (loginEmailError) setLoginEmailError('');
                          }}
                          placeholder="name@example.com"
                          disabled={loading || remainingLockSec > 0}
                          className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                            loginEmailError
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                          } disabled:opacity-50 disabled:bg-slate-100`}
                        />
                      </div>
                      <FieldError msg={loginEmailError} />
                    </motion.div>

                    {/* Password Field */}
                    <motion.div variants={formItemVariants} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Mật khẩu
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotModal(true);
                            setForgotStep(1);
                            setForgotError('');
                            if (loginEmail) setForgotEmail(loginEmail);
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all"
                        >
                          Quên mật khẩu?
                        </button>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showLoginPass ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value);
                            if (loginPassError) setLoginPassError('');
                          }}
                          placeholder="••••••••"
                          disabled={loading || remainingLockSec > 0}
                          className={`w-full pl-10 pr-11 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                            loginPassError
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                          } disabled:opacity-50 disabled:bg-slate-100`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPass(!showLoginPass)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <FieldError msg={loginPassError} />
                    </motion.div>

                    {/* Remember me & Auto Login */}
                    <motion.div variants={formItemVariants} className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={loginRemember}
                          onChange={(e) => setLoginRemember(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-600">Ghi nhớ đăng nhập trên thiết bị này</span>
                      </label>
                    </motion.div>

                    {/* Submit Button */}
                    <motion.div variants={formItemVariants} className="pt-2">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading || remainingLockSec > 0}
                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {loading ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin text-white" />
                            <span>Đang xác thực thông tin...</span>
                          </>
                        ) : remainingLockSec > 0 ? (
                          <>
                            <Lock className="w-4 h-4 text-amber-300" />
                            <span>Tạm khóa (Thử lại sau {remainingLockSec}s)</span>
                          </>
                        ) : (
                          <>
                            <span>Đăng nhập ngay</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>

                    {/* Switch to Register callout */}
                    <motion.div variants={formItemVariants} className="pt-3 text-center border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        Chưa có tài khoản CapitalFlow?{' '}
                        <button
                          type="button"
                          onClick={() => switchTab(false)}
                          className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                          Đăng ký miễn phí ngay
                        </button>
                      </p>
                    </motion.div>
                  </motion.form>
                ) : (
                  /* ── FORM REGISTER ──────────────────────────────────────── */
                  <motion.form
                    key="form-register-option-a"
                    variants={formFadeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleRegister}
                    className="space-y-4"
                  >
                    <motion.div variants={formItemVariants}>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Tạo tài khoản mới
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Trải nghiệm quản trị tài chính cá nhân thế hệ mới hoàn toàn miễn phí
                      </p>
                    </motion.div>

                    {/* Full Name */}
                    <motion.div variants={formItemVariants} className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Họ và tên
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={registerName}
                          onChange={(e) => {
                            setRegisterName(e.target.value);
                            if (regNameError) setRegNameError('');
                          }}
                          placeholder="Nguyễn Văn A"
                          disabled={loading}
                          className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                            regNameError
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                          }`}
                        />
                      </div>
                      <FieldError msg={regNameError} />
                    </motion.div>

                    {/* Email */}
                    <motion.div variants={formItemVariants} className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Email đăng ký
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={registerEmail}
                          onChange={(e) => {
                            setRegisterEmail(e.target.value);
                            if (regEmailError) setRegEmailError('');
                          }}
                          placeholder="name@example.com"
                          disabled={loading}
                          className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                            regEmailError
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                          }`}
                        />
                      </div>
                      <FieldError msg={regEmailError} />
                    </motion.div>

                    {/* Password & Confirm Grid */}
                    <motion.div variants={formItemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Password */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Mật khẩu
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showRegisterPass ? 'text' : 'password'}
                            value={registerPassword}
                            onChange={(e) => {
                              setRegisterPassword(e.target.value);
                              if (regPassError) setRegPassError('');
                            }}
                            placeholder="Ít nhất 6 ký tự"
                            disabled={loading}
                            className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                              regPassError
                                ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                              : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPass(!showRegisterPass)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showRegisterPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <FieldError msg={regPassError} />
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Xác nhận
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showRegisterConfirm ? 'text' : 'password'}
                            value={registerConfirm}
                            onChange={(e) => {
                              setRegisterConfirm(e.target.value);
                              if (regConfirmError) setRegConfirmError('');
                            }}
                            placeholder="Nhập lại mật khẩu"
                            disabled={loading}
                            className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border transition-all duration-200 outline-none shadow-sm ${
                              regConfirmError
                                ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                                : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterConfirm(!showRegisterConfirm)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            {showRegisterConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <FieldError msg={regConfirmError} />
                      </div>
                    </motion.div>

                    {/* Password Strength Indicator */}
                    {registerPassword && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1 pt-0.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Độ mạnh mật khẩu:</span>
                          <span className={`font-bold ${getStrengthLabel(regPassStrength).textColor}`}>
                            {getStrengthLabel(regPassStrength).text}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <div
                              key={lvl}
                              className={`h-full rounded-full transition-colors duration-300 ${
                                regPassStrength >= lvl
                                  ? getStrengthLabel(regPassStrength).color
                                  : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Terms Agreement */}
                    <motion.div variants={formItemVariants} className="pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                        />
                        <span className="text-xs text-slate-600 leading-snug">
                          Tôi đồng ý với{' '}
                          <a href="#" className="font-semibold text-blue-600 hover:underline">
                            Điều khoản dịch vụ
                          </a>{' '}
                          và{' '}
                          <a href="#" className="font-semibold text-blue-600 hover:underline">
                            Chính sách quyền riêng tư
                          </a>
                        </span>
                      </label>
                    </motion.div>

                    {/* Register Submit Button */}
                    <motion.div variants={formItemVariants} className="pt-2">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        {loading ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin text-white" />
                            <span>Đang khởi tạo tài khoản...</span>
                          </>
                        ) : (
                          <>
                            <span>Tạo tài khoản CapitalFlow</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>

                    {/* Switch to Login callout */}
                    <motion.div variants={formItemVariants} className="pt-2 text-center border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        Đã có tài khoản CapitalFlow?{' '}
                        <button
                          type="button"
                          onClick={() => switchTab(true)}
                          className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                          Đăng nhập tại đây
                        </button>
                      </p>
                    </motion.div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 1: Forgot Password OTP Reset
          ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Khôi phục mật khẩu</h3>
                    <p className="text-xs text-slate-500">Bước {forgotStep} trên 3</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Error */}
              {forgotError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2 border border-rose-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Step 1: Request OTP */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendForgotOtp} className="mt-5 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi sẽ gửi mã OTP 6 số để xác thực bảo mật.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? (
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

              {/* Step 2: Enter OTP & New Password */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
                  <p className="text-xs text-slate-600">
                    Mã xác thực đã được gửi tới <strong className="text-slate-900">{forgotEmail}</strong>. Vui lòng kiểm tra hòm thư của bạn.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Mã OTP (6 chữ số)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
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
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
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
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <RotateCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Cập nhật mật khẩu mới</span>
                    )}
                  </button>
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      disabled={forgotResendCountdown > 0 || forgotLoading}
                      onClick={handleSendForgotOtp}
                      className="text-xs text-blue-600 hover:underline disabled:text-slate-400 font-semibold"
                    >
                      {forgotResendCountdown > 0
                        ? `Gửi lại mã OTP sau ${forgotResendCountdown}s`
                        : 'Chưa nhận được mã? Gửi lại ngay'}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Success Confirmation */}
              {forgotStep === 3 && (
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
                    onClick={() => {
                      setShowForgotModal(false);
                      setLoginEmail(forgotEmail);
                      setLoginPassword('');
                      switchTab(true);
                    }}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
                  >
                    Quay lại Đăng nhập ngay
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL 2: First-time Password Setup Modal
          ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFirstTimeModal && (
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
                  <h3 className="text-lg font-bold text-slate-900">Thiết lập mật khẩu lần đầu</h3>
                  <p className="text-xs text-slate-500">Bảo mật tài khoản trước khi tiếp tục</p>
                </div>
              </div>

              {firstTimeError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2 border border-rose-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{firstTimeError}</span>
                </div>
              )}

              {firstTimeSuccess ? (
                <div className="text-center py-4 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Đổi mật khẩu thành công!</p>
                  <p className="text-xs text-slate-500">Đang chuyển bạn vào trang Dashboard...</p>
                </div>
              ) : (
                <form onSubmit={handleFirstTimeSubmit} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Đây là lần đầu tiên bạn đăng nhập vào hệ thống. Vì lý do an toàn, vui lòng đổi mật khẩu mặc định sang mật khẩu riêng tư của bạn.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={firstTimePass}
                      onChange={(e) => setFirstTimePass(e.target.value)}
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
                      value={firstTimeConfirmPass}
                      onChange={(e) => setFirstTimeConfirmPass(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={firstTimeLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {firstTimeLoading ? (
                      <RotateCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Lưu mật khẩu & Vào Dashboard</span>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
