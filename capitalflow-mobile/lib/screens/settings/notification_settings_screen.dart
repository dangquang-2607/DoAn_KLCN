import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../services/app_settings.dart';
import '../../services/local_notifier.dart';
import '../../widgets/common.dart';

/// Cài đặt thông báo đẩy, cảnh báo ngân sách và nhắc ghi chép chi tiêu hằng ngày.
class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  Future<void> _togglePush(BuildContext context, bool value) async {
    final settings = context.read<AppSettings>();
    final notifier = context.read<LocalNotifier>();
    if (value) {
      final granted = await notifier.requestPermission();
      if (!granted) {
        showSnack(
          notifier.lastError ??
              'Hãy bật thông báo trong Cài đặt > Ứng dụng > CapitalFlow > Thông báo.',
          error: true,
        );
        return;
      }
    }
    await settings.setPushEnabled(value);
  }

  Future<void> _toggleReminder(BuildContext context, bool value) async {
    final settings = context.read<AppSettings>();
    final notifier = context.read<LocalNotifier>();
    if (!value) {
      await notifier.cancelDailyReminder();
      await settings.setReminder(enabled: false);
      return;
    }
    await notifier.requestPermission();
    final scheduled = await notifier.scheduleDailyReminder(
      hour: settings.reminderHour,
      minute: settings.reminderMinute,
    );
    await settings.setReminder(enabled: scheduled);
    if (!scheduled) {
      showSnack(
          'Không đặt được lịch nhắc. Hãy kiểm tra quyền thông báo của ứng dụng.',
          error: true);
    }
  }

  Future<void> _pickTime(BuildContext context) async {
    final settings = context.read<AppSettings>();
    final notifier = context.read<LocalNotifier>();
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
          hour: settings.reminderHour, minute: settings.reminderMinute),
      helpText: 'Giờ nhắc ghi chép',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
    );
    if (picked == null) return;
    var enabled = settings.reminderEnabled;
    if (enabled) {
      enabled = await notifier.scheduleDailyReminder(
          hour: picked.hour, minute: picked.minute);
    }
    await settings.setReminder(
        enabled: enabled, hour: picked.hour, minute: picked.minute);
    showSnack('Giờ nhắc: ${_time(picked.hour, picked.minute)} mỗi ngày.');
  }

  static String _time(int hour, int minute) {
    return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<AppSettings>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Thông báo & nhắc nhở'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const InfoBanner(
            message:
                'Khi app đang mở và kết nối được máy chủ, thông báo mới được kiểm tra mỗi 5 giây và hiện trong khay thông báo điện thoại. '
                'Thông báo đã hiện vẫn được giữ khi về màn hình chính. Chưa nhận thông báo mới tức thời khi app đã đóng.',
            icon: Icons.notifications_active_outlined,
          ),
          const SectionHeader('Thông báo trên điện thoại'),
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                SwitchListTile(
                  value: settings.pushEnabled,
                  onChanged: (value) => _togglePush(context, value),
                  title: const Text('Hiện thông báo trên điện thoại',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  subtitle: const Text(
                    'Banner và âm báo khi có thay đổi từ web, kết quả OCR hoặc cảnh báo ngân sách.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                SwitchListTile(
                  value: settings.alertOwnActions,
                  onChanged: settings.pushEnabled
                      ? (value) => settings.setAlertOwnActions(value)
                      : null,
                  title: const Text('Báo cả thao tác trên máy này',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  subtitle: const Text(
                    'Mặc định tắt: thao tác bạn vừa làm trên điện thoại chỉ được lưu vào lịch sử thông báo.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () async {
              final notifier = context.read<LocalNotifier>();
              final granted = await notifier.requestPermission();
              if (!granted) {
                showSnack('Ứng dụng chưa có quyền hiển thị thông báo.',
                    error: true);
                return;
              }
              final sent = await notifier.show(
                id: 700001,
                title: 'CapitalFlow hoạt động tốt',
                body:
                    'Đây là thông báo thử. Thông báo thật sẽ xuất hiện giống như thế này.',
                payload: 'list',
              );
              showSnack(
                  sent
                      ? 'Đã gửi thông báo thử. Kéo thanh trạng thái xuống để xem.'
                      : notifier.lastError ?? 'Không gửi được thông báo thử.',
                  error: !sent);
            },
            icon: const Icon(Icons.notifications_active_outlined, size: 18),
            label: const Text('Gửi thông báo thử'),
          ),
          const SectionHeader('Nhắc nhở chi tiêu'),
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                SwitchListTile(
                  value: settings.reminderEnabled,
                  onChanged: (value) => _toggleReminder(context, value),
                  title: const Text('Nhắc ghi chép hằng ngày',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  subtitle: const Text(
                    'Mỗi ngày một thông báo nhắc bạn ghi lại các khoản thu chi.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  onTap: () => _pickTime(context),
                  leading: const Icon(Icons.schedule, color: AppColors.muted),
                  title: const Text('Giờ nhắc',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  trailing: Text(
                    _time(settings.reminderHour, settings.reminderMinute),
                    style: moneyStyle.copyWith(
                        fontSize: 16, color: AppColors.blue),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const InfoBanner(
            message:
                'Cảnh báo ngân sách được gửi khi một khoản chi làm ngân sách chạm ngưỡng cảnh báo hoặc vượt hạn mức. '
                'Bạn chỉnh ngưỡng cho từng ngân sách trong mục Ngân sách.',
            icon: Icons.pie_chart_outline,
          ),
        ],
      ),
    );
  }
}
