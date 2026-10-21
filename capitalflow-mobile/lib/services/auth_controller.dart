import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/token_store.dart';
import '../models/models.dart';

enum AuthStatus {
  /// Đang kiểm tra phiên đã lưu khi mở ứng dụng.
  checking,
  signedOut,

  /// Đăng nhập bằng mật khẩu tạm do quản trị viên cấp: phải đặt mật khẩu mới.
  mustChangePassword,
  signedIn,
}

/// Quản lý phiên đăng nhập: đăng nhập, đăng ký, khôi phục phiên, đổi mật khẩu
/// và đăng xuất. Dùng chung tài khoản với bản web.
class AuthController extends ChangeNotifier {
  AuthController({required this.api, required this.tokens});

  final ApiClient api;
  final TokenStore tokens;

  AuthStatus _status = AuthStatus.checking;
  UserProfile? _profile;
  String? _notice;

  /// Móc nối để các dịch vụ khác (dữ liệu, thông báo) khởi động/dừng theo phiên.
  VoidCallback? onSignedIn;
  VoidCallback? onSignedOut;
  VoidCallback? onSigningOut;

  AuthStatus get status => _status;
  UserProfile? get profile => _profile;

  /// Thông báo một lần hiển thị ở màn đăng nhập (ví dụ "phiên đã hết hạn").
  String? takeNotice() {
    final value = _notice;
    _notice = null;
    return value;
  }

  /// Khôi phục phiên từ token đã lưu khi mở ứng dụng.
  Future<void> restore() async {
    await tokens.load();
    if (!tokens.hasSession) {
      _setStatus(AuthStatus.signedOut);
      return;
    }
    try {
      await _loadProfile();
    } on ApiException catch (error) {
      if (error.uncertain) {
        // Mất mạng: vẫn cho vào ứng dụng, các màn hình sẽ báo lỗi kết nối và cho thử lại.
        _setStatus(AuthStatus.signedIn);
        onSignedIn?.call();
      } else {
        await _clearSession();
      }
    }
  }

  Future<void> login(String email, String password) async {
    final data = await api.post(
      '/auth/login',
      auth: false,
      body: {'email': email.trim(), 'password': password},
    );
    final map = Map<String, dynamic>.from(data as Map);
    await tokens.save(
      access: map['access_token'] as String,
      refresh: map['refresh_token'] as String,
    );
    await _loadProfile();
  }

  Future<void> register(
      {required String fullName,
      required String email,
      required String password}) async {
    await api.post(
      '/auth/register',
      auth: false,
      body: {
        'full_name': fullName.trim(),
        'email': email.trim(),
        'password': password
      },
    );
  }

  Future<String> requestPasswordOtp(String email) async {
    final data = await api.post('/auth/forgot-password',
        auth: false, body: {'email': email.trim()});
    return (Map<String, dynamic>.from(data as Map)['message'] ?? '').toString();
  }

  Future<void> verifyOtp(String email, String otp) async {
    await api.post('/auth/verify-otp',
        auth: false, body: {'email': email.trim(), 'otp_code': otp});
  }

  Future<void> resetPassword(
      {required String email,
      required String otp,
      required String newPassword}) async {
    await api.post(
      '/auth/reset-password',
      auth: false,
      body: {
        'email': email.trim(),
        'otp_code': otp,
        'new_password': newPassword
      },
    );
  }

  /// Đổi mật khẩu. Backend thu hồi mọi phiên cũ nên ứng dụng quay về màn đăng nhập.
  Future<void> changePassword(
      {required String current, required String next}) async {
    await api.post('/auth/change-password',
        body: {'current_password': current, 'new_password': next});
    _notice =
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.';
    await _clearSession();
  }

  /// Đặt mật khẩu chính thức ở lần đăng nhập đầu bằng mật khẩu tạm.
  Future<void> setFirstPassword(String next) async {
    await api.post('/auth/first-time-password', body: {'new_password': next});
    _notice = 'Đã thiết lập mật khẩu mới. Vui lòng đăng nhập lại.';
    await _clearSession();
  }

  Future<List<LoginSession>> sessions() async {
    return asJsonList(await api.get('/auth/sessions'))
        .map(LoginSession.fromJson)
        .toList();
  }

  Future<void> refreshProfile() async {
    final data = await api.get('/auth/me');
    _profile = UserProfile.fromJson(Map<String, dynamic>.from(data as Map));
    notifyListeners();
  }

  Future<void> logout() async {
    onSigningOut?.call();
    final refresh = tokens.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await api.post('/auth/logout',
            auth: false, body: {'refresh_token': refresh});
      } catch (_) {
        // Thu hồi phía máy chủ là "cố gắng hết sức"; phiên cục bộ luôn được xóa.
      }
    }
    await _clearSession();
  }

  /// Được [ApiClient] gọi khi refresh token không còn dùng được.
  void handleSessionExpired() {
    if (_status == AuthStatus.signedOut || _status == AuthStatus.checking) {
      return;
    }
    _notice = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    _clearSession();
  }

  Future<void> _loadProfile() async {
    final data = await api.get('/auth/me');
    _profile = UserProfile.fromJson(Map<String, dynamic>.from(data as Map));
    if (_profile!.mustChangePassword) {
      _setStatus(AuthStatus.mustChangePassword);
      return;
    }
    _setStatus(AuthStatus.signedIn);
    onSignedIn?.call();
  }

  Future<void> _clearSession() async {
    final wasActive = _status == AuthStatus.signedIn ||
        _status == AuthStatus.mustChangePassword;
    // Đổi trạng thái đồng bộ trước để các lời gọi lặp (nhiều request cùng nhận 401)
    // không kích hoạt đăng xuất nhiều lần.
    _profile = null;
    _status = AuthStatus.signedOut;
    final pending = tokens.clear();
    if (wasActive) onSignedOut?.call();
    notifyListeners();
    await pending;
  }

  void _setStatus(AuthStatus value) {
    _status = value;
    notifyListeners();
  }
}
