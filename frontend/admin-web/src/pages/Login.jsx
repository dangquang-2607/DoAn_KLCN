import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30; // 30 giây (test) — đổi lại thành 15 * 60 khi production

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export default function Login() {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Error / validation
  const [error, setError] = useState('');        // lỗi toàn cục (server)
  const [emailError, setEmailError] = useState(''); // lỗi inline email
  const [isShake, setIsShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false); // gợi ý quên mật khẩu

  // Brute-force protection (client-side)
  const [failCount, setFailCount] = useState(() => {
    const saved = sessionStorage.getItem('admin_fail_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lockUntil, setLockUntil] = useState(() => {
    const saved = sessionStorage.getItem('admin_lock_until');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [countdown, setCountdown] = useState(0);

  // Lamp state
  const [lampOn, setLampOn] = useState(false);
  const emailInputRef = useRef(null);

  // Cord drag state
  const [isDragging, setIsDragging] = useState(false);
  const [cordY, setCordY] = useState(260);
  const [startY, setStartY] = useState(0);
  const [pullAmount, setPullAmount] = useState(0);
  const dragRef = useRef(false);
  const cycleRef = useRef(0);
  const navigate = useNavigate();

  const CORD_BASE_Y = 260;
  const CORD_START_X = 65;
  const CORD_START_Y = 178;
  const PULL_THRESHOLD = 60;

  // ─── Lockout countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdown(0);
        setLockUntil(0);
        setFailCount(0);
        setError('');
        sessionStorage.removeItem('admin_lock_until');
        sessionStorage.removeItem('admin_fail_count');
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  // ─── Inline email validation (onBlur) ────────────────────────────────────
  const handleEmailBlur = () => {
    // Không validate onBlur khi đang hiển thị lỗi đăng nhập
    if (error) return;
    if (email && !isValidEmail(email)) {
      setEmailError('Email không đúng định dạng (vd: admin@capitalflow.vn).');
    } else {
      setEmailError('');
    }
  };

  // ─── Trigger shake + focus ────────────────────────────────────────────────
  const triggerShake = (focusAfter = false) => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
    // Chỉ focus khi được yêu cầu rõ ràng (tờ submit lần đầu, không phải khi có lỗi đăng nhập)
    if (focusAfter) setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  // ─── Login handler ────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();

    // Kiểm tra inline validation trước
    if (!isValidEmail(email)) {
      setEmailError('Email không đúng định dạng.');
      triggerShake(true); // focus vào email lần đầu (không có error global)
      return;
    }

    // Kiểm tra bị khóa
    if (lockUntil && Date.now() < lockUntil) {
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      const token = data.access_token;
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.data.role.toUpperCase() !== 'ADMIN') {
        // Không tiết lộ "tài khoản tồn tại" → thông báo chung
        const newCount = failCount + 1;
        handleFailedAttempt(newCount, 'Email hoặc mật khẩu không chính xác.');
        return;
      }
      // Thành công → reset đếm lỗi
      sessionStorage.removeItem('admin_fail_count');
      sessionStorage.removeItem('admin_lock_until');
      setFailCount(0);
      sessionStorage.setItem('admin_access_token', token);
      if (data.refresh_token) {
        sessionStorage.setItem('admin_refresh_token', data.refresh_token);
      }
      navigate('/dashboard');
    } catch (err) {
      const status = err.response?.status;
      let msg = 'Email hoặc mật khẩu không chính xác.'; // Thông báo chung – không tiết lộ chi tiết

      // Lỗi server / mạng → Toast-style (không đếm attempt)
      if (!status || status >= 500) {
        msg = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.';
        setError(msg);
        triggerShake();
        setLoading(false);
        return;
      }

      const newCount = failCount + 1;
      handleFailedAttempt(newCount, msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFailedAttempt = (newCount, msg) => {
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
      setError(`${msg} Còn ${remaining} lần thử trước khi tài khoản bị khóa tạm thời.`);
      if (newCount >= 3) setShowForgot(true);
    }
    triggerShake();
  };

  // ─── Cord drag handlers ───────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
    setStartY(e.clientY);
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const delta = e.clientY - startY;
    const newY = Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120);
    setCordY(newY);
    setPullAmount(Math.max(0, delta));
  }, [startY]);

  const onMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setIsDragging(false);
    if (pullAmount >= PULL_THRESHOLD) {
      cycleRef.current += 1;
      setLampOn(prev => !prev);
    }
    setCordY(CORD_BASE_Y);
    setPullAmount(0);
  }, [pullAmount]);

  const onTouchStart = useCallback((e) => {
    dragRef.current = true;
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current) return;
    const delta = e.touches[0].clientY - startY;
    const newY = Math.min(Math.max(CORD_BASE_Y, CORD_BASE_Y + delta), CORD_BASE_Y + 120);
    setCordY(newY);
    setPullAmount(Math.max(0, delta));
  }, [startY]);

  const onTouchEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setIsDragging(false);
    if (pullAmount >= PULL_THRESHOLD) setLampOn(prev => !prev);
    setCordY(CORD_BASE_Y);
    setPullAmount(0);
  }, [pullAmount]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const pullOffset = (cordY - CORD_BASE_Y) * 0.3;
  const cordPath = `M ${CORD_START_X} ${CORD_START_Y} Q ${CORD_START_X - 10 + pullOffset * 0.4} ${(CORD_START_Y + cordY) / 2} ${CORD_START_X + 5 + pullOffset * 0.1} ${cordY}`;

  // dùng countdown > 0 thay vì Date.now() để tránh gọi hàm impure trong render
  const isLocked = countdown > 0;
  const hasGlobalError = !!error;
  const hasEmailError = !!emailError;
  const inputHasError = hasGlobalError || hasEmailError;

  // Stars — memo hóa để không tái tạo mỗi lần re-render (nếu không trang sẽ trông như bị reset)
  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    width: Math.random() * 2 + 1,
    top: Math.random() * 100,
    left: Math.random() * 100,
    opacity: Math.random() * 0.7 + 0.1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 3,
  })), []); // [] = chỉ tính 1 lần khi mount

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Input style helper ───────────────────────────────────────────────────
  const getInputStyle = (hasErr) => ({
    width: '100%',
    boxSizing: 'border-box',
    paddingLeft: '42px',
    paddingRight: '14px',
    paddingTop: '12px',
    paddingBottom: '12px',
    fontSize: '14px',
    background: hasErr ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.06)',
    border: hasErr ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    transition: 'all 0.2s ease',
    opacity: isLocked ? 0.5 : 1,
  });

  const onFocusInput = (hasErr, e) => {
    e.target.style.borderColor = hasErr ? 'rgba(239,68,68,0.8)' : 'rgba(255,200,80,0.5)';
    e.target.style.background = hasErr ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.09)';
    e.target.style.boxShadow = hasErr ? '0 0 0 3px rgba(239,68,68,0.15)' : '0 0 0 3px rgba(255,180,50,0.1)';
  };

  const onBlurInput = (hasErr, e) => {
    e.target.style.borderColor = hasErr ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)';
    e.target.style.background = hasErr ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.06)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080810',
        transition: 'background 1.2s ease',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        overflow: 'hidden',
        position: 'relative',
      }}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            width: s.width + 'px',
            height: s.width + 'px',
            borderRadius: '50%',
            background: 'white',
            top: s.top + '%',
            left: s.left + '%',
            opacity: lampOn ? 0.1 : s.opacity,
            transition: 'opacity 1.2s ease',
            animation: `twinkle ${s.duration}s ease-in-out infinite alternate`,
            animationDelay: s.delay + 's',
          }}
        />
      ))}

      {/* Light cone */}
      {lampOn && (
        <div style={{
          position: 'absolute', top: 0, left: '50px',
          width: '0', height: '0',
          borderLeft: '180px solid transparent',
          borderRight: '180px solid transparent',
          borderTop: '500px solid rgba(255,200,50,0.07)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          filter: 'blur(20px)',
        }} />
      )}

      {/* ===== LEFT PANEL: LAMP ===== */}
      <div style={{ width: '340px', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          width: lampOn ? '160px' : '80px', height: '20px', borderRadius: '50%',
          background: lampOn ? 'rgba(255,200,50,0.18)' : 'rgba(0,0,0,0.5)',
          filter: 'blur(12px)', transition: 'all 1.2s ease',
        }} />

        <svg width="220" height="420" viewBox="0 0 220 420"
          style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', overflow: 'visible' }}
          onTouchStart={onTouchStart}
        >
          {lampOn && <path d="M 52 178 L -40 450 L 260 450 L 168 178 Z" fill="rgba(255, 90, 80, 0.15)" style={{ transition: 'opacity 0.4s ease' }} />}
          <rect x="106" y="170" width="8" height="160" fill="#ffffff" />
          <ellipse cx="110" cy="328" rx="40" ry="12" fill="#555555" />
          <ellipse cx="110" cy="325" rx="40" ry="12" fill="#ffffff" />
          <path d="M 73 328 A 40 12 0 0 0 147 328 A 38 10 0 0 1 73 328" fill="#cccccc" />
          <path d="M 75 75 Q 80 70 85 70 L 135 70 Q 140 70 145 75 L 175 170 Q 177 175 172 178 Q 110 188 48 178 Q 43 175 45 170 Z"
            fill={lampOn ? '#ff5a50' : '#cc4840'} style={{ transition: 'fill 0.4s ease' }} />
          <path d="M 48 175 Q 110 185 172 175" stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" />
          {lampOn ? (
            <>
              <ellipse cx="88" cy="125" rx="3.5" ry="5" fill="#4a2b29" />
              <ellipse cx="132" cy="125" rx="3.5" ry="5" fill="#4a2b29" />
              <path d="M 102 134 Q 110 146 118 134 Z" fill="#4a2b29" />
              <path d="M 106 137 Q 110 144 114 137 Z" fill="#ff9088" />
            </>
          ) : (
            <>
              <path d="M 83 125 Q 88 120 93 125" stroke="#4a2b29" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 127 125 Q 132 120 137 125" stroke="#4a2b29" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <circle cx="110" cy="136" r="2.5" fill="#4a2b29" />
              <text x="138" y="115" fontSize="10" fill="rgba(255,255,255,0.6)" fontWeight="bold">z</text>
              <text x="148" y="105" fontSize="12" fill="rgba(255,255,255,0.4)" fontWeight="bold">z</text>
            </>
          )}
          <path d={cordPath} stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round"
            style={{ transition: isDragging ? 'none' : 'd 0.4s cubic-bezier(0.34,1.56,0.64,1)' }} />
          <g transform={`translate(${CORD_START_X + 5 + pullOffset * 0.1}, ${cordY})`}
            onMouseDown={onMouseDown} onTouchStart={onTouchStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <circle cx="0" cy="0" r="7" fill="#ffffff" />
            <circle cx="-1" cy="1" r="5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
            {!isDragging && (
              <g style={{ animation: 'bounce 1.5s ease-in-out infinite', opacity: 0.6 }}>
                <path d="M -4 12 L 0 16 L 4 12" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </g>
            )}
          </g>
          {!isDragging && (
            <text x={CORD_START_X + 5} y={cordY + 30} textAnchor="middle" fontSize="10"
              fill="rgba(255,255,255,0.5)" style={{ userSelect: 'none' }}>
              {lampOn ? 'tắt' : 'bật'}
            </text>
          )}
        </svg>

        <div style={{
          position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)',
          color: lampOn ? 'rgba(255,220,100,0.7)' : 'rgba(255,255,255,0.2)',
          fontSize: '11px', fontWeight: '600', letterSpacing: '3px',
          textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 1.2s ease',
        }}>
          CapitalFlow Admin
        </div>
      </div>

      {/* ===== RIGHT PANEL: FORM ===== */}
      <div style={{
        width: '380px', flexShrink: 0, marginLeft: '20px',
        transform: lampOn ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
        opacity: lampOn ? 1 : 0,
        pointerEvents: lampOn ? 'auto' : 'none',
        transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${lampOn ? 'rgba(255,200,80,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '24px',
          padding: '40px',
          boxShadow: lampOn
            ? '0 0 60px rgba(255,180,50,0.15), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 20px 60px rgba(0,0,0,0.5)',
          transition: 'border-color 1.2s ease, box-shadow 1.2s ease',
          animation: isShake ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: lampOn ? 'linear-gradient(135deg, #ff8f00, #ff6b35)' : 'linear-gradient(135deg, #1f6feb, #8250df)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: lampOn ? '0 0 30px rgba(255,140,0,0.5)' : 'none',
              transition: 'background 0.8s ease, box-shadow 0.8s ease',
              fontSize: '22px',
            }}>🔒</div>
            <h2 style={{ color: 'white', fontSize: '24px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
              Chào mừng trở lại
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: 0 }}>
              Đăng nhập vào hệ thống quản trị
            </p>
          </div>

          {/* ── Khối báo lỗi TOÀN CỤC (Alert Block) ── */}
          {isLocked ? (
            <div style={{
              marginBottom: '16px', padding: '14px 16px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>🔒</span>
                <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700' }}>
                  Tài khoản tạm thời bị khóa
                </span>
              </div>
              <p style={{ color: 'rgba(252,165,165,0.8)', fontSize: '12px', margin: '0 0 8px 24px', lineHeight: 1.5 }}>
                Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau:
              </p>
              <div style={{
                margin: '0 0 8px 24px', padding: '6px 12px',
                background: 'rgba(239,68,68,0.2)', borderRadius: '8px',
                display: 'inline-block',
              }}>
                <span style={{ color: '#f87171', fontSize: '20px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                  {formatCountdown(countdown)}
                </span>
              </div>
              <p style={{ color: 'rgba(252,165,165,0.6)', fontSize: '11px', margin: '4px 0 0 24px' }}>
                Hoặc{' '}
                <a href="#" style={{ color: '#fb923c', textDecoration: 'underline' }}>
                  liên hệ quản trị hệ thống
                </a>{' '}
                để được hỗ trợ ngay.
              </p>
            </div>
          ) : hasGlobalError ? (
            <div style={{
              marginBottom: '16px', padding: '12px 16px',
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: '12px', fontSize: '13px', color: '#fca5a5',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              lineHeight: 1.5,
            }}>
              <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>📧</span>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={() => {
                    // Chỉ xóa lỗi khi người dùng thực sự gõ phím
                    if (error || emailError) { setError(''); setEmailError(''); setShowForgot(false); }
                  }}
                  placeholder="admin@capitalflow.vn"
                  required
                  disabled={isLocked}
                  style={{ ...getInputStyle(hasEmailError || hasGlobalError), paddingRight: '14px' }}
                  onFocus={e => onFocusInput(hasEmailError || hasGlobalError, e)}
                  onBlur={e => { handleEmailBlur(); onBlurInput(hasEmailError || hasGlobalError, e); }}
                />
              </div>
              {/* Inline field error */}
              {emailError && (
                <p style={{ color: '#f87171', fontSize: '11px', marginTop: '5px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⚠</span> {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔑</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={() => {
                    // Chỉ xóa lỗi khi người dùng thực sự gõ phím
                    if (error) { setError(''); setShowForgot(false); }
                  }}
                  placeholder="••••••••"
                  required
                  disabled={isLocked}
                  style={{ ...getInputStyle(hasGlobalError), paddingRight: '44px' }}
                  onFocus={e => onFocusInput(hasGlobalError, e)}
                  onBlur={e => onBlurInput(hasGlobalError, e)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px', color: 'rgba(255,255,255,0.5)' }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Gợi ý Quên mật khẩu (xuất hiện sau 3 lần sai) */}
            <div style={{ textAlign: 'right', marginBottom: '18px' }}>
              <a href="#" style={{
                color: showForgot ? '#fb923c' : 'rgba(255,255,255,0.35)',
                fontSize: '12px',
                fontWeight: showForgot ? '700' : '400',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
                {showForgot && <span>⚡</span>}
                Quên mật khẩu?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: '100%', padding: '13px 0',
                background: isLocked
                  ? 'rgba(255,255,255,0.05)'
                  : loading
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #ff8f00, #ff6b35)',
                color: isLocked ? 'rgba(255,255,255,0.3)' : 'white',
                fontSize: '15px', fontWeight: '700', borderRadius: '12px', border: 'none',
                cursor: (loading || isLocked) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: (loading || isLocked) ? 'none' : '0 4px 20px rgba(255,140,0,0.4)',
                transition: 'all 0.2s ease', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { if (!loading && !isLocked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(255,140,0,0.5)'; } }}
              onMouseLeave={e => { if (!loading && !isLocked) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,140,0,0.4)'; } }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: 18, height: 18 }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Đang xác thực...
                </>
              ) : isLocked ? `Bị khóa (${formatCountdown(countdown)})` : 'Đăng nhập'}
            </button>
          </form>

          {/* Footer hint */}
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
            Chỉ dành cho tài khoản có quyền Quản trị viên
          </p>
        </div>
      </div>

      {/* Hint khi tắt đèn */}
      {!lampOn && (
        <div style={{
          position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontWeight: '500',
          letterSpacing: '2px', textAlign: 'center',
          animation: 'fadeInOut 3s ease-in-out infinite', whiteSpace: 'nowrap',
        }}>
          ☝️ Kéo sợi dây để bật đèn...
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes twinkle { from { opacity: 0.1; } to { opacity: 0.8; } }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(3px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
          40%, 60% { transform: translate3d(5px, 0, 0); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
