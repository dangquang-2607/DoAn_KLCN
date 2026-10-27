import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:capitalflow_mobile/models/models.dart';
import 'package:capitalflow_mobile/services/app_data.dart';
import 'package:capitalflow_mobile/services/app_settings.dart';
import 'package:capitalflow_mobile/services/notification_center.dart';
import 'package:capitalflow_mobile/services/system_notification_delivery.dart';
import 'test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late ApiHarness h;
  late AppSettings settings;
  late RecordingNotifier notifier;
  setUp(() async {
    h = ApiHarness();
    await h.init((_) async => jsonResponse({}));
    settings = AppSettings(h.prefs);
    notifier = RecordingNotifier();
  });
  tearDown(() { h.dispose(); settings.dispose(); });
  List<AppNotification> notifications() =>
      (contract('notifications')['items'] as List)
          .map((n) => AppNotification.fromJson(Map<String, dynamic>.from(n as Map))).toList();

  test('Blocked system post retries; concurrent refresh/poll and restart never double deliver', () async {
    final delivery = SystemNotificationDelivery(settings, notifier);
    notifier.succeeds = false;
    await delivery.deliver(notifications(), 'server|a', isCurrent: () => true);
    expect(notifier.calls.length, 2); // Read item excluded.
    notifier.succeeds = true;
    await Future.wait([
      delivery.deliver(notifications(), 'server|a', isCurrent: () => true),
      delivery.deliver(notifications(), 'server|a', isCurrent: () => true),
    ]);
    expect(notifier.calls.length, 4);
    await SystemNotificationDelivery(AppSettings(h.prefs), notifier)
        .deliver(notifications(), 'server|a', isCurrent: () => true);
    expect(notifier.calls.length, 4);
    expect(notifier.calls.last['important'], true);
    await delivery.deliver(notifications(), 'server|b', isCurrent: () => true);
    expect(notifier.calls.length, 6); // Receipts are owner scoped.
  });

  test('System summary, disabled push, own actions and stale session are respected', () async {
    final delivery = SystemNotificationDelivery(settings, notifier);
    final template = Map<String, dynamic>.from((contract('notifications')['items'] as List).last as Map);
    final batch = List.generate(5, (i) => AppNotification.fromJson({...template, 'id': 'n$i', 'read_at': null}));
    await settings.setPushEnabled(false);
    await delivery.deliver(batch, 's|a', isCurrent: () => true);
    expect(notifier.calls, isEmpty);
    await settings.setPushEnabled(true);
    var current = true;
    notifier.beforeReturn = () async { current = false; };
    await delivery.deliver(batch, 's|a', isCurrent: () => current);
    expect(notifier.calls.single['payload'], 'list');
    notifier.beforeReturn = null;
    current = true;
    await delivery.deliver(batch, 's|a', isCurrent: () => current);
    expect(notifier.calls.length, 2); // Stale delivery did not persist receipt.
    final own = AppNotification.fromJson({...template, 'id': 'own', 'read_at': null,
      'origin': 'MOBILE', 'severity': 'INFO'});
    await delivery.deliver([own], 's|a', isCurrent: () => true);
    expect(notifier.calls.length, 2);
    await settings.setAlertOwnActions(true);
    await delivery.deliver([own], 's|a', isCurrent: () => true);
    expect(notifier.calls.length, 3);
  });

  Future<NotificationCenter> centerWith(Future<http.Response> Function(http.Request) handler) async {
    h.dispose();
    await h.init(handler);
    final data = AppData(h.api);
    final center = NotificationCenter(api: h.api, config: h.config, tokens: h.tokens,
      settings: settings, notifier: notifier, data: data);
    addTearDown(() { center.stop(); center.dispose(); data.dispose(); });
    center.start();
    // Let initial REST sync and list settle without advancing the periodic timer.
    for (var i = 0; i < 20; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 2));
      if (center.items.isNotEmpty && !center.loading) break;
    }
    return center;
  }

  test('Read state/count reconcile and a temporary refresh error preserves the inbox', () async {
    var page = contract('notifications');
    var fail = false;
    final center = await centerWith((r) async {
      if (!r.url.path.contains('/notifications')) return jsonResponse([]);
      if (fail) return jsonResponse({'detail': 'temporary'}, 503);
      if (r.method == 'POST') {
        page = contract('notifications_after_read');
        return jsonResponse(contract('notification_read'));
      }
      return jsonResponse(page);
    });
    expect(center.unread, 2);
    final readId = contract('notification_read')['id'];
    await center.markRead(center.items.singleWhere((n) => n.id == readId));
    expect(center.unread, 1);
    expect(center.items.singleWhere((n) => n.id == readId).isRead, true);
    fail = true;
    await center.refresh();
    expect(center.items.length, 3);
    expect(center.unread, 1);
    expect(center.error, isNotNull);
    fail = false;
    await center.refresh();
    expect(center.error, isNull);
    expect(notifier.calls.length, 2);
  });

  test('Late mark-read response cannot change a stopped/new session counter', () async {
    final release = Completer<void>();
    final sent = Completer<void>();
    final center = await centerWith((r) async {
      if (!r.url.path.contains('/notifications')) return jsonResponse([]);
      if (r.method == 'POST') { sent.complete(); await release.future; return jsonResponse(contract('notification_read')); }
      return jsonResponse(contract('notifications'));
    });
    final pending = center.markRead(center.items.firstWhere((n) => !n.isRead));
    await sent.future;
    center.stop();
    release.complete();
    await pending;
    expect(center.items, isEmpty);
    expect(center.unread, 0);
  });

  test('Late refresh failure cannot leave an error in a logged-out inbox', () async {
    final release = Completer<void>();
    var delay = false;
    final center = await centerWith((r) async {
      if (!r.url.path.contains('/notifications')) return jsonResponse([]);
      if (delay) { await release.future; return jsonResponse({'detail': 'old failure'}, 503); }
      return jsonResponse(contract('notifications'));
    });
    delay = true;
    final pending = center.refresh();
    center.stop();
    release.complete();
    await pending;
    expect(center.error, isNull);
    expect(center.loading, false);
  });
}
