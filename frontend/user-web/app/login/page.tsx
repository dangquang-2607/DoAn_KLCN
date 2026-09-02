'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { Activity, Mail, Lock, User, Zap, Shield, Star, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

// ─── Sub-components (khai báo bên ngoài component chính — đây là pattern chuẩn React) ───
function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5 ml-0.5">
      <AlertCircle className="w-3 h-3 flex-shrink-0" /> {msg}
    </p>
  );
}

function SocialButtons() {
  return (
    <div className="flex gap-4 mt-4">
      <button type="button" className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Google
      </button>
      <button type="button" className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.74 3.58-.79 1.56-.05 2.88.69 3.65 1.91-3.14 1.77-2.63 5.75.46 6.94-.74 1.83-1.63 3.33-2.77 4.11zm-3.66-14.2c.5-1.7.9-2.73 1.97-4.08-1.55.13-3.17 1.05-4.14 2.59-.72 1.14-1.22 2.65-.96 4.08 1.72.09 3.06-.77 3.13-2.59z"/></svg>
        Apple
      </button>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30; // 30 giây (test) — đổi lại thành 15 * 60 khi production

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isValidEmail(val: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { score: 1, label: 'Rất yếu', color: '#ef4444' };
  if (score === 2) return { score: 2, label: 'Yếu', color: '#f97316' };
  if (score === 3) return { score: 3, label: 'Trung bình', color: '#eab308' };
  if (score === 4) return { score: 4, label: 'Mạnh', color: '#22c55e' };
  return { score: 5, label: 'Rất mạnh', color: '#10b981' };
}

function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  // ── Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState('');

  // ── Register State
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Field-level errors for register
  const [regNameError, setRegNameError] = useState('');
  const [regEmailError, setRegEmailError] = useState('');
  const [regPassError, setRegPassError] = useState('');
  const [regConfirmError, setRegConfirmError] = useState('');

  // ── Global state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // ── Brute-force (client-side)
  const [failCount, setFailCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem('user_fail_count') || '0', 10);
  });
  const [lockUntil, setLockUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem('user_lock_until') || '0', 10);
  });
  const [countdown, setCountdown] = useState(() => {
    // Khởi tạo countdown ngay khi load trang (nếu đang bị khóa)
    if (typeof window === 'undefined') return 0;
    const until = parseInt(sessionStorage.getItem('user_lock_until') || '0', 10);
    return until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
  });

  const loginEmailRef = useRef<HTMLInputElement>(null);
  const registerNameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ─── Lockout countdown (dùng useEffect để hoạt động cả khi reload trang) ──────────
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdown(0);
        setLockUntil(0);
        setFailCount(0);
        setError('');
        sessionStorage.removeItem('user_lock_until');
        sessionStorage.removeItem('user_fail_count');
      } else {
        setCountdown(remaining);
      }
    };
    tick(); // chạy ngay lập tức
    const id = setInterval(tick, 1000);
    return () => clearInterval(id); // cleanup khi lockUntil thay đổi
  }, [lockUntil]);

  // dùng countdown > 0 thay vì Date.now() để tránh gọi hàm impure trong render
  const isLocked = countdown > 0;

  // ─── Shake + focus ────────────────────────────────────────────────────────
  const triggerShake = (ref?: React.RefObject<HTMLInputElement | null>) => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
    if (ref) setTimeout(() => ref.current?.focus(), 100);
  };

  // ─── Brute-force handler ──────────────────────────────────────────────────
  const handleFailedAttempt = (count: number, msg: string) => {
    const newCount = count;
    setFailCount(newCount);
    sessionStorage.setItem('user_fail_count', String(newCount));

    if (newCount >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockUntil(until);
      sessionStorage.setItem('user_lock_until', String(until));
      setError(`Bạn đã nhập sai ${MAX_ATTEMPTS} lần. Tài khoản tạm thời bị khóa ${LOCKOUT_SECONDS} giây.`);
      setShowForgot(true);
      // không cần gọi startCountdown — useEffect tự khởi động khi lockUntil thay đổi
    } else {
      const remaining = MAX_ATTEMPTS - newCount;
      setError(`${msg} Còn ${remaining} lần thử trước khi tài khoản bị khóa.`);
      if (newCount >= 3) setShowForgot(true);
    }
    // Không focus vào ô — tránh onBlur xóa mất thông báo lỗi
    triggerShake();
  };

  // ─── Login handler ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Inline validation
    if (!isValidEmail(loginEmail)) {
      setLoginEmailError('Email không đúng định dạng.');
      triggerShake(loginEmailRef);
      return;
    }
    if (isLocked) { triggerShake(); return; }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email: loginEmail, password: loginPassword });
      const token = data.access_token;
      const meRes = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });

      if (meRes.data.is_banned) {
        setError('Tài khoản của bạn đã bị hạn chế. Vui lòng liên hệ support@capitalflow.vn để được hỗ trợ.');
        setShowForgot(false);
        triggerShake(); // không focus, thông báo ở lại mãi
        setLoading(false);
        return;
      }
      if (meRes.data.role.toUpperCase() === 'ADMIN') {
        // Thông báo chung – không tiết lộ role
        handleFailedAttempt(failCount + 1, 'Email hoặc mật khẩu không chính xác.');
        setLoading(false);
        return;
      }

      // Thành công
      sessionStorage.removeItem('user_fail_count');
      sessionStorage.removeItem('user_lock_until');
      sessionStorage.setItem('user_access_token', token);
      if (data.refresh_token) {
        sessionStorage.setItem('user_refresh_token', data.refresh_token);
      }
      router.push('/');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (!status || status >= 500) {
        setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.');
        triggerShake(loginEmailRef);
      } else {
        handleFailedAttempt(failCount + 1, 'Email hoặc mật khẩu không chính xác.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Register handler ─────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate tất cả fields trước
    let valid = true;
    if (!registerName.trim() || registerName.trim().length < 2) {
      setRegNameError('Họ tên cần ít nhất 2 ký tự.');
      valid = false;
    }
    if (!isValidEmail(registerEmail)) {
      setRegEmailError('Email không đúng định dạng.');
      valid = false;
    }
    const pwStrength = getPasswordStrength(registerPassword);
    if (registerPassword.length < 8) {
      setRegPassError('Mật khẩu cần ít nhất 8 ký tự.');
      valid = false;
    } else if (pwStrength.score < 3) {
      setRegPassError('Mật khẩu quá yếu. Hãy thêm chữ hoa, số hoặc ký tự đặc biệt.');
      valid = false;
    }
    if (registerPassword !== registerConfirm) {
      setRegConfirmError('Mật khẩu xác nhận không khớp.');
      valid = false;
    }
    if (!agreeTerms) {
      setError('Vui lòng đồng ý với Điều khoản & Chính sách để tiếp tục.');
      valid = false;
    }

    if (!valid) {
      triggerShake(registerNameRef);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/register', {
        email: registerEmail,
        password: registerPassword,
        full_name: registerName
      });
      const { data } = await api.post('/auth/login', { email: registerEmail, password: registerPassword });
      sessionStorage.setItem('user_access_token', data.access_token);
      router.push('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosErr.response?.status;
      if (!status || status >= 500) {
        setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.');
      } else if (status === 409 || axiosErr.response?.data?.detail?.toLowerCase().includes('exist')) {
        setRegEmailError('Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.');
      } else {
        setError(axiosErr.response?.data?.detail || 'Đăng ký thất bại. Vui lòng thử lại.');
      }
      triggerShake(registerNameRef);
    } finally {
      setLoading(false);
    }
  };

  // ─── Inline blurs register ────────────────────────────────────────────────
  const blurName = () => {
    if (!registerName.trim() || registerName.trim().length < 2)
      setRegNameError('Họ tên cần ít nhất 2 ký tự.');
    else setRegNameError('');
  };
  const blurRegEmail = () => {
    if (registerEmail && !isValidEmail(registerEmail))
      setRegEmailError('Email không đúng định dạng.');
    else setRegEmailError('');
  };
  const blurRegPass = () => {
    if (registerPassword && registerPassword.length < 8)
      setRegPassError('Mật khẩu cần ít nhất 8 ký tự.');
    else if (registerPassword && getPasswordStrength(registerPassword).score < 3)
      setRegPassError('Mật khẩu quá yếu. Hãy thêm chữ hoa, số hoặc ký tự đặc biệt.');
    else setRegPassError('');
  };
  const blurRegConfirm = () => {
    if (registerConfirm && registerPassword !== registerConfirm)
      setRegConfirmError('Mật khẩu xác nhận không khớp.');
    else setRegConfirmError('');
  };

  const pwStrength = getPasswordStrength(registerPassword);

  // ─── Input class helpers ──────────────────────────────────────────────────
  const getInputCls = (fieldErr: string, isPassword = false) =>
    `w-full pl-10 ${isPassword ? 'pr-12' : 'pr-4'} py-3 border rounded-xl outline-none transition-all text-sm ${
      fieldErr
        ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-400 text-red-900 placeholder:text-red-300'
        : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 text-slate-800'
    }`;

  const getLoginInputCls = (hasErr: boolean, isPassword = false) =>
    `w-full pl-10 ${isPassword ? 'pr-12' : 'pr-4'} py-3 border rounded-xl outline-none transition-all text-sm ${
      hasErr
        ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-400 text-red-900 placeholder:text-red-300'
        : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 text-slate-800'
    } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`;



  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="relative bg-white w-full max-w-5xl h-[820px] md:h-[750px] rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] overflow-hidden flex flex-col md:flex-row">

        {/* Sliding Panel */}
        <motion.div
          initial={false}
          animate={{ x: isLogin ? '0%' : '100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          className="hidden md:flex absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 z-30 flex-col items-center justify-center p-12 text-white overflow-hidden shadow-2xl"
          style={{
            borderTopRightRadius: isLogin ? '0px' : '30px',
            borderBottomRightRadius: isLogin ? '0px' : '30px',
            borderTopLeftRadius: isLogin ? '30px' : '0px',
            borderBottomLeftRadius: isLogin ? '30px' : '0px',
            clipPath: isLogin ? 'polygon(0 0, 100% 0, 90% 100%, 0% 100%)' : 'polygon(10% 0, 100% 0, 100% 100%, 0% 100%)'
          }}
        >
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20"></div>
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div key="login-content" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }} className="relative z-10 text-left w-full pl-4">
                <h2 className="text-4xl font-extrabold mb-4 leading-tight">Chào Mừng<br/>Trở Lại!</h2>
                <p className="text-purple-100 mb-12 max-w-sm text-sm">Đăng nhập để tiếp tục quản lý tài chính doanh nghiệp của bạn một cách tối ưu nhất.</p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Activity className="w-6 h-6" /></div>
                    <div><h4 className="font-semibold">Phân tích chuyên sâu</h4><p className="text-xs text-purple-200">Nắm bắt mọi dòng tiền</p></div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="register-content" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="relative z-10 text-left w-full pl-12">
                <h2 className="text-4xl font-extrabold mb-4 leading-tight">Tạo Tài Khoản<br/>Hôm Nay!</h2>
                <p className="text-purple-100 mb-10 max-w-sm text-sm">Tham gia cùng hàng nghìn người dùng và mở khóa tiềm năng vô hạn.</p>
                <div className="space-y-5">
                  {[{ icon: <Zap className="w-5 h-5 text-yellow-300"/>, title: 'Nhanh & Bảo mật', sub: 'Dữ liệu luôn được bảo vệ' },
                    { icon: <Shield className="w-5 h-5 text-emerald-300"/>, title: 'Dễ Dàng Sử Dụng', sub: 'Thao tác cực kỳ đơn giản' },
                    { icon: <Star className="w-5 h-5 text-amber-300"/>, title: 'Nền Tảng Uy Tín', sub: 'Cộng đồng đáng tin cậy' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">{item.icon}</div>
                      <div><h4 className="font-semibold text-sm">{item.title}</h4><p className="text-xs text-purple-200">{item.sub}</p></div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* REGISTER FORM (Left)                                  */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="absolute left-0 top-0 w-full md:w-1/2 h-full p-8 md:p-10 flex flex-col justify-center z-10 bg-white overflow-y-auto">
          <div className={`max-w-md w-full mx-auto transition-all duration-300 ${!isLogin ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'} ${isShake && !isLogin ? 'shake-animation' : ''}`}>
            <h2 className="text-xs font-bold text-purple-600 tracking-widest uppercase mb-1">Let&#39;s Get You Started</h2>
            <h3 className="text-2xl font-extrabold text-slate-800 mb-1">Tạo Tài Khoản</h3>
            <p className="text-slate-500 mb-4 text-sm">Khám phá các tính năng quản lý ưu việt.</p>

            {/* Global error register */}
            {error && !isLogin && (
              <div className="mb-3 p-3 bg-red-50 rounded-xl text-sm font-medium border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-2.5">
              {/* Họ tên */}
              <div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input ref={registerNameRef} type="text" placeholder="Họ và tên" value={registerName}
                    onChange={e => { setRegNameError(''); setRegisterName(e.target.value); }}
                    onBlur={blurName}
                    className={getInputCls(regNameError)} />
                </div>
                <FieldError msg={regNameError} />
              </div>

              {/* Email */}
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="email" placeholder="Địa chỉ Email" value={registerEmail}
                    onChange={e => { setRegEmailError(''); setRegisterEmail(e.target.value); }}
                    onBlur={blurRegEmail}
                    className={getInputCls(regEmailError)} />
                </div>
                <FieldError msg={regEmailError} />
              </div>

              {/* Mật khẩu + Strength */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type={showRegisterPassword ? 'text' : 'password'} placeholder="Mật khẩu (tối thiểu 8 ký tự)" value={registerPassword}
                    onChange={e => { setRegPassError(''); setRegisterPassword(e.target.value); }}
                    onBlur={blurRegPass}
                    className={getInputCls(regPassError, true)} />
                  <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password Strength Indicator */}
                {registerPassword && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: i <= pwStrength.score ? pwStrength.color : '#e2e8f0' }} />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: pwStrength.color }}>
                      Độ mạnh: <strong>{pwStrength.label}</strong>
                    </p>
                  </div>
                )}
                <FieldError msg={regPassError} />
              </div>

              {/* Xác nhận mật khẩu */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type={showRegisterConfirm ? 'text' : 'password'} placeholder="Xác nhận Mật khẩu" value={registerConfirm}
                    onChange={e => { setRegConfirmError(''); setRegisterConfirm(e.target.value); }}
                    onBlur={blurRegConfirm}
                    className={getInputCls(regConfirmError, true)} />
                  <button type="button" onClick={() => setShowRegisterConfirm(!showRegisterConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    {showRegisterConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {/* Icon check khi khớp */}
                  {registerConfirm && registerPassword === registerConfirm && (
                    <CheckCircle2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                </div>
                <FieldError msg={regConfirmError} />
              </div>

              {/* Terms */}
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="terms" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500" />
                <label htmlFor="terms" className="text-xs text-slate-500">
                  Tôi đồng ý với <a href="#" className="text-purple-600 font-medium">Điều khoản & Chính sách</a>
                </label>
              </div>

              <button disabled={loading} type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all text-sm">
                {loading ? 'Đang xử lý...' : 'Tạo Tài Khoản →'}
              </button>
            </form>

            <div className="flex items-center gap-4 my-3">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-slate-400 text-xs font-medium uppercase">Hoặc</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <SocialButtons />
            <p className="text-center text-sm text-slate-500 mt-4">
              Đã có tài khoản? <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className="text-purple-600 font-bold hover:underline">Đăng nhập</button>
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* LOGIN FORM (Right)                                    */}
        {/* ══════════════════════════════════════════════════════ */}
        <div className="absolute right-0 top-0 w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col justify-center z-10 bg-white">
          <div className={`max-w-md w-full mx-auto transition-all duration-300 ${isLogin ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'} ${isShake && isLogin ? 'shake-animation' : ''}`}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mb-6 md:hidden">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h2 className="text-xs font-bold text-purple-600 tracking-widest uppercase mb-2">Chào mừng trở lại</h2>
            <h3 className="text-3xl font-extrabold text-slate-800 mb-1">Đăng Nhập</h3>
            <p className="text-slate-500 mb-6 text-sm">Vui lòng nhập thông tin để truy cập vào hệ thống.</p>

            {/* ── Khối báo lỗi/khóa (Alert Block) ── */}
            {isLocked ? (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔒</span>
                  <span className="text-red-700 text-sm font-bold">Tài khoản tạm thời bị khóa</span>
                </div>
                <p className="text-red-600 text-xs ml-7 mb-2">Quá nhiều lần đăng nhập thất bại. Thử lại sau:</p>
                <div className="ml-7 inline-block bg-red-100 rounded-lg px-3 py-1.5 mb-2">
                  <span className="text-red-700 text-xl font-black font-mono tabular-nums">
                    {formatCountdown(countdown)}
                  </span>
                </div>
                <p className="text-red-500 text-xs ml-7">
                  Hoặc <a href="#" className="text-orange-600 underline font-medium">liên hệ hỗ trợ</a> để mở khóa ngay.
                </p>
              </div>
            ) : error && isLogin ? (
              <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    ref={loginEmailRef}
                    type="email" placeholder="Địa chỉ Email" value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    onKeyDown={() => {
                      // Chỉ xóa lỗi khi người dùng thực sự gõ phím vào ô
                      if (error || loginEmailError) { setError(''); setLoginEmailError(''); setShowForgot(false); }
                    }}
                    onBlur={() => {
                      // Không validate onBlur khi đang hiển thị lỗi đăng nhập
                      if (error) return;
                      if (loginEmail && !isValidEmail(loginEmail)) setLoginEmailError('Email không đúng định dạng.');
                      else setLoginEmailError('');
                    }}
                    disabled={isLocked}
                    className={getLoginInputCls(!!loginEmailError || (!!error && isLogin))} />
                </div>
                <FieldError msg={loginEmailError} />
              </div>

              {/* Mật khẩu */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    onKeyDown={() => {
                      // Chỉ xóa lỗi khi người dùng thực sự gõ phím vào ô
                      if (error) { setError(''); setShowForgot(false); }
                    }}
                    disabled={isLocked}
                    className={getLoginInputCls(!!error && isLogin, true)} />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Ghi nhớ + Quên mật khẩu */}
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500" />
                  <span className="text-slate-500">Ghi nhớ đăng nhập</span>
                </label>
                <a href="#" className={`font-medium hover:underline transition-all ${showForgot ? 'text-orange-500 font-bold animate-pulse' : 'text-purple-600'}`}>
                  {showForgot ? '⚡ Quên mật khẩu?' : 'Quên mật khẩu?'}
                </a>
              </div>

              <button disabled={loading || isLocked} type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">
                {loading ? 'Đang xử lý...' : isLocked ? `Bị khóa (${formatCountdown(countdown)})` : 'Đăng Nhập →'}
              </button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="h-px bg-slate-200 flex-1"></div>
              <span className="text-slate-400 text-xs font-medium uppercase">Hoặc</span>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <SocialButtons />
            <p className="text-center text-sm text-slate-500 mt-6">
              Chưa có tài khoản? <button type="button" onClick={() => { setIsLogin(false); setError(''); }}
                className="text-purple-600 font-bold hover:underline">Đăng ký ngay</button>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(3px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
          40%, 60% { transform: translate3d(5px, 0, 0); }
        }
        .shake-animation { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </div>
  );
}
