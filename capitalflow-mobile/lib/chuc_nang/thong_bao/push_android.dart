import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../ha_tang/api.dart';
import 'tuy_chon.dart';
import '../xac_thuc/phien_dang_nhap.dart';

/// Registers the native installation after notification permission is granted.
class BusinessPush {
  BusinessPush(this.api, this.auth, this.settings, this.onTap) {
    _enabled = settings.pushEnabled;
    _ownActions = settings.alertOwnActions;
    settings.addListener(_settingsChanged);
    api.config.addListener(_serverChanged);
    _lifecycle = AppLifecycleListener(onResume: () {
      unawaited(sync());
      unawaited(openFromNotification());
    });
  }

  final ApiClient api;
  final AuthController auth;
  final AppSettings settings;
  final ValueChanged<String> onTap;
  static const _native = MethodChannel('capitalflow/business_push');
  late final AppLifecycleListener _lifecycle;
  late bool _enabled;
  late bool _ownActions;
  int _generation = 0;
  Future<void>? _registering;
  DateTime? _nextCheck;

  void _settingsChanged() {
    if (_enabled == settings.pushEnabled &&
        _ownActions == settings.alertOwnActions) {
      return;
    }
    _enabled = settings.pushEnabled;
    _ownActions = settings.alertOwnActions;
    _nextCheck = null;
    if (_enabled) {
      _generation++;
      final inFlight = _registering;
      unawaited(inFlight == null ? sync() : inFlight.then((_) => sync()));
    } else {
      unawaited(deactivate(revoke: true));
    }
  }

  void _serverChanged() => unawaited(deactivate());

  Future<void> sync() {
    if (auth.status != AuthStatus.signedIn || !_enabled) return Future.value();
    if (_registering != null) return _registering!;
    if (_nextCheck?.isAfter(DateTime.now()) ?? false) return Future.value();
    final generation = _generation;
    final owner = api.tokens.ownerId;
    final root = api.config.apiRoot;
    final epoch = api.tokens.epoch;
    bool current() =>
        generation == _generation &&
        _enabled &&
        auth.status == AuthStatus.signedIn &&
        owner == api.tokens.ownerId &&
        root == api.config.apiRoot &&
        epoch == api.tokens.epoch;
    _registering = _register(current).whenComplete(() => _registering = null);
    return _registering!;
  }

  Future<void> _register(bool Function() current) async {
    try {
      final config = await api.get('/notifications/push/config');
      if (!current() || config is! Map || config['android_enabled'] != true) {
        return;
      }
      final token = await _native.invokeMethod<String>('token');
      if (token == null || !current()) return;
      final result = await api.post('/notifications/push/subscriptions',
          body: {'android_token': token, 'android_own_actions': _ownActions});
      if (!current() || result is! Map || result['id'] is! String) return;
      await _native.invokeMethod<void>('activate', result['id']);
      if (current()) {
        _nextCheck = DateTime.now().add(const Duration(minutes: 15));
      }
    } catch (_) {
      // Inbox polling remains available without Firebase, network or permission.
    }
  }

  Future<void> deactivate({bool revoke = false}) async {
    final generation = ++_generation;
    _nextCheck = null;
    try {
      final id = await _native.invokeMethod<String>('deactivate');
      if (revoke &&
          id != null &&
          generation == _generation &&
          auth.status == AuthStatus.signedIn) {
        await api.delete('/notifications/push/subscriptions/$id');
      }
    } catch (_) {
      // Native deactivation is independent of the network.
    }
  }

  Future<void> openFromNotification() async {
    if (auth.status != AuthStatus.signedIn) return;
    try {
      final id = await _native.invokeMethod<String>('takeTap');
      if (id != null && auth.status == AuthStatus.signedIn) onTap(id);
    } catch (_) {}
  }

  Future<List<String>> delivered() async {
    try {
      return await _native.invokeListMethod<String>('delivered') ?? [];
    } catch (_) {
      return [];
    }
  }

  void dispose() {
    _lifecycle.dispose();
    settings.removeListener(_settingsChanged);
    api.config.removeListener(_serverChanged);
  }
}
