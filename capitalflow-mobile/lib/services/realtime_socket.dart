import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// Kết nối WebSocket tới `/api/v1/notifications/ws` để nhận thông báo ngay khi
/// web (hoặc worker OCR/ngân sách) vừa ghi dữ liệu.
///
/// Tự kết nối lại với thời gian chờ tăng dần; khi máy chủ từ chối vì access token
/// hết hạn (mã đóng 4401) thì làm mới token rồi thử lại.
class RealtimeSocket {
  RealtimeSocket({
    required this.url,
    required this.accessToken,
    required this.refreshSession,
    required this.since,
    required this.onNotification,
    required this.onConnectionChanged,
  });

  /// Địa chỉ ws:// hiện hành (đọc lại mỗi lần kết nối vì người dùng có thể đổi máy chủ).
  final String Function() url;
  final String? Function() accessToken;
  final Future<bool> Function() refreshSession;

  /// Mốc thời gian để máy chủ gửi bù các thông báo phát sinh lúc mất kết nối.
  final String? Function() since;
  final void Function(Map<String, dynamic> data, int? unread) onNotification;
  final void Function(bool connected) onConnectionChanged;

  static const int _closeUnauthorized = 4401;

  WebSocket? _socket;
  Timer? _retryTimer;
  bool _active = false;
  bool _connecting = false;
  bool _connected = false;
  int _attempt = 0;

  bool get connected => _connected;

  void start() {
    if (_active) return;
    _active = true;
    _attempt = 0;
    _connect();
  }

  void stop() {
    _active = false;
    _retryTimer?.cancel();
    _retryTimer = null;
    final socket = _socket;
    _socket = null;
    _setConnected(false);
    if (socket != null) {
      socket.close().catchError((Object _) => null);
    }
  }

  /// Kết nối lại ngay (dùng khi ứng dụng quay lại nền trước hoặc đổi máy chủ).
  void reconnectNow() {
    if (!_active) return;
    _retryTimer?.cancel();
    _retryTimer = null;
    _attempt = 0;
    final socket = _socket;
    if (socket != null) {
      _socket = null;
      _setConnected(false);
      socket.close().catchError((Object _) => null);
    }
    _connect();
  }

  Future<void> _connect() async {
    if (!_active || _connecting || _socket != null) return;
    final token = accessToken();
    if (token == null || token.isEmpty) {
      _scheduleRetry();
      return;
    }
    _connecting = true;
    try {
      final socket = await WebSocket.connect(url()).timeout(const Duration(seconds: 10));
      if (!_active) {
        socket.close().catchError((Object _) => null);
        return;
      }
      _socket = socket;
      socket.pingInterval = const Duration(seconds: 20);
      socket.add(jsonEncode({'type': 'auth', 'token': token, 'since': since()}));
      socket.listen(
        _onData,
        onError: (Object _) => _onClosed(socket),
        onDone: () => _onClosed(socket),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleRetry();
    } finally {
      _connecting = false;
    }
  }

  void _onData(dynamic raw) {
    if (raw is! String) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      final message = Map<String, dynamic>.from(decoded);
      final unread = message['unread'] is num ? (message['unread'] as num).toInt() : null;
      switch (message['type']) {
        case 'ready':
          _attempt = 0;
          _setConnected(true);
          break;
        case 'notification':
          final data = message['data'];
          if (data is Map) onNotification(Map<String, dynamic>.from(data), unread);
          break;
        default:
          break;
      }
    } catch (_) {
      // Bỏ qua thông điệp không hợp lệ; kết nối vẫn được giữ.
    }
  }

  Future<void> _onClosed(WebSocket socket) async {
    if (!identical(_socket, socket)) return;
    final code = socket.closeCode;
    _socket = null;
    _setConnected(false);
    if (!_active) return;
    if (code == _closeUnauthorized) {
      // Access token hết hạn: đổi token rồi kết nối lại ngay nếu phiên còn hiệu lực.
      var renewed = false;
      try {
        renewed = await refreshSession();
      } catch (_) {
        renewed = false;
      }
      if (!_active) return;
      if (renewed) {
        _attempt = 0;
        _connect();
        return;
      }
    }
    _scheduleRetry();
  }

  void _scheduleRetry() {
    if (!_active) return;
    _retryTimer?.cancel();
    _attempt = _attempt < 6 ? _attempt + 1 : 6;
    final seconds = _attempt >= 5 ? 30 : (1 << _attempt);
    _retryTimer = Timer(Duration(seconds: seconds), _connect);
  }

  void _setConnected(bool value) {
    if (_connected == value) return;
    _connected = value;
    onConnectionChanged(value);
  }
}
