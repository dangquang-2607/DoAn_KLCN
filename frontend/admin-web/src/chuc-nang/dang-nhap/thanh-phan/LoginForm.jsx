/**
 * ============================================================================
 * TÊN FILE: LoginForm.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị form đăng nhập, validation, lỗi xác thực và trạng thái khóa.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   State, callback và helper style do route Login cung cấp.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất form trình bày; submit được chuyển về Login để xác thực.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không lưu token, không gọi API và không phân biệt tài khoản có tồn tại hay không.
 * ============================================================================
 */
function BruteForceLockout({ countdown, formatCountdown }) {
  return (
    <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>🔒</span>
        <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700' }}>Tài khoản tạm thời bị khóa</span>
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
        Vui lòng liên hệ quản trị viên cấp cao để được hỗ trợ mở khóa sớm.
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
  showForgot,
  loading,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onEmailKeyDown,
  onPasswordKeyDown,
  onEmailBlur,
  onSubmit,
}) {
  const hasGlobalError = Boolean(error);
  const hasEmailError = Boolean(emailError);

  return (
    <div style={{ width: '380px', flexShrink: 0, marginLeft: '20px', transform: lampOn ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)', opacity: lampOn ? 1 : 0, pointerEvents: lampOn ? 'auto' : 'none', transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${lampOn ? 'rgba(255,200,80,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '24px', padding: '40px', boxShadow: lampOn ? '0 0 60px rgba(255,180,50,0.15), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 20px 60px rgba(0,0,0,0.5)', transition: 'border-color 1.2s ease, box-shadow 1.2s ease', animation: isShake ? 'admin-login-shake 0.5s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: lampOn ? 'linear-gradient(135deg, #ff8f00, #ff6b35)' : 'linear-gradient(135deg, #1f6feb, #8250df)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: lampOn ? '0 0 30px rgba(255,140,0,0.5)' : 'none', transition: 'background 0.8s ease, box-shadow 0.8s ease', fontSize: '22px' }}>🔒</div>
          <h2 style={{ color: 'white', fontSize: '24px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Chào mừng trở lại</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: 0 }}>Đăng nhập vào hệ thống quản trị</p>
        </div>

        {/* Khóa tạm thời được ưu tiên hiển thị thay cho lỗi xác thực thông thường. */}
        {isLocked ? <BruteForceLockout countdown={countdown} formatCountdown={formatCountdown} /> : hasGlobalError ? <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '12px', fontSize: '13px', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.5 }}><span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>⚠️</span><span>{error}</span></div> : null}

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>📧</span>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                onKeyDown={onEmailKeyDown}
                placeholder="admin@capitalflow.vn"
                required
                disabled={isLocked}
                className={`admin-login-input ${hasEmailError || hasGlobalError ? 'has-error' : ''}`}
                onBlur={onEmailBlur}
              />
            </div>
            {emailError && <p style={{ color: '#f87171', fontSize: '11px', marginTop: '5px', marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><span>⚠</span> {emailError}</p>}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', marginBottom: '7px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔑</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={onPasswordKeyDown}
                placeholder="••••••••"
                required
                disabled={isLocked}
                style={{ paddingRight: '44px' }}
                className={`admin-login-input ${hasGlobalError ? 'has-error' : ''}`}
              />
              <button type="button" onClick={onTogglePassword} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px', color: 'rgba(255,255,255,0.5)' }}>{showPassword ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: '18px' }}>
            <span style={{ color: showForgot ? '#fb923c' : 'rgba(255,255,255,0.35)', fontSize: '12px', fontWeight: showForgot ? '700' : '400', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {showForgot && <span>⚡</span>}Quên mật khẩu? Liên hệ quản trị cấp cao
            </span>
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className={`admin-login-btn ${loading ? 'is-loading' : ''}`}
          >
            {loading ? <><svg style={{ animation: 'admin-login-spin 1s linear infinite', width: 18, height: 18 }} fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Đang xác thực...</> : isLocked ? `Bị khóa (${formatCountdown(countdown)})` : 'Đăng nhập'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Chỉ dành cho tài khoản có quyền Quản trị viên</p>
      </div>
    </div>
  );
}
