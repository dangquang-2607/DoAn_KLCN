/**
 * ============================================================================
 * TÊN FILE: LampAnimation.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Vẽ nền sao, đèn SVG và dây kéo tương tác của trang đăng nhập.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Trạng thái đèn/dây kéo, đường SVG và các callback pointer từ Login.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất phần minh họa; không chứa xác thực hoặc gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Hoạt ảnh chỉ mang tính trình bày và không quyết định quyền đăng nhập.
 * ============================================================================
 */
const CORD_START_X = 65;

export default function LampAnimation({ stars, lampOn, isDragging, cordY, pullOffset, cordPath, onMouseDown, onTouchStart }) {
  return (
    <>
      {stars.map((star) => <div key={star.id} style={{ position: 'absolute', width: `${star.width}px`, height: `${star.width}px`, borderRadius: '50%', background: 'white', top: `${star.top}%`, left: `${star.left}%`, opacity: lampOn ? 0.1 : star.opacity, transition: 'opacity 1.2s ease', animation: `twinkle ${star.duration}s ease-in-out infinite alternate`, animationDelay: `${star.delay}s` }} />)}
      {lampOn && <div style={{ position: 'absolute', top: 0, left: '50px', width: '0', height: '0', borderLeft: '180px solid transparent', borderRight: '180px solid transparent', borderTop: '500px solid rgba(255,200,50,0.07)', transform: 'translateX(-50%)', pointerEvents: 'none', filter: 'blur(20px)' }} />}
      <div style={{ width: '340px', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', width: lampOn ? '160px' : '80px', height: '20px', borderRadius: '50%', background: lampOn ? 'rgba(255,200,50,0.18)' : 'rgba(0,0,0,0.5)', filter: 'blur(12px)', transition: 'all 1.2s ease' }} />
        <svg width="220" height="420" viewBox="0 0 220 420" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', overflow: 'visible' }} onTouchStart={onTouchStart}>
          {lampOn && <path d="M 52 178 L -40 450 L 260 450 L 168 178 Z" fill="rgba(255, 90, 80, 0.15)" style={{ transition: 'opacity 0.4s ease' }} />}
          <rect x="106" y="170" width="8" height="160" fill="#ffffff" /><ellipse cx="110" cy="328" rx="40" ry="12" fill="#555555" /><ellipse cx="110" cy="325" rx="40" ry="12" fill="#ffffff" /><path d="M 73 328 A 40 12 0 0 0 147 328 A 38 10 0 0 1 73 328" fill="#cccccc" />
          <path d="M 75 75 Q 80 70 85 70 L 135 70 Q 140 70 145 75 L 175 170 Q 177 175 172 178 Q 110 188 48 178 Q 43 175 45 170 Z" fill={lampOn ? '#ff5a50' : '#cc4840'} style={{ transition: 'fill 0.4s ease' }} />
          <path d="M 48 175 Q 110 185 172 175" stroke="#ffffff" strokeWidth="7" fill="none" strokeLinecap="round" />
          {lampOn ? <><ellipse cx="88" cy="125" rx="3.5" ry="5" fill="#4a2b29" /><ellipse cx="132" cy="125" rx="3.5" ry="5" fill="#4a2b29" /><path d="M 102 134 Q 110 146 118 134 Z" fill="#4a2b29" /><path d="M 106 137 Q 110 144 114 137 Z" fill="#ff9088" /></> : <><path d="M 83 125 Q 88 120 93 125" stroke="#4a2b29" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M 127 125 Q 132 120 137 125" stroke="#4a2b29" strokeWidth="2.5" fill="none" strokeLinecap="round" /><circle cx="110" cy="136" r="2.5" fill="#4a2b29" /><text x="138" y="115" fontSize="10" fill="rgba(255,255,255,0.6)" fontWeight="bold">z</text><text x="148" y="105" fontSize="12" fill="rgba(255,255,255,0.4)" fontWeight="bold">z</text></>}
          <path d={cordPath} stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" style={{ transition: isDragging ? 'none' : 'd 0.4s cubic-bezier(0.34,1.56,0.64,1)' }} />
          <g transform={`translate(${CORD_START_X + 5 + pullOffset * 0.1}, ${cordY})`} onMouseDown={onMouseDown} onTouchStart={onTouchStart} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}><circle cx="0" cy="0" r="7" fill="#ffffff" /><circle cx="-1" cy="1" r="5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />{!isDragging && <g style={{ animation: 'bounce 1.5s ease-in-out infinite', opacity: 0.6 }}><path d="M -4 12 L 0 16 L 4 12" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></g>}</g>
          {!isDragging && <text x={CORD_START_X + 5} y={cordY + 30} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" style={{ userSelect: 'none' }}>{lampOn ? 'tắt' : 'bật'}</text>}
        </svg>
        <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', color: lampOn ? 'rgba(255,220,100,0.7)' : 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: '600', letterSpacing: '3px', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 1.2s ease' }}>CapitalFlow Admin</div>
      </div>
    </>
  );
}
