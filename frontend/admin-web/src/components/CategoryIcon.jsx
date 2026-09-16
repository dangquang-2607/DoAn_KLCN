import {
  Baby, Banknote, BookOpen, Briefcase, Bus, Camera, Car, Coffee,
  Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse,
  Home, Landmark, Lightbulb, Music, Package, PawPrint, Percent,
  PiggyBank, Plane, Receipt, Scissors, Shield, Shirt, ShoppingBag,
  Smartphone, Store, TrendingUp, Utensils, Wallet, Wifi, Wrench,
} from "lucide-react";
import { createElement } from "react";

const categoryColors = [
  ["cobalt", "Cobalt", "#2454e6"], ["sky", "Xanh trời", "#198ec8"],
  ["teal", "Ngọc lam", "#0f9f8f"], ["green", "Xanh lá", "#2f8f61"],
  ["amber", "Hổ phách", "#d48a08"], ["orange", "Cam", "#df6c2f"],
  ["rose", "Đỏ hồng", "#d14b62"], ["slate", "Than chì", "#42536a"],
];

const categoryIcons = [
  ["utensils", "Ăn uống", Utensils], ["coffee", "Cà phê", Coffee],
  ["shopping-bag", "Mua sắm", ShoppingBag], ["home", "Nhà ở", Home],
  ["lightbulb", "Điện nước", Lightbulb], ["wifi", "Internet", Wifi],
  ["smartphone", "Điện thoại", Smartphone], ["car", "Ô tô", Car],
  ["bus", "Công cộng", Bus], ["fuel", "Nhiên liệu", Fuel],
  ["plane", "Du lịch", Plane], ["heart-pulse", "Y tế", HeartPulse],
  ["shield", "Bảo hiểm", Shield], ["graduation-cap", "Giáo dục", GraduationCap],
  ["book-open", "Sách", BookOpen], ["film", "Phim", Film],
  ["gamepad", "Trò chơi", Gamepad2], ["music", "Âm nhạc", Music],
  ["dumbbell", "Thể thao", Dumbbell], ["camera", "Nhiếp ảnh", Camera],
  ["shirt", "Thời trang", Shirt], ["scissors", "Chăm sóc", Scissors],
  ["paw-print", "Thú cưng", PawPrint], ["baby", "Trẻ em", Baby],
  ["gift", "Quà tặng", Gift], ["briefcase", "Công việc", Briefcase],
  ["store", "Kinh doanh", Store], ["wrench", "Sửa chữa", Wrench],
  ["receipt", "Hóa đơn", Receipt], ["wallet", "Ví", Wallet],
  ["banknote", "Tiền mặt", Banknote], ["landmark", "Ngân hàng", Landmark],
  ["piggy-bank", "Tiết kiệm", PiggyBank], ["trending-up", "Đầu tư", TrendingUp],
  ["percent", "Lãi suất", Percent], ["package", "Khác", Package],
];

const iconByKey = new Map(categoryIcons.map(([key, , icon]) => [key, icon]));

export function CategoryIcon({ icon, color, size = 42 }) {
  const Icon = iconByKey.get(icon) || Package;
  const background = categoryColors.find(([key]) => key === color)?.[2] || categoryColors[0][2];
  return <span className="cf-category-icon" style={{ width: size, height: size, background }} aria-hidden="true">{createElement(Icon, { size: Math.round(size * .48), strokeWidth: 2.15 })}</span>;
}

export function CategoryIconPicker({ value, onChange }) {
  return <div className="cf-icon-picker" role="radiogroup" aria-label="Chọn biểu tượng danh mục">
    {categoryIcons.map(([key, label, Icon]) => <button type="button" key={key} className={value === key ? "selected" : ""} role="radio" aria-checked={value === key} aria-label={label} title={label} onClick={() => onChange(key)}>{createElement(Icon, { size: 20 })}</button>)}
  </div>;
}

export function CategoryColorPicker({ value, onChange }) {
  return <div className="cf-color-picker" role="radiogroup" aria-label="Chọn màu danh mục">
    {categoryColors.map(([key, label, color]) => <button type="button" key={key} className={value === key ? "selected" : ""} role="radio" aria-checked={value === key} aria-label={label} title={label} style={{ background: color }} onClick={() => onChange(key)} />)}
  </div>;
}
