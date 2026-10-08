/**
 * ============================================================================
 * TÊN FILE: CategoryIcon.tsx
 * MÀN HÌNH / PHÂN HỆ: Thiết kế dùng chung
 * NHÓM VỆ TINH: dung-chung/UI-chung (UI dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp icon, màu và bộ chọn nhận diện danh mục.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props React, icon Lucide và các design token CSS dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CategoryIcon để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không chứa secret hoặc tự thay đổi dữ liệu nghiệp vụ; luôn tôn trọng khả năng truy cập.
 * ============================================================================
 */
import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Camera, Car, Coffee,
  Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse,
  Home, Landmark, Lightbulb, Music, Package, PawPrint, Percent,
  PiggyBank, Plane, Receipt, Scissors, Shield, Shirt, ShoppingBag,
  Smartphone, Store, TrendingUp, Utensils, Wallet, Wifi, Wrench,
} from "lucide-react";

const categoryColors = [
  { key: "cobalt", label: "Cobalt", value: "#2454e6" },
  { key: "sky", label: "Xanh trời", value: "#198ec8" },
  { key: "teal", label: "Ngọc lam", value: "#0f9f8f" },
  { key: "green", label: "Xanh lá", value: "#2f8f61" },
  { key: "amber", label: "Hổ phách", value: "#d48a08" },
  { key: "orange", label: "Cam", value: "#df6c2f" },
  { key: "rose", label: "Đỏ hồng", value: "#d14b62" },
  { key: "slate", label: "Than chì", value: "#42536a" },
] as const;

const categoryIcons: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "utensils", label: "Ăn uống", icon: Utensils },
  { key: "coffee", label: "Cà phê", icon: Coffee },
  { key: "shopping-bag", label: "Mua sắm", icon: ShoppingBag },
  { key: "home", label: "Nhà ở", icon: Home },
  { key: "lightbulb", label: "Điện nước", icon: Lightbulb },
  { key: "wifi", label: "Internet", icon: Wifi },
  { key: "smartphone", label: "Điện thoại", icon: Smartphone },
  { key: "car", label: "Ô tô", icon: Car },
  { key: "bus", label: "Công cộng", icon: Bus },
  { key: "fuel", label: "Nhiên liệu", icon: Fuel },
  { key: "plane", label: "Du lịch", icon: Plane },
  { key: "heart-pulse", label: "Y tế", icon: HeartPulse },
  { key: "shield", label: "Bảo hiểm", icon: Shield },
  { key: "graduation-cap", label: "Giáo dục", icon: GraduationCap },
  { key: "book-open", label: "Sách", icon: BookOpen },
  { key: "film", label: "Phim", icon: Film },
  { key: "gamepad", label: "Trò chơi", icon: Gamepad2 },
  { key: "music", label: "Âm nhạc", icon: Music },
  { key: "dumbbell", label: "Thể thao", icon: Dumbbell },
  { key: "camera", label: "Nhiếp ảnh", icon: Camera },
  { key: "shirt", label: "Thời trang", icon: Shirt },
  { key: "scissors", label: "Chăm sóc", icon: Scissors },
  { key: "paw-print", label: "Thú cưng", icon: PawPrint },
  { key: "baby", label: "Trẻ em", icon: Baby },
  { key: "gift", label: "Quà tặng", icon: Gift },
  { key: "briefcase", label: "Công việc", icon: Briefcase },
  { key: "store", label: "Kinh doanh", icon: Store },
  { key: "wrench", label: "Sửa chữa", icon: Wrench },
  { key: "receipt", label: "Hóa đơn", icon: Receipt },
  { key: "wallet", label: "Ví", icon: Wallet },
  { key: "banknote", label: "Tiền mặt", icon: Banknote },
  { key: "landmark", label: "Ngân hàng", icon: Landmark },
  { key: "piggy-bank", label: "Tiết kiệm", icon: PiggyBank },
  { key: "trending-up", label: "Đầu tư", icon: TrendingUp },
  { key: "percent", label: "Lãi suất", icon: Percent },
  { key: "package", label: "Khác", icon: Package },
];

const iconByKey = new Map(categoryIcons.map((item) => [item.key, item.icon]));

// Nếu backend trả icon/màu lạ, dùng giá trị dự phòng để không làm vỡ giao diện.
export function CategoryIcon({ icon, color, size = 42 }: { icon?: string | null; color?: string | null; size?: number }) {
  const Icon = iconByKey.get(icon || "") || Package;
  const background = categoryColors.find((item) => item.key === color)?.value || categoryColors[0].value;
  return (
    <span className="cf-category-icon" style={{ width: size, height: size, background }} aria-hidden="true">
      {createElement(Icon, { size: Math.round(size * 0.48), strokeWidth: 2.15 })}
    </span>
  );
}

export function CategoryIconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="cf-icon-picker" role="radiogroup" aria-label="Chọn biểu tượng danh mục">
      {categoryIcons.map(({ key, label, icon: Icon }) => (
        <button
          type="button"
          key={key}
          className={value === key ? "selected" : ""}
          role="radio"
          aria-checked={value === key}
          aria-label={label}
          title={label}
          onClick={() => onChange(key)}
        >
          {createElement(Icon, { size: 20 })}
        </button>
      ))}
    </div>
  );
}

export function CategoryColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="cf-color-picker" role="radiogroup" aria-label="Chọn màu danh mục">
      {categoryColors.map((color) => (
        <button
          type="button"
          key={color.key}
          className={value === color.key ? "selected" : ""}
          role="radio"
          aria-checked={value === color.key}
          aria-label={color.label}
          title={color.label}
          style={{ background: color.value }}
          onClick={() => onChange(color.key)}
        />
      ))}
    </div>
  );
}
