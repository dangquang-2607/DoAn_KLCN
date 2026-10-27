import 'dart:async';

import 'package:flutter/widgets.dart';

import '../core/api_client.dart';
import '../core/app_config.dart';
import '../core/token_store.dart';
import '../models/models.dart';
import 'app_data.dart';
import 'app_settings.dart';
import 'local_notifier.dart';
import 'repositories.dart';
import 'system_notification_delivery.dart';

/// Trung tâm thông báo của ứng dụng.
///
/// Backend hiện cung cấp REST phân trang, chưa có /sync hoặc WebSocket /ws.
/// Đồng bộ danh sách mới nhất khi ứng dụng ở foreground; khử trùng theo id.
/// Thông báo trùng được loại theo id. Thông báo đến từ nơi khác (web, hệ thống)
/// sẽ hiện banner hệ thống và làm các màn hình tải lại dữ liệu.
class NotificationCenter extends ChangeNotifier with WidgetsBindingObserver {
  NotificationCenter({
    required ApiClient api,
    required this.config,
    required this.tokens,
    required this.settings,
    required this.notifier,
    required this.data,
  })  : _repo = NotificationRepository(api),
        _delivery = SystemNotificationDelivery(settings, notifier);

  final NotificationRepository _repo;
  final SystemNotificationDelivery _delivery;
  int _sessionGeneration = 0;
  int _refreshGeneration = 0;
  String? _sessionOwner;
  String? _sessionRoot;
  int? _sessionEpoch;

  bool _isCurrent(int generation) =>
      _running && generation == _sessionGeneration &&
      tokens.ownerId == _sessionOwner && config.apiRoot == _sessionRoot &&
      tokens.epoch == _sessionEpoch;
  final AppConfig config;
  final TokenStore tokens;
  final AppSettings settings;
  final LocalNotifier notifier;
  final AppData data;

  static const int _maxItems = 200;
  static const Duration _tickInterval = Duration(seconds: 5);

  final List<AppNotification> _items = <AppNotification>[];
  final Set<String> _seen = <String>{};

  Timer? _timer;
  bool _running = false;
  bool _syncing = false;
  bool _loading = false;
  bool _foreground = true;
  int _unread = 0;
  String? _error;

  List<AppNotification> get items => List<AppNotification>.unmodifiable(_items);
  int get unread => _unread;
  bool get loading => _loading;
  String? get error => _error;

  /// Backend hiện chỉ hỗ trợ đồng bộ REST.
  bool get realtimeConnected => false;

  // ── Vòng đời ──────────────────────────────────────────────────────────────

  /// Bắt đầu nhận thông báo sau khi đăng nhập.
  void start() {
    if (_running) return;
    _running = true;
    _sessionGeneration++;
    _sessionOwner = tokens.ownerId;
    _sessionRoot = config.apiRoot;
    _sessionEpoch = tokens.epoch;
    _foreground = WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;

    WidgetsBinding.instance.addObserver(this);
    config.addListener(_onServerChanged);

    _timer = Timer.periodic(_tickInterval, (_) => _tick());
    _bootstrap();
  }

