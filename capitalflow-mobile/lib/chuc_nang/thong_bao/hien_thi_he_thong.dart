import 'dart:convert';
import 'package:crypto/crypto.dart';

import '../../du_lieu/mo_hinh.dart';
import 'tuy_chon.dart';
import 'nhac_cuc_bo.dart';

/// Inbox refresh and polling share the same durable delivery receipt.
/// A failed/blocked Android post remains eligible on the next sync.
class SystemNotificationDelivery {
  SystemNotificationDelivery(this.settings, this.notifier,
      {this.readBackgroundReceipts});
  final AppSettings settings;
  final LocalNotifier notifier;
  final Future<List<String>> Function()? readBackgroundReceipts;
  Future<void> _pending = Future.value();

  Future<void> deliver(List<AppNotification> items, String scope,
      {required bool Function() isCurrent}) {
    final snapshot = List<AppNotification>.of(items);
    return _pending = _pending.catchError((Object _) {}).then((_) async {
      if (!isCurrent() || !settings.pushEnabled) return;
      final key = sha256.convert(utf8.encode(scope)).toString();
      final delivered = settings.deliveredNotifications(key).toSet();
      final readBackground = readBackgroundReceipts;
      if (readBackground != null) {
        delivered.addAll(await readBackground());
      }
      if (!isCurrent()) return;
      final candidates = snapshot
          .where((item) =>
              !item.isRead &&
              !delivered.contains(item.id) &&
              (!item.fromThisApp || settings.alertOwnActions || item.isAlert))
          .toList();
      if (candidates.isEmpty) return;
      if (candidates.length > 3) {
        final sent = await notifier.show(
            id: _id('$key:summary'),
            title: 'CapitalFlow · ${candidates.length} thông báo mới',
            body: candidates.take(3).map((e) => e.title).join('\n'),
            payload: 'list',
            important: candidates.any((e) => e.isAlert));
        if (sent && isCurrent()) {
          await settings.rememberNotifications(
              key, candidates.map((e) => e.id));
        }
        return;
      }
      for (final item in candidates) {
        if (!isCurrent() || !settings.pushEnabled) return;
        final sent = await notifier.show(
            id: _id('$key:${item.id}'),
            title: item.title,
            body: item.body,
            payload: item.id,
            important: item.isAlert);
        if (sent && isCurrent()) {
          await settings.rememberNotifications(key, [item.id]);
        }
      }
    });
  }

  static int _id(String value) =>
      (int.parse(sha256.convert(utf8.encode(value)).toString().substring(0, 8),
              radix: 16) &
          0x3fffffff) +
      1000000;
}
