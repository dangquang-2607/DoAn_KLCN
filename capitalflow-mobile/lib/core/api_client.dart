import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';
import 'file_digest.dart';
import 'token_store.dart';

/// Lỗi đã được chuẩn hóa thành thông báo tiếng Việt để hiển thị cho người dùng.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.detail = const {}});

  final Map<String, dynamic> detail;
  String? get code => detail['code']?.toString();
  bool get uncertain =>
      statusCode == null ||
      statusCode! >= 500 ||
      statusCode == 408 ||
      statusCode == 429;

  final String message;

  /// Mã HTTP; `null` nghĩa là không kết nối được tới máy chủ.
  final int? statusCode;

  bool get isNetwork => statusCode == null;

  @override
  String toString() => message;
}

/// HTTP client duy nhất của ứng dụng mobile.
///
/// - Gắn access token và tự làm mới bằng refresh token khi gặp 401 (các request
///   đồng thời dùng chung một lần refresh).
/// - Gắn `Idempotency-Key` cho thao tác tiền để thử lại mạng không tạo bản ghi trùng.
/// - Gắn `X-Client-Platform: mobile` để backend ghi nhận nguồn thao tác, nhờ đó
///   thông báo phát sinh từ web được đẩy về điện thoại.
class ApiClient {
  ApiClient(
      {required this.config,
      required this.tokens,
      http.Client? client,
      this.refreshEnabled = true})
      : _http = client ?? http.Client();

  final bool refreshEnabled;
  void close() => _http.close();
  final AppConfig config;
  final TokenStore tokens;
  final http.Client _http;
  final Random _random = Random.secure();

  /// Được gọi khi phiên không thể khôi phục (refresh token hết hạn/bị thu hồi).
  void Function()? onSessionExpired;

  static const Duration _timeout = Duration(seconds: 25);
  static const Duration _uploadTimeout = Duration(seconds: 90);
  static const String deviceName = 'CapitalFlow Mobile (Android)';

  Future<bool>? _refreshInFlight;

  // ── API công khai ─────────────────────────────────────────────────────────

