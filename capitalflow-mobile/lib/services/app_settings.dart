import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tùy chọn thông báo của người dùng, lưu trên thiết bị.
class AppSettings extends ChangeNotifier {
  AppSettings(this._prefs) {
    _pushEnabled = _prefs.getBool(_keyPush) ?? true;
    _alertOwnActions = _prefs.getBool(_keyOwn) ?? false;
    _reminderEnabled = _prefs.getBool(_keyReminder) ?? false;
    _reminderHour = _prefs.getInt(_keyReminderHour) ?? 21;
    _reminderMinute = _prefs.getInt(_keyReminderMinute) ?? 0;
  }

  static const String _keyPush = 'cf_push_enabled';
  static const String _keyOwn = 'cf_push_own_actions';
  static const String _keyReminder = 'cf_reminder_enabled';
  static const String _keyReminderHour = 'cf_reminder_hour';
  static const String _keyReminderMinute = 'cf_reminder_minute';
  static const String _keyLastSync = 'cf_notification_last_sync';
  static const String _keyLastAlerted = 'cf_notification_last_alerted';

  final SharedPreferences _prefs;

  late bool _pushEnabled;
  late bool _alertOwnActions;
  late bool _reminderEnabled;
  late int _reminderHour;
  late int _reminderMinute;

  /// Hiện thông báo hệ thống (banner) khi có thay đổi từ web hoặc cảnh báo ngân sách.
  bool get pushEnabled => _pushEnabled;

  /// Hiện banner cả cho thao tác vừa thực hiện ngay trên điện thoại này.
  bool get alertOwnActions => _alertOwnActions;

  List<String> deliveredNotifications(String scope) =>
      _prefs.getStringList('cf_notifications_delivered_$scope') ?? [];

  Future<void> rememberNotifications(String scope, Iterable<String> ids) async {
    final all = <String>{...deliveredNotifications(scope), ...ids}.toList();
    await _prefs.setStringList('cf_notifications_delivered_$scope',
        all.length > 500 ? all.sublist(all.length - 500) : all);
  }

  /// Nhắc ghi chép chi tiêu hằng ngày vào giờ đã chọn.
  bool get reminderEnabled => _reminderEnabled;
  int get reminderHour => _reminderHour;
  int get reminderMinute => _reminderMinute;

  /// Mốc đồng bộ thông báo gần nhất (server_time), dùng để lấy phần còn thiếu khi mở lại ứng dụng.
  String? get lastSync => _prefs.getString(_keyLastSync);

  Future<void> setLastSync(String? value) async {
    if (value == null || value.isEmpty) {
      await _prefs.remove(_keyLastSync);
    } else {
      await _prefs.setString(_keyLastSync, value);
    }
  }

  /// Thời điểm tạo (ISO-8601) của thông báo mới nhất đã hiện banner, để không báo lặp
  /// khi mở lại ứng dụng.
  String? get lastAlerted => _prefs.getString(_keyLastAlerted);

  Future<void> setLastAlerted(String? value) async {
    if (value == null || value.isEmpty) {
      await _prefs.remove(_keyLastAlerted);
    } else {
      await _prefs.setString(_keyLastAlerted, value);
    }
  }

  Future<void> setPushEnabled(bool value) async {
    _pushEnabled = value;
    notifyListeners();
    await _prefs.setBool(_keyPush, value);
  }

  Future<void> setAlertOwnActions(bool value) async {
    _alertOwnActions = value;
    notifyListeners();
    await _prefs.setBool(_keyOwn, value);
  }

  Future<void> setReminder(
      {required bool enabled, int? hour, int? minute}) async {
    _reminderEnabled = enabled;
    if (hour != null) _reminderHour = hour;
    if (minute != null) _reminderMinute = minute;
    notifyListeners();
    await _prefs.setBool(_keyReminder, enabled);
    await _prefs.setInt(_keyReminderHour, _reminderHour);
    await _prefs.setInt(_keyReminderMinute, _reminderMinute);
  }
}
