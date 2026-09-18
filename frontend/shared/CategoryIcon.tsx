import type { LucideIcon } from "lucide-react";
import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Camera, Car, Coffee,
  Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse,
  Home, Landmark, Lightbulb, Music, Package, PawPrint, Percent,
  PiggyBank, Plane, Receipt, Scissors, Shield, Shirt, ShoppingBag,
  Smartphone, Store, TrendingUp, Utensils, Wallet, Wifi, Wrench,
} from "lucide-react";

export const categoryColors = [
  { key: "cobalt", label: "Cobalt", value: "#2454e6" },
  { key: "sky", label: "Xanh troi", value: "#198ec8" },
  { key: "teal", label: "Ngoc lam", value: "#0f9f8f" },
  { key: "green", label: "Xanh la", value: "#2f8f61" },
  { key: "amber", label: "Ho phach", value: "#d48a08" },
  { key: "orange", label: "Cam", value: "#df6c2f" },
  { key: "rose", label: "Do hong", value: "#d14b62" },
  { key: "slate", label: "Than chi", value: "#42536a" },
] as const;

export const categoryIcons: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "utensils", label: "An uong", icon: Utensils },
  { key: "coffee", label: "Ca phe", icon: Coffee },
  { key: "shopping-bag", label: "Mua sam", icon: ShoppingBag },
  { key: "home", label: "Nha o", icon: Home },
  { key: "lightbulb", label: "Dien nuoc", icon: Lightbulb },
  { key: "wifi", label: "Internet", icon: Wifi },
  { key: "smartphone", label: "Dien thoai", icon: Smartphone },
  { key: "car", label: "O to", icon: Car },
  { key: "bus", label: "Cong cong", icon: Bus },
  { key: "fuel", label: "Nhien lieu", icon: Fuel },
  { key: "plane", label: "Du lich", icon: Plane },
  { key: "heart-pulse", label: "Y te", icon: HeartPulse },
  { key: "shield", label: "Bao hiem", icon: Shield },
  { key: "graduation-cap", label: "Giao duc", icon: GraduationCap },
  { key: "book-open", label: "Sach", icon: BookOpen },
  { key: "film", label: "Phim", icon: Film },
  { key: "gamepad", label: "Tro choi", icon: Gamepad2 },
  { key: "music", label: "Am nhac", icon: Music },
  { key: "dumbbell", label: "The thao", icon: Dumbbell },
  { key: "camera", label: "Nhiep anh", icon: Camera },
  { key: "shirt", label: "Thoi trang", icon: Shirt },
  { key: "scissors", label: "Cham soc", icon: Scissors },
  { key: "paw-print", label: "Thu cung", icon: PawPrint },
  { key: "baby", label: "Tre em", icon: Baby },
  { key: "gift", label: "Qua tang", icon: Gift },
  { key: "briefcase", label: "Cong viec", icon: Briefcase },
  { key: "store", label: "Kinh doanh", icon: Store },
  { key: "wrench", label: "Sua chua", icon: Wrench },
  { key: "receipt", label: "Hoa don", icon: Receipt },
  { key: "wallet", label: "Vi", icon: Wallet },
  { key: "banknote", label: "Tien mat", icon: Banknote },
  { key: "landmark", label: "Ngan hang", icon: Landmark },
  { key: "piggy-bank", label: "Tiet kiem", icon: PiggyBank },
  { key: "trending-up", label: "Dau tu", icon: TrendingUp },
  { key: "percent", label: "Lai suat", icon: Percent },
  { key: "package", label: "Khac", icon: Package },
];

const iconByKey = new Map(categoryIcons.map((item) => [item.key, item.icon]));

export function CategoryIcon({
  icon,
  color,
  size = 42,
}: {
  icon?: string | null;
  color?: string | null;
  size?: number;
}) {
  const Icon = iconByKey.get(icon || "") || Package;
  const background =
    categoryColors.find((item) => item.key === color)?.value ||
    categoryColors[0].value;
  return (
    <span
      className="cf-category-icon"
      style={{ width: size, height: size, background }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.15} />
    </span>
  );
}

export function CategoryIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="cf-icon-picker"
      role="radiogroup"
      aria-label="Chon bieu tuong danh muc"
    >
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
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}

export function CategoryColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="cf-color-picker"
      role="radiogroup"
      aria-label="Chon mau danh muc"
    >
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