  Future<dynamic> get(String path,
      {Map<String, dynamic>? query,
      bool auth = true,
      Future<void> Function()? beforeSend}) {
    return _request('GET', path,
        query: query, auth: auth, beforeSend: beforeSend);
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool auth = true,
    bool money = false,
    Future<void> Function()? beforeSend,
  }) {
    return _request('POST', path,
        query: query,
        body: body,
        auth: auth,
        money: money,
        beforeSend: beforeSend);
  }

  Future<dynamic> patch(String path, {Object? body, bool money = false}) {
    return _request('PATCH', path, body: body, money: money);
  }

  Future<dynamic> put(String path, {Object? body}) {
    return _request('PUT', path, body: body);
  }

  Future<dynamic> delete(
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool money = false,
  }) {
    return _request('DELETE', path, query: query, body: body, money: money);
  }

  /// Tải một file lên bằng multipart/form-data (dùng cho hóa đơn).
  Future<dynamic> uploadFile(
    String path, {
    required List<int> bytes,
    required String filename,
    String field = 'file',
    String source = 'UPLOAD',
    String? requestKey,
    Future<void> Function()? beforeSend,
  }) async {
    final uploadEpoch = tokens.epoch;
    final uploadRoot = config.apiRoot;
    final uploadOwner = tokens.ownerId;
    final frozen = Uint8List.fromList(bytes);
    // The durable queue already supplies its persisted idempotency key.
    // Only callers without that key need a content signature here.
    final signature = requestKey == null ? await fileDigest(frozen) : '';
    if (uploadEpoch != tokens.epoch ||
        uploadRoot != config.apiRoot ||
        uploadOwner != tokens.ownerId) {
      throw ApiException('Phiên đã thay đổi. Hãy mở lại hóa đơn.',
          statusCode: 401);
    }
    return _invoiceMutation(path, '$source:$signature', (key, checkSession) {
      Future<http.Response> perform() async {
        checkSession();
        final request = http.MultipartRequest('POST', _uri(path));
        request.headers
            .addAll(_headers(auth: true, json: false, idempotencyKey: key));
        request.fields['source'] = source;
        request.files.add(
            http.MultipartFile.fromBytes(field, frozen, filename: filename));
        final streamed = await _http.send(request);
        return http.Response.fromStream(streamed);
      }

      return _execute(perform,
          auth: true,
          timeout: _uploadTimeout,
          checkSession: checkSession,
          beforeSend: beforeSend);
    }, requestKey: requestKey);
  }

  /// Giữ khóa và nội dung cho lần thử lại khi chưa biết máy chủ đã ghi sổ hay chưa.
  Future<dynamic> invoicePost(String path, Map<String, dynamic> body) {
    final encoded = utf8.encode(jsonEncode(body));
    return _invoiceMutation(path, sha256.convert(encoded).toString(),
        (key, checkSession) {
      Future<http.Response> perform() {
        checkSession();
        return _http.post(_uri(path),
            body: encoded,
            headers: _headers(auth: true, json: true, idempotencyKey: key));
      }

      return _execute(perform,
          auth: true, timeout: _timeout, checkSession: checkSession);
    });
  }

  String? get _owner {
    try {
      final part = tokens.accessToken!.split('.')[1];
      return (jsonDecode(
                  utf8.decode(base64Url.decode(base64Url.normalize(part))))
              as Map)['sub']
          ?.toString();
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _invoiceMutation(String path, String signature,
      Future<dynamic> Function(String, void Function()) send,
      {String? requestKey}) async {
    final owner = _owner;
    final root = config.apiRoot;
    final epoch = tokens.epoch;
    void checkSession() {
      if (owner == null ||
          _owner != owner ||
          root != config.apiRoot ||
          epoch != tokens.epoch) {
        throw ApiException('Phiên đã thay đổi. Hãy mở lại hóa đơn.',
            statusCode: 401);
      }
    }

    checkSession();
    if (requestKey != null) {
      final result = await send(requestKey, checkSession);
      checkSession();
      return result;
    }
    final prefs = await SharedPreferences.getInstance();
    checkSession();
    final slot =
        'cf_pending_invoice_${sha256.convert(utf8.encode('$root|$owner|$path|$signature'))}';
    final key = prefs.getString(slot) ?? _newIdempotencyKey();
    await prefs.setString(slot, key);
    try {
      checkSession();
      final result = await send(key, checkSession);
      checkSession();
      await prefs.remove(slot);
      return result;
    } on ApiException catch (error) {
      if (!error.uncertain && error.statusCode != 401) await prefs.remove(slot);
      rethrow;
    }
  }

  /// Tải nội dung nhị phân (ảnh/PDF hóa đơn gốc) kèm xác thực.
  Future<Uint8List> getBytes(String path) async {
    Future<http.Response> perform() {
      return _http.get(_uri(path), headers: _headers(auth: true, json: false));
    }

    final response = await _guard(() async {
      var result = await perform().timeout(_uploadTimeout);
      if (result.statusCode == 401 && await refreshSession()) {
        result = await perform().timeout(_uploadTimeout);
      }
      return result;
    });
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    }
    if (response.statusCode == 401) onSessionExpired?.call();
    throw ApiException(_errorMessage(response),
        statusCode: response.statusCode);
  }

  /// Đổi refresh token lấy cặp token mới. Trả `false` khi máy chủ từ chối
  /// (phiên hết hạn/bị thu hồi); ném [ApiException] khi mất kết nối.
  Future<bool> refreshSession() {
    return _refreshInFlight ??= _runRefresh();
  }

  /// Kiểm tra nhanh máy chủ có phản hồi hay không (dùng ở màn cấu hình).
  Future<bool> ping(String baseUrl) async {
    try {
      final uri = Uri.parse('${AppConfig.normalizeBaseUrl(baseUrl)}/health');
      final response = await _http.get(uri).timeout(const Duration(seconds: 6));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // ── Nội bộ ────────────────────────────────────────────────────────────────

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final uri = Uri.parse('${config.apiRoot}$path');
    if (query == null) return uri;
    final cleaned = <String, String>{};
    query.forEach((key, value) {
      if (value == null) return;
      final text = value.toString();
      if (text.isEmpty) return;
      cleaned[key] = text;
    });
    return cleaned.isEmpty ? uri : uri.replace(queryParameters: cleaned);
  }

  Map<String, String> _headers(
      {required bool auth, required bool json, String? idempotencyKey}) {
    final headers = <String, String>{
      'Accept': 'application/json',
      'X-Client-Platform': 'mobile',
      'X-Device-Name': deviceName,
    };
    if (json) headers['Content-Type'] = 'application/json';
    if (idempotencyKey != null) headers['Idempotency-Key'] = idempotencyKey;
    final token = tokens.accessToken;
    if (auth && token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  String _newIdempotencyKey() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final buffer = StringBuffer('m-');
    for (var i = 0; i < 30; i++) {
      buffer.write(alphabet[_random.nextInt(alphabet.length)]);
    }
    return buffer.toString();
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool auth = true,
    bool money = false,
    Future<void> Function()? beforeSend,
  }) {
    // Một khóa cho cả lần gọi đầu và lần gọi lại sau khi refresh token.
    final idempotencyKey = money ? _newIdempotencyKey() : null;
    final List<int>? encoded =
        body == null ? null : utf8.encode(jsonEncode(body));

    Future<http.Response> perform() {
      final uri = _uri(path, query);
      final headers = _headers(
          auth: auth, json: encoded != null, idempotencyKey: idempotencyKey);
      switch (method) {
        case 'GET':
          return _http.get(uri, headers: headers);
        case 'POST':
          return _http.post(uri, headers: headers, body: encoded);
        case 'PATCH':
          return _http.patch(uri, headers: headers, body: encoded);
        case 'PUT':
          return _http.put(uri, headers: headers, body: encoded);
        case 'DELETE':
          return _http.delete(uri, headers: headers, body: encoded);
        default:
          throw ArgumentError('Phương thức HTTP không hỗ trợ: $method');
      }
    }

    return _execute(perform,
        auth: auth, timeout: _timeout, beforeSend: beforeSend);
  }

  Future<dynamic> _execute(
    Future<http.Response> Function() perform, {
    required bool auth,
    required Duration timeout,
    void Function()? checkSession,
    Future<void> Function()? beforeSend,
  }) async {
    final response = await _guard(() async {
      await beforeSend?.call();
      var result = await perform().timeout(timeout);
      checkSession?.call();
      await beforeSend?.call();
      if (result.statusCode == 401 &&
          auth &&
          refreshEnabled &&
          await refreshSession()) {
        checkSession?.call();
        await beforeSend?.call();
        result = await perform().timeout(timeout);
        await beforeSend?.call();
      }
      return result;
    });
    checkSession?.call();
    return _decode(response, auth: auth);
  }

  /// Quy mọi lỗi mạng về một [ApiException] dễ hiểu.
  Future<http.Response> _guard(Future<http.Response> Function() action) async {
    try {
      return await action();
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw ApiException('Máy chủ phản hồi quá lâu. Vui lòng thử lại.');
    } on SocketException {
      throw ApiException(_offlineMessage);
    } on HandshakeException {
      throw ApiException('Không thiết lập được kết nối bảo mật tới máy chủ.');
    } on http.ClientException {
      throw ApiException(_offlineMessage);
    } on FormatException {
      throw ApiException(
          'Địa chỉ máy chủ không hợp lệ. Hãy kiểm tra lại trong phần Máy chủ.');
    }
  }

  String get _offlineMessage =>
      'Không kết nối được máy chủ ${config.baseUrl}. ${AppConfig.connectionHelp(config.baseUrl)}';

  dynamic _decode(http.Response response, {required bool auth}) {
    final status = response.statusCode;
    if (status >= 200 && status < 300) {
      if (response.bodyBytes.isEmpty) return null;
      final text = utf8.decode(response.bodyBytes, allowMalformed: true);
      if (text.trim().isEmpty) return null;
      try {
        return jsonDecode(text);
      } catch (_) {
        return text;
      }
    }
    if (status == 401 && auth) onSessionExpired?.call();
    throw ApiException(_errorMessage(response),
        statusCode: status, detail: _errorDetail(response));
  }

  Map<String, dynamic> _errorDetail(http.Response response) {
    try {
      final value = jsonDecode(utf8.decode(response.bodyBytes))['detail'];
      return value is Map ? Map<String, dynamic>.from(value) : {};
    } catch (_) {
      return {};
    }
  }

  /// Rút thông báo lỗi từ trường `detail` của FastAPI (chuỗi hoặc danh sách lỗi validate).
  String _errorMessage(http.Response response) {
    try {
      final decoded =
          jsonDecode(utf8.decode(response.bodyBytes, allowMalformed: true));
      if (decoded is Map) {
        final detail =
            decoded['detail'] ?? decoded['error'] ?? decoded['message'];
        if (detail is String && detail.trim().isNotEmpty) return detail;
        if (detail is Map && detail['message'] is String) {
          return detail['message'] as String;
        }
        if (detail is List && detail.isNotEmpty) {
          final messages = <String>[];
          for (final item in detail) {
            if (item is Map && item['msg'] != null) {
              messages.add(
                  item['msg'].toString().replaceFirst('Value error, ', ''));
            }
          }
          if (messages.isNotEmpty) return messages.join('. ');
        }
      }
    } catch (_) {
      // Phản hồi không phải JSON: dùng thông báo theo mã lỗi bên dưới.
    }
    switch (response.statusCode) {
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền thực hiện thao tác này.';
      case 404:
        return 'Không tìm thấy dữ liệu yêu cầu.';
      case 413:
        return 'Tệp quá lớn (tối đa 10 MB).';
      case 429:
        return 'Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.';
      default:
        return 'Không thể hoàn tất thao tác (mã ${response.statusCode}). Vui lòng thử lại.';
    }
  }

  Future<bool> _runRefresh() async {
    try {
      return await _doRefresh();
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<bool> _doRefresh() async {
    final refresh = tokens.refreshToken;
    final epoch = tokens.epoch;
    final root = config.apiRoot;
    if (refresh == null || refresh.isEmpty) return false;
    final response = await _guard(() {
      return _http
          .post(
            _uri('/auth/refresh'),
            headers: _headers(auth: false, json: true),
            body: utf8.encode(jsonEncode({'refresh_token': refresh})),
          )
          .timeout(_timeout);
    });
    if (response.statusCode >= 500 || response.statusCode == 429) {
      throw ApiException('Chưa làm mới được phiên. Vui lòng thử lại.',
          statusCode: response.statusCode);
    }
    if (response.statusCode != 200) return false;
    if (tokens.epoch != epoch ||
        tokens.refreshToken != refresh ||
        config.apiRoot != root) {
      return false;
    }
    try {
      final data =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      await tokens.save(
        access: data['access_token'] as String,
        refresh: data['refresh_token'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
