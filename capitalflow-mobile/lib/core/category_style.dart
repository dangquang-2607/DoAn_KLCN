import 'package:flutter/material.dart';

import 'theme.dart';

/// Một lựa chọn biểu tượng hoặc màu trong bộ chọn danh mục.
class StyleOption<T> {
  const StyleOption(this.key, this.label, this.value);

  final String key;
  final String label;
  final T value;
}

/// Bộ màu danh mục — cùng khóa với bản web (`frontend/shared/CategoryIcon.tsx`).
const List<StyleOption<Color>> categoryColors = [
  StyleOption('cobalt', 'Cobalt', Color(0xFF2454E6)),
  StyleOption('sky', 'Xanh trời', Color(0xFF198EC8)),
  StyleOption('teal', 'Ngọc lam', Color(0xFF0F9F8F)),
  StyleOption('green', 'Xanh lá', Color(0xFF2F8F61)),
  StyleOption('amber', 'Hổ phách', Color(0xFFD48A08)),
  StyleOption('orange', 'Cam', Color(0xFFDF6C2F)),
  StyleOption('rose', 'Đỏ hồng', Color(0xFFD14B62)),
  StyleOption('slate', 'Than chì', Color(0xFF42536A)),
];

/// Bộ biểu tượng danh mục — khóa trùng với tên icon Lucide mà web đang lưu trong CSDL.
const List<StyleOption<IconData>> categoryIcons = [
  StyleOption('utensils', 'Ăn uống', Icons.restaurant),
  StyleOption('coffee', 'Cà phê', Icons.local_cafe),
  StyleOption('shopping-bag', 'Mua sắm', Icons.shopping_bag),
  StyleOption('home', 'Nhà ở', Icons.home),
  StyleOption('lightbulb', 'Điện nước', Icons.lightbulb),
  StyleOption('wifi', 'Internet', Icons.wifi),
  StyleOption('smartphone', 'Điện thoại', Icons.smartphone),
  StyleOption('car', 'Ô tô', Icons.directions_car),
  StyleOption('bus', 'Công cộng', Icons.directions_bus),
  StyleOption('fuel', 'Nhiên liệu', Icons.local_gas_station),
  StyleOption('plane', 'Du lịch', Icons.flight),
  StyleOption('heart-pulse', 'Y tế', Icons.favorite),
  StyleOption('shield', 'Bảo hiểm', Icons.shield),
  StyleOption('graduation-cap', 'Giáo dục', Icons.school),
  StyleOption('book-open', 'Sách', Icons.menu_book),
  StyleOption('film', 'Phim', Icons.movie),
  StyleOption('gamepad', 'Trò chơi', Icons.sports_esports),
  StyleOption('music', 'Âm nhạc', Icons.music_note),
  StyleOption('dumbbell', 'Thể thao', Icons.fitness_center),
  StyleOption('camera', 'Nhiếp ảnh', Icons.photo_camera),
  StyleOption('shirt', 'Thời trang', Icons.checkroom),
  StyleOption('scissors', 'Chăm sóc', Icons.content_cut),
  StyleOption('paw-print', 'Thú cưng', Icons.pets),
  StyleOption('baby', 'Trẻ em', Icons.child_care),
  StyleOption('gift', 'Quà tặng', Icons.card_giftcard),
  StyleOption('briefcase', 'Công việc', Icons.work),
  StyleOption('store', 'Kinh doanh', Icons.storefront),
  StyleOption('wrench', 'Sửa chữa', Icons.build),
  StyleOption('receipt', 'Hóa đơn', Icons.receipt_long),
  StyleOption('wallet', 'Ví', Icons.account_balance_wallet),
  StyleOption('banknote', 'Tiền mặt', Icons.payments),
  StyleOption('landmark', 'Ngân hàng', Icons.account_balance),
  StyleOption('piggy-bank', 'Tiết kiệm', Icons.savings),
  StyleOption('trending-up', 'Đầu tư', Icons.trending_up),
  StyleOption('percent', 'Lãi suất', Icons.percent),
  StyleOption('package', 'Khác', Icons.inventory_2),
];

/// Màu nền của danh mục; khóa lạ dùng màu cobalt mặc định để không vỡ giao diện.
Color categoryColor(String? key) {
  for (final option in categoryColors) {
    if (option.key == key) return option.value;
  }
  return AppColors.blue;
}

/// Biểu tượng của danh mục; trả `null` khi khóa không thuộc bộ chuẩn.
IconData? categoryIconData(String? key) {
  for (final option in categoryIcons) {
    if (option.key == key) return option.value;
  }
  return null;
}

/// Màu của ví theo loại tài khoản.
Color walletColor(String type) {
  switch (type) {
    case 'CASH':
      return const Color(0xFF2F8F61);
    case 'BANK':
      return const Color(0xFF2454E6);
    case 'E_WALLET':
      return const Color(0xFF198EC8);
    case 'WALLET':
      return const Color(0xFF2454E6);
    case 'CREDIT_CARD':
      return const Color(0xFFD14B62);
    case 'SAVINGS':
      return const Color(0xFF0F9F8F);
    case 'INVESTMENT':
      return const Color(0xFFD48A08);
    case 'CRYPTO':
      return const Color(0xFFDF6C2F);
    default:
      return const Color(0xFF42536A);
  }
}

IconData walletIcon(String type) {
  switch (type) {
    case 'CASH':
      return Icons.payments;
    case 'BANK':
      return Icons.account_balance;
    case 'E_WALLET':
    case 'WALLET':
      return Icons.account_balance_wallet;
    case 'CREDIT_CARD':
      return Icons.credit_card;
    case 'SAVINGS':
      return Icons.savings;
    case 'INVESTMENT':
      return Icons.trending_up;
    case 'CRYPTO':
      return Icons.currency_bitcoin;
    default:
      return Icons.wallet;
  }
}

/// Nhãn tiếng Việt của loại tài khoản — khớp với bản web.
const Map<String, String> walletTypeLabels = {
  'CASH': 'Tiền mặt',
  'BANK': 'Ngân hàng',
  'E_WALLET': 'Ví điện tử',
  'WALLET': 'Ví CapitalFlow',
  'CREDIT_CARD': 'Thẻ tín dụng',
  'SAVINGS': 'Tiết kiệm',
  'INVESTMENT': 'Đầu tư',
  'CRYPTO': 'Tài sản số',
  'OTHER': 'Khác',
};

String walletTypeLabel(String type) => walletTypeLabels[type] ?? type;
