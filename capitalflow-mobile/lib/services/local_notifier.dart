import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Hiển thị thông báo hệ thống của Android (banner + khay thông báo) và đặt lịch
/// nhắc ghi chép chi tiêu hằng ngày.
///
/// Trả kết quả gửi để caller chỉ ghi nhận đã báo khi Android nhận thành công.
class LocalNotifier {
  static const int reminderId = 900001;

  static const String _channelGeneral = 'capitalflow_activity';
  static const String _channelAlerts = 'capitalflow_alerts';
  static const String _channelReminder = 'capitalflow_reminder';

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  bool _ready = false;
  Future<void>? _initializing;
  String? lastError;
  String? _launchPayload;

  String? takeLaunchPayload() {
    final value = _launchPayload;
    _launchPayload = null;
    return value;
  }

  /// Gọi khi người dùng chạm vào một thông báo hệ thống; tham số là id thông báo.
  void Function(String? payload)? onTap;

  Future<void> init() => _initializing ??= _initialize().whenComplete(() {
        _initializing = null;
      });

  Future<void> _initialize() async {
    if (_ready) return;
    try {
      tzdata.initializeTimeZones();
      const android = AndroidInitializationSettings('ic_stat_capitalflow');
      const settings = InitializationSettings(android: android);
      final initialized = await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          onTap?.call(response.payload);
        },
      );
      _ready = initialized == true;
      lastError = _ready ? null : 'Chưa khởi tạo được thông báo Android.';
      if (_ready) {
        final launch = await _plugin.getNotificationAppLaunchDetails();
        if (launch?.didNotificationLaunchApp == true) {
          _launchPayload = launch?.notificationResponse?.payload ?? 'list';
        }
      }
    } catch (_) {
      _ready = false;
      lastError =
          'Không khởi tạo được thông báo Android. Hãy cập nhật và mở lại ứng dụng.';
    }
  }

  /// Xin quyền hiển thị thông báo (bắt buộc từ Android 13). Trả về `true` nếu được cấp.
  Future<bool> requestPermission() async {
    await init();
    if (!_ready) return false;
    try {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      final granted = await android?.requestNotificationsPermission();
      final enabled =
          granted == true && await android?.areNotificationsEnabled() == true;
      lastError = enabled
          ? null
          : 'Thông báo đang bị tắt. Hãy bật trong Cài đặt > Ứng dụng > CapitalFlow > Thông báo.';
      return enabled;
    } catch (_) {
      lastError = 'Không kiểm tra được quyền thông báo trên điện thoại.';
      return false;
    }
  }

  /// Hiện một thông báo ngay lập tức. [important] dùng kênh ưu tiên cao cho cảnh báo ngân sách.
  Future<bool> show({
    required int id,
    required String title,
    required String body,
    String? payload,
    bool important = false,
  }) async {
    await init();
    if (!_ready) return false;
    try {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      if (await android?.areNotificationsEnabled() != true) {
        lastError =
            'Thông báo đang bị tắt trong cài đặt Android của CapitalFlow.';
        return false;
      }
      final details = NotificationDetails(
        android: AndroidNotificationDetails(
          important ? _channelAlerts : _channelGeneral,
          important ? 'Cảnh báo ngân sách' : 'Hoạt động tài khoản',
          channelDescription: important
              ? 'Cảnh báo khi chi tiêu chạm hoặc vượt hạn mức ngân sách'
              : 'Thông báo khi dữ liệu tài chính thay đổi trên web hoặc thiết bị khác',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_stat_capitalflow',
          playSound: true,
          enableVibration: true,
          autoCancel: true,
          visibility: NotificationVisibility.private,
          styleInformation: BigTextStyleInformation(body),
        ),
      );
      await _plugin.show(id, title, body, details, payload: payload);
      lastError = null;
      return true;
    } catch (_) {
      lastError =
          'Chưa gửi được thông báo ra khay Android. Hãy kiểm tra quyền thông báo và thử lại.';
      return false;
    }
  }

  /// Đặt lịch nhắc hằng ngày vào [hour]:[minute] theo giờ của thiết bị.
  Future<bool> scheduleDailyReminder(
      {required int hour, required int minute}) async {
    await init();
    if (!_ready) return false;
    try {
      final now = DateTime.now();
      var next = DateTime(now.year, now.month, now.day, hour, minute);
      if (!next.isAfter(now)) next = next.add(const Duration(days: 1));
      // Quy về một mốc UTC tuyệt đối; lặp lại theo "giờ trong ngày" nên luôn rơi vào
      // đúng giờ địa phương đã chọn (Việt Nam không đổi giờ theo mùa).
      final utc = next.toUtc();
      final scheduled =
          tz.TZDateTime.utc(utc.year, utc.month, utc.day, utc.hour, utc.minute);
      const details = NotificationDetails(
        android: AndroidNotificationDetails(
          _channelReminder,
          'Nhắc ghi chép chi tiêu',
          channelDescription: 'Nhắc bạn ghi lại các khoản thu chi trong ngày',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
        ),
      );
      await _plugin.cancel(reminderId);
      await _plugin.zonedSchedule(
        reminderId,
        'Đừng quên ghi chép chi tiêu hôm nay',
        'Dành một phút ghi lại các khoản thu chi để ngân sách luôn chính xác.',
        scheduled,
        details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: DateTimeComponents.time,
        payload: 'reminder',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> cancelDailyReminder() async {
    await init();
    if (!_ready) return;
    try {
      await _plugin.cancel(reminderId);
    } catch (_) {
      // Không có lịch nào để hủy.
    }
  }
}