  /// Dừng nhận thông báo và xóa dữ liệu trong bộ nhớ khi đăng xuất.
  void stop() {
    if (!_running) return;
    _running = false;
    _sessionGeneration++;
    _refreshGeneration++;
    _loading = false;
    _syncing = false;
    WidgetsBinding.instance.removeObserver(this);
    config.removeListener(_onServerChanged);
    _timer?.cancel();
    _timer = null;
    _items.clear();
    _seen.clear();
    _unread = 0;
    _error = null;
    settings.setLastSync(null);
    settings.setLastAlerted(null);
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_running) return;
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _sync(alert: true);
    }
  }

  void _onServerChanged() {
    if (!_running) return;
    stop();
    start();
  }

  Future<void> _bootstrap() async {
    final generation = _sessionGeneration;
    // Lấy bù trước (để hiện banner cho thông báo bị lỡ), sau đó nạp danh sách đầy đủ.
    await _sync(alert: true);
    if (_isCurrent(generation)) await refresh();
  }

  void _tick() {
    if (!_running || !_foreground) return;
    _sync(alert: true);
  }

  // ── Nhận dữ liệu ──────────────────────────────────────────────────────────

  Future<void> _sync({required bool alert}) async {
    if (!_running || !_foreground || _syncing) return;
    _syncing = true;
    final generation = _sessionGeneration;
    try {
      final result = await _repo.sync();
      if (!_isCurrent(generation)) return;
      final changedUnread = _unread != result.unread;
      _unread = result.unread;
      final added = _ingest(result.items);
      if (alert) await _alert(result.items);
      if (_isCurrent(generation) && !added && changedUnread) notifyListeners();
    } catch (_) {
      // Mất mạng tạm thời: thử lại ở chu kỳ sau.
    } finally {
      if (_isCurrent(generation)) _syncing = false;
    }
  }

  /// Thêm các thông báo chưa từng thấy vào danh sách. Trả `true` nếu có mục mới.
  bool _ingest(List<AppNotification> incoming) {
    final fresh = <AppNotification>[];
    var readChanged = false;
    for (final item in incoming) {
      if (_seen.add(item.id)) {
        fresh.add(item);
      } else {
        for (final existing in _items) {
          if (existing.id == item.id && existing.isRead != item.isRead) {
            existing.isRead = item.isRead;
            readChanged = true;
          }
        }
      }
    }
    if (fresh.isEmpty) {
      if (readChanged) notifyListeners();
      return false;
    }

    _items.addAll(fresh);
    _items.sort(_newestFirst);
    if (_items.length > _maxItems) _items.removeRange(_maxItems, _items.length);
    notifyListeners();

    // Thay đổi đến từ web/hệ thống: làm mới ví, danh mục và các màn hình đang mở.
    final external = fresh
        .where((item) => !item.fromThisApp && item.entityType != 'security');
    if (external.isNotEmpty) data.markChanged();

    return true;
  }

  static int _newestFirst(AppNotification a, AppNotification b) {
    final left = a.createdAt;
    final right = b.createdAt;
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right.compareTo(left);
  }

  Future<void> _alert(List<AppNotification> items) async {
    final owner = tokens.ownerId;
    if (owner == null) return;
    final server = config.apiRoot;
    final generation = _sessionGeneration;
    await _delivery.deliver(items, '$server|$owner',
        isCurrent: () =>
            _running &&
            generation == _sessionGeneration &&
            tokens.ownerId == owner &&
            config.apiRoot == server);
  }

  // ── Thao tác của người dùng ───────────────────────────────────────────────

  /// Tải lại danh sách thông báo mới nhất cho màn "Thông báo".
  Future<void> refresh() async {
    if (!_running) return;
    final generation = _sessionGeneration;
    final request = ++_refreshGeneration;
    bool current() => _isCurrent(generation) && request == _refreshGeneration;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final page = await _repo.list(pageSize: 60);
      if (!current()) return;
      _ingest(page.items);
      _items
        ..clear()
        ..addAll(page.items);
      _items.sort(_newestFirst);
      for (final item in page.items) {
        _seen.add(item.id);
      }
      _unread = page.unread;
      await _alert(page.items);
    } on ApiException catch (error) {
      if (current()) _error = error.message;
    } catch (_) {
      if (current()) _error = 'Không tải được thông báo. Vui lòng thử lại.';
    } finally {
      if (current()) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> markRead(AppNotification item) async {
    if (!_running || item.isRead) return;
    final generation = _sessionGeneration;
    item.isRead = true;
    if (_unread > 0) _unread--;
    notifyListeners();
    try {
      final unread = await _repo.markRead(item.id);
      if (!_isCurrent(generation)) return;
      _unread = unread;
      notifyListeners();
    } catch (_) {
      // Trạng thái sẽ được đối soát ở lần đồng bộ kế tiếp.
    }
  }

  Future<void> markAllRead() async {
    if (!_running) return;
    final generation = _sessionGeneration;
    await _repo.markAllRead();
    if (!_isCurrent(generation)) return;
    for (final item in _items) {
      item.isRead = true;
    }
    _unread = 0;
    notifyListeners();
  }

  Future<void> remove(AppNotification item) async {
    if (!_running) return;
    final generation = _sessionGeneration;
    final index = _items.indexOf(item);
    if (index < 0) return;
    _items.removeAt(index);
    if (!item.isRead && _unread > 0) _unread--;
    notifyListeners();
    try {
      await _repo.remove(item.id);
    } catch (_) {
      if (!_isCurrent(generation)) return;
      if (!_items.any((n) => n.id == item.id)) {
        _items.add(item);
        _items.sort(_newestFirst);
        if (!item.isRead) _unread++;
      }
      _error = 'Chưa xóa được thông báo. Vui lòng thử lại.';
      notifyListeners();
    }
  }

  Future<void> clearRead() async {
    if (!_running) return;
    final generation = _sessionGeneration;
    await _repo.clearRead();
    if (!_isCurrent(generation)) return;
    _items.removeWhere((item) => item.isRead);
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
