import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../models/models.dart';
import 'repositories.dart';

/// Bộ nhớ dùng chung của ứng dụng: danh sách ví, danh mục và "số phiên bản dữ liệu".
///
/// Mỗi khi dữ liệu tài chính thay đổi — do thao tác trên điện thoại hoặc do một
/// thông báo cho biết web vừa thay đổi — [revision] tăng lên và mọi màn hình đang
/// mở tự tải lại. Đây là cơ chế giữ cho mobile và web luôn hiển thị cùng dữ liệu.
class AppData extends ChangeNotifier {
  AppData(ApiClient api)
      : finance = FinanceRepository(api),
        invoices = InvoiceRepository(api),
        admin = AdminRepository(api);

  final FinanceRepository finance;
  final InvoiceRepository invoices;
  final AdminRepository admin;

  List<Wallet> _wallets = <Wallet>[];
  List<FinanceCategory> _categories = <FinanceCategory>[];
  bool _loaded = false;
  int _revision = 0;
  int _generation = 0;
  Future<void>? _lookupsInFlight;

  List<Wallet> get wallets => _wallets;
  List<FinanceCategory> get categories => _categories;
  bool get loaded => _loaded;
  int get revision => _revision;

  Wallet? walletById(String? id) {
    if (id == null) return null;
    for (final wallet in _wallets) {
      if (wallet.id == id) return wallet;
    }
    return null;
  }

  FinanceCategory? categoryById(String? id) {
    if (id == null) return null;
    for (final category in _categories) {
      if (category.id == id) return category;
    }
    return null;
  }

  List<FinanceCategory> categoriesOf(String type) {
    return _categories.where((category) => category.type == type).toList();
  }

  /// Tải lại ví và danh mục (dữ liệu tra cứu dùng ở hầu hết màn hình).
  Future<void> refreshLookups() => _lookupsInFlight ??= _loadLookups();

  Future<void> _loadLookups() async {
    final generation = _generation;
    try {
      final results =
          await Future.wait<dynamic>([finance.wallets(), finance.categories()]);
      if (generation != _generation) return;
      _wallets = results[0] as List<Wallet>;
      _categories = results[1] as List<FinanceCategory>;
      _loaded = true;
      notifyListeners();
    } finally {
      if (generation == _generation) _lookupsInFlight = null;
    }
  }

  /// Báo cho mọi màn hình rằng dữ liệu đã thay đổi và cần tải lại.
  Future<void> markChanged() async {
    try {
      await refreshLookups();
    } catch (_) {
      // Màn hình đang mở sẽ tự báo lỗi kết nối khi tải lại.
    }
    _revision++;
    notifyListeners();
  }

  void clear() {
    _generation++;
    _lookupsInFlight = null;
    _wallets = <Wallet>[];
    _categories = <FinanceCategory>[];
    _loaded = false;
    _revision++;
    notifyListeners();
  }
}
