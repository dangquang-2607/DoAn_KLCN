import { useId } from "react";
import { AlertCircle, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from "lucide-react";

function BruteForceLockout({ countdown, formatCountdown }) {
  return (
    <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <LockKeyhole size={16} aria-hidden="true" />
        <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700' }}>Đăng nhập tạm dừng</span>
      </div>
      <p style={{ color: 'rgba(252,165,165,0.8)', fontSize: '12px', margin: '0 0 8px 24px', lineHeight: 1.5 }}>
        Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau:
      </p>
      <div style={{ margin: '0 0 8px 24px', padding: '6px 12px', background: 'rgba(239,68,68,0.2)', borderRadius: '8px', display: 'inline-block' }}>
        <span style={{ color: '#f87171', fontSize: '20px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
          {formatCountdown(countdown)}
        </span>
      </div>
      <p style={{ color: 'rgba(252,165,165,0.6)', fontSize: '11px', margin: '4px 0 0 24px' }}>
        Biểu mẫu sẽ tự mở khi hết thời gian chờ.
      </p>
    </div>
  );
}

export default function LoginForm({
  lampOn,
  isShake,
  isLocked,
  error,
  emailError,
  countdown,
  formatCountdown,
  emailInputRef,
  email,
  password,
  showPassword,
  loading,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onEmailKeyDown,
  onPasswordKeyDown,
  onEmailBlur,
  onSubmit,
}) {
  const id = useId();
  const hasGlobalError = Boolean(error);
  const hasEmailError = Boolean(emailError);

  return (
    <div className="admin-login-form" inert={!lampOn} style={{ transform: lampOn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)', opacity: lampOn ? 1 : 0, pointerEvents: lampOn ? 'auto' : 'none', transition: 'all 780ms cubic-bezier(0.45, 0, 0.55, 1)' }}>
      <div style={{ background: '#161b22', border: `1px solid ${lampOn ? '#388bfd' : '#30363d'}`, borderRadius: '6px', padding: '36px', boxShadow: lampOn ? '0 16px 40px -8px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.4)', transition: 'all 780ms cubic-bezier(0.45, 0, 0.55, 1)', animation: isShake ? 'admin-login-shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: lampOn ? '#1f6feb' : '#21262d', border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', transition: 'all 780ms cubic-bezier(0.45, 0, 0.55, 1)', fontSize: '20px' }}><LockKeyhole size={21} aria-hidden="true" /></div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Chào mừng trở lại</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: 0 }}>Đăng nhập vào hệ thống quản trị</p>
        </div>

        {/* Khóa tạm thời được ưu tiên hiển thị thay cho lỗi xác thực thông thường. */}
        {isLocked ? <BruteForceLockout countdown={countdown} formatCountdown={formatCountdown} /> : hasGlobalError ? <div role="alert" style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', fontSize: '13px', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.5 }}><AlertCircle size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span></div> : null}

        <form onSubmit={onSubmit} noValidate aria-busy={loading}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor={`${id}-email`} style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail aria-hidden="true" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={emailInputRef}
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                aria-invalid={hasEmailError || hasGlobalError}
                aria-describedby={emailError ? `${id}-email-error` : undefined}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                onKeyDown={onEmailKeyDown}
                placeholder="admin@capitalflow.vn"
                required
                disabled={isLocked || loading}
                className={`admin-login-input ${hasEmailError || hasGlobalError ? 'has-error' : ''}`}
                onBlur={onEmailBlur}
              />
            </div>
            {emailError && <p id={`${id}-email-error`} role="alert" style={{ color: '#fca5a5', fontSize: '12px', marginTop: '5px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} aria-hidden="true" /> {emailError}</p>}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label htmlFor={`${id}-password`} style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <KeyRound aria-hidden="true" size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                id={`${id}-password`}
                autoComplete="current-password"
                aria-invalid={hasGlobalError}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={onPasswordKeyDown}
                placeholder="••••••••"
                required
                disabled={isLocked || loading}
                style={{ paddingRight: '54px' }}
                className={`admin-login-input ${hasGlobalError ? 'has-error' : ''}`}
              />
              <button type="button" className="admin-login-password-toggle" disabled={loading || isLocked} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} onClick={onTogglePassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className={`admin-login-btn ${loading ? 'is-loading' : ''}`}
          >
            {loading ? <><svg style={{ animation: 'admin-login-spin 1s linear infinite', width: 18, height: 18 }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Đang xác thực...</> : isLocked ? `Bị khóa (${formatCountdown(countdown)})` : 'Đăng nhập'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>Chỉ dành cho tài khoản có quyền Quản trị viên</p>
      </div>
    </div>
  );
}
