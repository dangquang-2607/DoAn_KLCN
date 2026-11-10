import 'package:flutter/foundation.dart';

/// Chỉ số các tab ở thanh điều hướng dưới cùng.
class HomeTabs {
  static const int dashboard = 0;
  static const int transactions = 1;
  static const int budgets = 2;
  static const int more = 3;
}

/// Tab đang chọn của màn hình chính. Các màn hình con (ví dụ danh sách thông báo)
/// đổi giá trị này để đưa người dùng về đúng tab liên quan.
final ValueNotifier<int> homeTab = ValueNotifier<int>(HomeTabs.dashboard);
