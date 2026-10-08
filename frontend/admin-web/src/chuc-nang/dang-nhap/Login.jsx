/**
 * ============================================================================
 * TÊN FILE: Login.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối xác thực admin, validation, khóa tạm phía client và đèn tương tác.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React state/effect, React Router, admin API client và các component login.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Login; lưu token vào sessionStorage và điều hướng khi hợp lệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Thông báo đăng nhập cố ý không tiết lộ tài khoản có tồn tại; backend vẫn quyết định quyền.
 * ============================================================================
 */
import "./CSS/login.css";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LampAnimation from './thanh-phan/LampAnimation';
import LoginForm from './thanh-phan/LoginForm';
import api from '../../dung-chung/connect-api/api';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const CORD_BASE_Y = 260;
const CORD_START_X = 65;
const CORD_START_Y = 178;
const PULL_THRESHOLD = 60;

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [failCount, setFailCount] = useState(() => Number.parseInt(sessionStorage.getItem('admin_fail_count') || '0', 10));
  const [lockUntil, setLockUntil] = useState(() => Number.parseInt(sessionStorage.getItem('admin_lock_until') || '0', 10));
  const [countdown, setCountdown] = useState(0);
  const [lampOn, setLampOn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cordY, setCordY] = useState(CORD_BASE_Y);
  const [startY, setStartY] = useState(0);
  const [pullAmount, setPullAmount] = useState(0);
  const [stars] = useState(() => Array.from({ length: 50 }, (_, index) => ({ id: index, width: Math.random() * 2 + 1, top: Math.random() * 100, left: Math.random() * 100, opacity: Math.random() * 0.7 + 0.1, duration: Math.random() * 3 + 2, delay: Math.random() * 3 })));
  const emailInputRef = useRef(null);
  const dragRef = useRef(false);
  const navigate = useNavigate();

  // Đồng bộ bộ đếm khóa với mốc thời gian trong sessionStorage và tự mở khóa khi hết hạn.
  useEffect(() => {
    if (!lockUntil) return undefined;
    const tick = () => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdown(0); setLockUntil(0); setFailCount(0); setError('');
        sessionStorage.removeItem('admin_lock_until'); sessionStorage.removeItem('admin_fail_count');
      } else setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const handleEmailBlur = () => {
    if (error) return;
    setEmailError(email && !isValidEmail(email) ? 'Email không đúng định dạng (vd: admin@capitalflow.vn).' : '');
  };

  const triggerShake = (focusAfter = false) => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
    if (focusAfter) setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  // Ghi nhận thất bại đồng nhất, khóa tạm ở ngưỡng và không tiết lộ nguyên nhân xác thực cụ thể.
  const handleFailedAttempt = (newCount, message) => {
    setFailCount(newCount);
    sessionStorage.setItem('admin_fail_count', newCount);
    if (newCount >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockUntil(until);
      sessionStorage.setItem('admin_lock_until', until);
      setError(`Bạn đã nhập sai ${MAX_ATTEMPTS} lần. Tài khoản tạm thời bị khóa trong 15 phút.`);
      setShowForgot(true);
    } else {
      const remaining = MAX_ATTEMPTS - newCount;
      setError(`${message} Còn ${remaining} lần thử trước khi tài khoản bị khóa tạm thời.`);
      if (newCount >= 3) setShowForgot(true);
    }
    triggerShake();
  };

  // Xác thực token trước, sau đó đọc /auth/me để bảo đảm tài khoản có vai trò ADMIN.
  const handleLogin = async (event) => {
    event.preventDefault();
    if (!isValidEmail(email)) { setEmailError('Email không đúng định dạng.'); triggerShake(true); return; }
    // oxlint-disable-next-line react/purity -- chỉ đọc thời gian sau sự kiện submit.
    if (lockUntil && Date.now() < lockUntil) { triggerShake(); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const token = data.access_token;
      const meResponse = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (meResponse.data.role.toUpperCase() !== 'ADMIN') { handleFailedAttempt(failCount + 1, 'Email hoặc mật khẩu không chính xác.'); return; }
      sessionStorage.removeItem('admin_fail_count'); sessionStorage.removeItem('admin_lock_until'); setFailCount(0);
      sessionStorage.setItem('admin_access_token', token);
      if (data.refresh_token) sessionStorage.setItem('admin_refresh_token', data.refresh_token);
      navigate('/dashboard');
    } catch (caught) {
      const status = caught.response?.status;
      if (!status || status >= 500) {
        setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.'); triggerShake(); setLoading(false); return;
      }
      handleFailedAttempt(failCount + 1, 'Email hoặc mật khẩu không chính xác.');
    } finally { setLoading(false); }
  };

  const onMouseDown = useCallback((event) => { event.preventDefault(); dragRef.current = true; setIsDragging(true); setStartY(event.clientY); }, []);
  const onMouseMove = useCallback((event) => { if (!dragRef.current) return; const delta = event.clientY - startY; setCordY(Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120)); setPullAmount(Math.max(0, delta)); }, [startY]);
  const onMouseUp = useCallback(() => { if (!dragRef.current) return; dragRef.current = false; setIsDragging(false); if (pullAmount >= PULL_THRESHOLD) setLampOn((current) => !current); setCordY(CORD_BASE_Y); setPullAmount(0); }, [pullAmount]);
  const onTouchStart = useCallback((event) => { dragRef.current = true; setIsDragging(true); setStartY(event.touches[0].clientY); }, []);
  const onTouchMove = useCallback((event) => { if (!dragRef.current) return; const delta = event.touches[0].clientY - startY; setCordY(Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120)); setPullAmount(Math.max(0, delta)); }, [startY]);
  const onTouchEnd = useCallback(() => { if (!dragRef.current) return; dragRef.current = false; setIsDragging(false); if (pullAmount >= PULL_THRESHOLD) setLampOn((current) => !current); setCordY(CORD_BASE_Y); setPullAmount(0); }, [pullAmount]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const isLocked = countdown > 0;
  const pullOffset = (cordY - CORD_BASE_Y) * 0.3;
  const cordPath = `M ${CORD_START_X} ${CORD_START_Y} Q ${CORD_START_X - 10 + pullOffset * 0.4} ${(CORD_START_Y + cordY) / 2} ${CORD_START_X + 5 + pullOffset * 0.1} ${cordY}`;
  const getInputStyle = (hasError) => ({ width: '100%', boxSizing: 'border-box', paddingLeft: '42px', paddingRight: '14px', paddingTop: '12px', paddingBottom: '12px', fontSize: '14px', background: hasError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.06)', border: hasError ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: 'white', outline: 'none', transition: 'all 0.2s ease', opacity: isLocked ? 0.5 : 1 });
  const onFocusInput = (hasError, event) => { event.target.style.borderColor = hasError ? 'rgba(239,68,68,0.8)' : 'rgba(255,200,80,0.5)'; event.target.style.background = hasError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.09)'; event.target.style.boxShadow = hasError ? '0 0 0 3px rgba(239,68,68,0.15)' : '0 0 0 3px rgba(255,180,50,0.1)'; };
  const onBlurInput = (hasError, event) => { event.target.style.borderColor = hasError ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'; event.target.style.background = hasError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.06)'; event.target.style.boxShadow = 'none'; };

  return (
    <div className="admin-login-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080810', transition: 'background 1.2s ease', fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: 'hidden', position: 'relative' }} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <LampAnimation stars={stars} lampOn={lampOn} isDragging={isDragging} cordY={cordY} pullOffset={pullOffset} cordPath={cordPath} onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
      <LoginForm lampOn={lampOn} isShake={isShake} isLocked={isLocked} error={error} emailError={emailError} countdown={countdown} formatCountdown={formatCountdown} emailInputRef={emailInputRef} email={email} password={password} showPassword={showPassword} showForgot={showForgot} loading={loading} onEmailChange={setEmail} onPasswordChange={setPassword} onTogglePassword={() => setShowPassword((current) => !current)} onEmailKeyDown={() => { if (error || emailError) { setError(''); setEmailError(''); setShowForgot(false); } }} onPasswordKeyDown={() => { if (error) { setError(''); setShowForgot(false); } }} onEmailBlur={handleEmailBlur} onSubmit={handleLogin} getInputStyle={getInputStyle} onFocusInput={onFocusInput} onBlurInput={onBlurInput} />
      {!lampOn && <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontWeight: '500', letterSpacing: '2px', textAlign: 'center', animation: 'admin-login-fadeInOut 3s ease-in-out infinite', whiteSpace: 'nowrap' }}>☝️ Kéo sợi dây để bật đèn...</div>}
    </div>
  );
}
