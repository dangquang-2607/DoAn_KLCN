import { 
  Store, Cloud, Plane, Briefcase, Users, LayoutGrid, Utensils, Home,
  Car, Receipt, Landmark, Wallet, CreditCard, Bitcoin, PiggyBank
} from 'lucide-react';

// Common colors for UI components
const colorPalettes = [
  { text: 'text-indigo-600', bg: 'bg-indigo-100' },
  { text: 'text-emerald-600', bg: 'bg-emerald-100' },
  { text: 'text-rose-600', bg: 'bg-rose-100' },
  { text: 'text-blue-600', bg: 'bg-blue-100' },
  { text: 'text-amber-600', bg: 'bg-amber-100' },
  { text: 'text-purple-600', bg: 'bg-purple-100' },
  { text: 'text-cyan-600', bg: 'bg-cyan-100' },
  { text: 'text-fuchsia-600', bg: 'bg-fuchsia-100' },
];

export const getHashColor = (str: string = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalettes.length;
  return colorPalettes[index];
};

export const getCategoryIcon = (categoryName: string = '') => {
  const lower = categoryName.toLowerCase();
  if (lower.includes('thực phẩm') || lower.includes('ăn')) return Utensils;
  if (lower.includes('nhà') || lower.includes('thuê')) return Home;
  if (lower.includes('đi lại') || lower.includes('xe') || lower.includes('phương tiện')) return Car;
  if (lower.includes('mua sắm') || lower.includes('quần áo')) return Store;
  if (lower.includes('hóa đơn') || lower.includes('điện') || lower.includes('nước')) return Receipt;
  if (lower.includes('phần mềm') || lower.includes('công nghệ')) return Cloud;
  if (lower.includes('du lịch') || lower.includes('bay')) return Plane;
  if (lower.includes('công việc') || lower.includes('lương')) return Briefcase;
  if (lower.includes('nhân sự') || lower.includes('team')) return Users;
  return LayoutGrid;
};

export const getAccountIcon = (accountType: string = '') => {
  const lower = accountType.toLowerCase();
  if (lower.includes('cash') || lower.includes('tiền mặt')) return Wallet;
  if (lower.includes('credit') || lower.includes('tín dụng')) return CreditCard;
  if (lower.includes('saving') || lower.includes('tiết kiệm')) return PiggyBank;
  if (lower.includes('crypto') || lower.includes('tiền điện tử')) return Bitcoin;
  if (lower.includes('bank') || lower.includes('ngân hàng')) return Landmark;
  return Landmark;
};
