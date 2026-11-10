import "./CSS/login.css";
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCancel } from 'axios';
import { useNavigate } from 'react-router-dom';
import LampAnimation from './thanh-phan/LampAnimation';
import LoginForm from './thanh-phan/LoginForm';
import { useQueryClient } from "@tanstack/react-query";
import { clearSession } from '../../dung-chung/connect-api/api';
import { AdminAccessError, requestAdminSession } from '../../dung-chung/xac-thuc/adminSession';

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
  const cache = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [failCount, setFailCount] = useState(() => Number.parseInt(sessionStorage.getItem('admin_fail_count') || '0', 10));
  const [lockUntil, setLockUntil] = useState(() => Number.parseInt(sessionStorage.getItem('admin_lock_until') || '0', 10));
  const [countdown, setCountdown] = useState(0);
  const [lampOn, setLampOn] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cordY, setCordY] = useState(CORD_BASE_Y);
  const startYRef = useRef(0);
  const pullAmountRef = useRef(0);
  const [stars] = useState(() => Array.from({ length: 50 }, (_, index) => ({ id: index, width: Math.random() * 2 + 1, top: Math.random() * 100, left: Math.random() * 100, opacity: Math.random() * 0.7 + 0.1, duration: Math.random() * 3 + 2, delay: Math.random() * 3 })));
  const emailInputRef = useRef(null);
  const dragRef = useRef(false);
  const submitting = useRef(false);
  const loginRequest = useRef(null);
  const shakeTimer = useRef(null);
  const focusTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => {
    loginRequest.current?.abort();
    clearTimeout(shakeTimer.current);
    clearTimeout(focusTimer.current);
  }, []);

  // Tự động chuyển đến dashboard nếu phiên đăng nhập đã tồn tại trong sessionStorage.
  useEffect(() => {
    if (sessionStorage.getItem('admin_access_token')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

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
    clearTimeout(shakeTimer.current);
    clearTimeout(focusTimer.current);
    setIsShake(true);
    shakeTimer.current = setTimeout(() => setIsShake(false), 500);
    if (focusAfter) focusTimer.current = setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  // Ghi nhận thất bại đồng nhất, khóa tạm ở ngưỡng và không tiết lộ nguyên nhân xác thực cụ thể.
  const handleFailedAttempt = (newCount, message) => {
    setFailCount(newCount);
    sessionStorage.setItem('admin_fail_count', newCount);
    if (newCount >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockUntil(until);
      sessionStorage.setItem('admin_lock_until', until);
      setError(`Đăng nhập tạm dừng sau ${MAX_ATTEMPTS} lần không thành công. Thử lại sau ${LOCKOUT_SECONDS} giây.`);
    } else {
      const remaining = MAX_ATTEMPTS - newCount;
      setError(`${message} Còn ${remaining} lần thử trước khi biểu mẫu tạm dừng.`);
    }
    triggerShake();
  };

  // Xác thực token trước, sau đó đọc /auth/me để bảo đảm tài khoản có vai trò ADMIN.
  const handleLogin = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) { setEmailError(normalizedEmail ? 'Email không đúng định dạng.' : 'Vui lòng nhập email.'); triggerShake(true); return; }
    if (!password) { setError('Vui lòng nhập mật khẩu.'); triggerShake(); return; }
    // oxlint-disable-next-line react/purity -- chỉ đọc thời gian sau sự kiện submit.
    if (lockUntil && Date.now() < lockUntil) { triggerShake(); return; }
    submitting.current = true;
    const controller = new AbortController();
    loginRequest.current = controller;
    setLoading(true); setError(''); setEmailError('');
    try {
      clearSession();
      await cache.cancelQueries();
      cache.clear();
      const data = await requestAdminSession({ email: normalizedEmail, password }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      sessionStorage.removeItem('admin_fail_count'); sessionStorage.removeItem('admin_lock_until'); setFailCount(0);
      sessionStorage.setItem('admin_access_token', data.access_token);
      if (data.refresh_token) sessionStorage.setItem('admin_refresh_token', data.refresh_token);
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      if (controller.signal.aborted || isCancel(caught)) return;
      const status = caught.response?.status;
      if (status === 429) {
        const retryAfter = Number(caught.response.headers?.['retry-after']);
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : LOCKOUT_SECONDS;
        const until = Date.now() + seconds * 1000;
        setLockUntil(until); sessionStorage.setItem('admin_lock_until', until);
        setError('Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.');
        return;
      }
      if (caught instanceof AdminAccessError || status === 401 || status === 403) {
        handleFailedAttempt(failCount + 1, 'Email hoặc mật khẩu không chính xác.');
        return;
      }
      if (!status || status >= 500) {
        setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.'); triggerShake(); return;
      }
      setError('Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.');
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const onMouseDown = useCallback((event) => {
    if (event.button !== 0 || submitting.current) return;
    event.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
    startYRef.current = event.clientY;
    pullAmountRef.current = 0;
  }, []);

  const onMouseMove = useCallback((event) => {
    if (!dragRef.current) return;
    const delta = event.clientY - startYRef.current;
    pullAmountRef.current = Math.max(0, delta);
    setCordY(Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120));
  }, []);

  const onMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setIsDragging(false);
    if (pullAmountRef.current >= PULL_THRESHOLD) {
      setLampOn((current) => !current);
    }
    setCordY(CORD_BASE_Y);
    pullAmountRef.current = 0;
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = false;
    pullAmountRef.current = 0;
    setIsDragging(false);
    setCordY(CORD_BASE_Y);
  }, []);

  const onTouchStart = useCallback((event) => {
    if (event.touches.length !== 1 || submitting.current) { cancelDrag(); return; }
    dragRef.current = true;
    setIsDragging(true);
    startYRef.current = event.touches[0].clientY;
    pullAmountRef.current = 0;
  }, [cancelDrag]);

  const onTouchMove = useCallback((event) => {
    if (!dragRef.current) return;
    if (event.touches.length !== 1) { cancelDrag(); return; }
    const delta = event.touches[0].clientY - startYRef.current;
    pullAmountRef.current = Math.max(0, delta);
    setCordY(Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120));
  }, [cancelDrag]);

  const onTouchEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setIsDragging(false);
    if (pullAmountRef.current >= PULL_THRESHOLD) {
      setLampOn((current) => !current);
    }
    setCordY(CORD_BASE_Y);
    pullAmountRef.current = 0;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', cancelDrag);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('blur', cancelDrag); };
  }, [onMouseMove, onMouseUp, cancelDrag]);

  const isLocked = countdown > 0;
  const pullOffset = (cordY - CORD_BASE_Y) * 0.3;
  const cordPath = `M ${CORD_START_X} ${CORD_START_Y} Q ${CORD_START_X - 10 + pullOffset * 0.4} ${(CORD_START_Y + cordY) / 2} ${CORD_START_X + 5 + pullOffset * 0.1} ${cordY}`;
  return (
    <div className="admin-login-screen" onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={cancelDrag}>
      <LampAnimation stars={stars} lampOn={lampOn} isDragging={isDragging} cordY={cordY} pullOffset={pullOffset} cordPath={cordPath} onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
      <LoginForm lampOn={lampOn} isShake={isShake} isLocked={isLocked} error={error} emailError={emailError} countdown={countdown} formatCountdown={formatCountdown} emailInputRef={emailInputRef} email={email} password={password} showPassword={showPassword} loading={loading} onEmailChange={setEmail} onPasswordChange={setPassword} onTogglePassword={() => setShowPassword((current) => !current)} onEmailKeyDown={() => { if (error || emailError) { setError(''); setEmailError(''); } }} onPasswordKeyDown={() => { if (error) { setError(''); } }} onEmailBlur={handleEmailBlur} onSubmit={handleLogin} />
      <button type="button" className="admin-login-light-toggle" aria-pressed={lampOn} disabled={loading} onClick={() => { cancelDrag(); setLampOn((current) => !current); }}>
        {lampOn ? "Tắt đèn" : "Bật đèn để đăng nhập"}
      </button>
    </div>
  );
}
