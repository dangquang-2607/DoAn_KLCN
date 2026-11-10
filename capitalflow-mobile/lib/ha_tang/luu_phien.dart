import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Lưu access token và refresh token trong vùng lưu trữ bảo mật của thiết bị
/// (Android Keystore). Token được giữ thêm trong bộ nhớ để gắn vào request
/// mà không phải đọc đĩa mỗi lần.
class TokenStore {
  static const String _keyAccess = 'cf_access_token';
  static const String _keyRefresh = 'cf_refresh_token';

  // ignore: prefer_const_constructors
  final FlutterSecureStorage _storage = FlutterSecureStorage();

  String? get ownerId {
    try {
      final payload = _access!.split('.')[1];
      return (jsonDecode(
              utf8.decode(base64Url.decode(base64Url.normalize(payload))))
          as Map)['sub'] as String?;
    } catch (_) {
      return null;
    }
  }

  int epoch = 0;
  String? _access;
  String? _refresh;
  bool _rememberSession = true;

  String? get accessToken => _access;
  String? get refreshToken => _refresh;
  bool get hasSession => (_refresh ?? '').isNotEmpty;
  bool get remembersSession => _rememberSession;

  /// Nạp token đã lưu khi mở ứng dụng. Nếu vùng lưu trữ bị hỏng (ví dụ sau khi
  /// khôi phục bản sao lưu) thì coi như chưa đăng nhập thay vì làm treo ứng dụng.
  Future<void> load({bool clearOnFailure = true}) async {
    try {
      _access = await _storage.read(key: _keyAccess);
      _refresh = await _storage.read(key: _keyRefresh);
    } catch (_) {
      _access = null;
      _refresh = null;
      try {
        if (clearOnFailure) await _storage.deleteAll();
      } catch (_) {
        // Không còn gì để dọn; người dùng sẽ đăng nhập lại.
      }
    }
  }

  Future<void> save({
    required String access,
    required String refresh,
    bool? rememberSession,
  }) async {
    // Login sets the policy. Token rotation keeps the existing policy.
    if (rememberSession == false) {
      await _deleteStoredTokens();
    }
    _rememberSession = rememberSession ?? _rememberSession;
    _access = access;
    _refresh = refresh;
    if (!_rememberSession) return;
    try {
      await _storage.write(key: _keyAccess, value: access);
      await _storage.write(key: _keyRefresh, value: refresh);
    } catch (_) {
      // Vẫn giữ phiên trong bộ nhớ; lần mở ứng dụng sau sẽ cần đăng nhập lại.
    }
  }

  Future<void> clear() async {
    epoch++;
    _access = null;
    _refresh = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      // Unresolved cf_pending_money_ keys survive logout so signing back in
      // as the same owner can safely retry. Their slots contain scoped hashes.
      for (final key in prefs
          .getKeys()
          .where((key) => key.startsWith('cf_pending_invoice_'))) {
        await prefs.remove(key);
      }
    } catch (_) {/* Các khóa không chứa dữ liệu hóa đơn hay token. */}
    try {
      await _deleteStoredTokens();
    } catch (_) {
      // Bỏ qua: token trong bộ nhớ đã được xóa.
    }
  }

  Future<void> _deleteStoredTokens() => Future.wait([
        _storage.delete(key: _keyAccess),
        _storage.delete(key: _keyRefresh),
      ]);
}
