import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../ha_tang/api.dart';
import '../../du_lieu/mo_hinh.dart';

String requestUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final h = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

class AccountFeatures {
  AccountFeatures(this.api);
  final ApiClient api;
  Future<Json> subscription() async =>
      Map<String, dynamic>.from(await api.get('/billing/subscription') as Map);

  String _checkoutKey(String root, String owner) =>
      'cf_checkout_${sha256.convert(utf8.encode('$root|$owner'))}';

  Future<String?> activeCheckoutId() async {
    final owner = api.tokens.ownerId;
    if (owner == null) return null;
    final key = '${_checkoutKey(api.config.apiRoot, owner)}_active';
    return (await SharedPreferences.getInstance()).getString(key);
  }

  Future<Json?> resumeCheckout(String id) => _readOrder(id, refresh: false);

  Future<Json> refreshOrder(String id) async =>
      (await _readOrder(id, refresh: true))!;

  Future<Json?> _readOrder(String id, {required bool refresh}) async {
    final owner = api.tokens.ownerId;
    if (owner == null) throw StateError('Vui lòng đăng nhập lại.');
    final root = api.config.apiRoot;
    final epoch = api.tokens.epoch;
    final key = '${_checkoutKey(root, owner)}_active';
    final path = '/billing/orders/$id';
    final prefs = await SharedPreferences.getInstance();
    if (api.tokens.ownerId != owner ||
        api.config.apiRoot != root ||
        api.tokens.epoch != epoch) {
      throw StateError('Phiên đăng nhập đã thay đổi.');
    }
    try {
      final result = Map<String, dynamic>.from((refresh
          ? await api.post('$path/refresh')
          : await api.get(path)) as Map);
      if (!_canResume(result) && prefs.getString(key) == id) {
        await prefs.remove(key);
      }
      return result;
    } on ApiException catch (e) {
      if (!refresh && e.statusCode == 404) {
        if (prefs.getString(key) == id) await prefs.remove(key);
        return null;
      }
      rethrow;
    }
  }

  bool _canResume(Json order) =>
      const {'CREATING', 'PENDING', 'REVIEW'}.contains(order['status']);

  // Keep the request id across lost responses, then remember the active order
  // returned by the server. Both identifiers are scoped to server and owner.
  Future<Json> checkout({String? creatingOrderId}) async {
    final owner = api.tokens.ownerId;
    final root = api.config.apiRoot;
    final epoch = api.tokens.epoch;
    if (owner == null) throw StateError('Vui lòng đăng nhập lại.');
    final prefs = await SharedPreferences.getInstance();
    final key = _checkoutKey(root, owner);
    final id = creatingOrderId ?? prefs.getString(key) ?? requestUuid();
    await prefs.setString(key, id);
    if (api.tokens.ownerId != owner ||
        api.config.apiRoot != root ||
        api.tokens.epoch != epoch) {
      throw StateError('Phiên đăng nhập đã thay đổi.');
    }
    final result = Map<String, dynamic>.from(
        await api.post('/billing/checkout', body: {'request_id': id}) as Map);
    final orderId = result['id'];
    if (orderId is String && _canResume(result)) {
      await prefs.setString('${key}_active', orderId);
    }
    await prefs.remove(key);
    return result;
  }

  Future<void> revokeSession(String? id) async {
    await api.delete('/auth/sessions/${id ?? 'others'}');
  }

  Future<void> support(
      {required String id,
      required String title,
      required String message}) async {
    await api.post('/support/requests', body: {
      'request_id': id,
      'title': title.trim(),
      'message': message.trim()
    });
  }

  Future<void> accountSupport(
      {required String email, required String issue, String? contact}) async {
    await api.post('/support/account', auth: false, body: {
      'email': email.trim(),
      'issue': issue,
      if (contact?.trim().isNotEmpty == true) 'contact_email': contact!.trim()
    });
  }
}
