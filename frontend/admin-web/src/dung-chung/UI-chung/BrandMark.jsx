
export function BrandMark({ size = 36, className = "" }) {
  return (
    <span
      className={`cf-brand-mark ${className}`}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      title="CapitalFlow Admin"
    >
      <svg
        viewBox="0 0 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cf-admin-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1565FB" />
            <stop offset="100%" stopColor="#1C43FF" />
          </linearGradient>
          <mask id="cf-admin-dot-mask">
            {/* Vùng trắng giữ lại nội dung */}
            <rect width="140" height="140" fill="white" />
            {/* Vùng đen khoét rãnh tròn cách điệu xung quanh chấm cam */}
            <circle cx="123" cy="16" r="21" fill="black" />
          </mask>
        </defs>

        {/* Khung squircle xanh với góc bo tròn mềm mại và rãnh khoét */}
        <rect
          x="3"
          y="10"
          width="127"
          height="126"
          rx="32"
          fill="url(#cf-admin-logo-grad)"
          mask="url(#cf-admin-dot-mask)"
        />

        {/* Đường điện tâm đồ nhịp tim (pulse / ECG) trắng sắc nét */}
        <path
          d="M 34 73 L 44 73 L 58 44 L 75 102 L 86 73 L 98 73"
          stroke="#FFFFFF"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Chấm cam thương hiệu nổi bật tại góc trên bên phải */}
        <circle cx="123" cy="16" r="13.5" fill="#FF5E00" />
      </svg>
    </span>
  );
}
