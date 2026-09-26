/**
 * ============================================================================
 * TÊN FILE: BruteForceLockout.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị cảnh báo khóa tạm thời và thời gian còn lại ở phía client.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props countdown và hàm định dạng thời gian do Login cung cấp.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất khối cảnh báo thuần trình bày, không tự thay đổi sessionStorage.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đây là lớp giảm thao tác lặp phía client; backend vẫn là lớp bảo vệ có thẩm quyền.
 * ============================================================================
 */
export default function BruteForceLockout({ countdown, formatCountdown }) {
  return (
    <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><span style={{ fontSize: '16px' }}>🔒</span><span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700' }}>Tài khoản tạm thời bị khóa</span></div>
      <p style={{ color: 'rgba(252,165,165,0.8)', fontSize: '12px', margin: '0 0 8px 24px', lineHeight: 1.5 }}>Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau:</p>
      <div style={{ margin: '0 0 8px 24px', padding: '6px 12px', background: 'rgba(239,68,68,0.2)', borderRadius: '8px', display: 'inline-block' }}><span style={{ color: '#f87171', fontSize: '20px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>{formatCountdown(countdown)}</span></div>
      <p style={{ color: 'rgba(252,165,165,0.6)', fontSize: '11px', margin: '4px 0 0 24px' }}>Hoặc{' '}<a href="#" style={{ color: '#fb923c', textDecoration: 'underline' }}>liên hệ quản trị hệ thống</a>{' '}để được hỗ trợ ngay.</p>
    </div>
  );
}
