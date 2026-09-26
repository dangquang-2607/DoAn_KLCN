/**
 * ============================================================================
 * TÊN FILE: PasswordStrengthBar.tsx
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập / Đăng ký
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Đánh giá và hiển thị độ mạnh mật khẩu.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất PasswordStrengthBar để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
'use client';
import { motion } from 'framer-motion';

interface PasswordStrengthBarProps {
  password: string;
}

// Điểm mạnh chỉ là phản hồi giao diện; backend vẫn thực thi chính sách mật khẩu cuối cùng.
function getStrength(pass: string): number {
  let score = 0;
  if (pass.length >= 6) score++;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

function getLabel(score: number) {
  if (score <= 1) return { text: 'Rat yeu', color: 'bg-rose-500', textColor: 'text-rose-600' };
  if (score === 2) return { text: 'Yeu', color: 'bg-amber-500', textColor: 'text-amber-600' };
  if (score === 3) return { text: 'Trung binh', color: 'bg-blue-500', textColor: 'text-blue-600' };
  if (score === 4) return { text: 'Manh', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
  return { text: 'Rat an toan', color: 'bg-emerald-600', textColor: 'text-emerald-600' };
}

export function getPasswordStrength(pass: string) {
  return getStrength(pass);
}

export function getStrengthLabel(score: number) {
  return getLabel(score);
}

export default function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  if (!password) return null;
  const score = getStrength(password);
  const { text, color, textColor } = getLabel(score);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-1 pt-0.5"
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Do manh mat khau:</span>
        <span className={`font-bold ${textColor}`}>{text}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        {[1, 2, 3, 4, 5].map((lvl) => (
          <div
            key={lvl}
            className={`h-full rounded-full transition-colors duration-300 ${
              score >= lvl ? color : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}
