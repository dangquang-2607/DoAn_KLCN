import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:capitalflow_mobile/core/api_client.dart';
import 'package:capitalflow_mobile/models/models.dart';
import 'package:capitalflow_mobile/services/repositories.dart';
import 'test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late ApiHarness h;
  setUp(() => h = ApiHarness());
  tearDown(() => h.dispose());

  test('Actual notification HTTP payload maps read_at, message, kind and unread_count', () async {
    final requests = <http.Request>[];
    await h.init((r) async {
      requests.add(r);
      if (r.method == 'POST') return jsonResponse(contract('notification_read'));
      return jsonResponse(contract(requests.any((r) => r.method == 'POST')
          ? 'notifications_after_read' : 'notifications'));
    });
    final repo = NotificationRepository(h.api);
    final page = await repo.list();
    expect(page.total, 3);
    expect(page.unread, 2);
    expect(page.items.where((n) => !n.isRead).length, 2);
    expect(page.items.first.body, 'Chi tiêu đã đạt 80% hạn mức.');
    expect(page.items.first.type, 'BUDGET_WARNING');
    expect(page.items.first.entityType, 'budget');
    expect(page.items.first.isAlert, isTrue);
    expect(await repo.markRead(contract('notification_read')['id'] as String), 1);
    expect(requests.last.url.queryParameters['page_size'], '1');
  });

  test('Actual invoice detail/list/upload preserve decimal strings, revision and posting identity', () async {
    await h.init((r) async => jsonResponse(contract('invoice_detail')));
    final detail = await InvoiceRepository(h.api).detail(contract('invoice_detail')['id'] as String);
    expect(detail.summary.totalAmount, 1120000);
    expect(detail.summary.transactionId, contract('invoice_confirm')['transaction_id']);
    final hidden = InvoiceDetail.fromJson(contract('invoice_hidden'));
    expect(hidden.summary.hidden, isTrue);
    expect(hidden.summary.revision, greaterThan(detail.summary.revision));
    final restored = InvoiceDetail.fromJson(contract('invoice_restored'));
    expect(restored.summary.hidden, isFalse);
    expect(restored.summary.transactionId, hidden.summary.transactionId);
    final uploaded = InvoiceSummary.fromJson(contract('upload_hidden'));
    expect(uploaded.hidden, isTrue);
    expect(uploaded.outcome, 'RESTORE_REQUIRED');
    for (final row in contract('invoice_page')['items'] as List) {
      expect(InvoiceSummary.fromJson(Map<String, dynamic>.from(row as Map)).totalAmount, 1120000);
    }
  });

  test('Actual structured 409 is exposed for exact duplicate and stale restore', () async {
    var response = contract('duplicate_exact_error');
    await h.init((_) async => jsonResponse(response, 409));
    await expectLater(h.api.invoicePost('/invoices/i/confirm', {'account_id': 'a'}),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'INVOICE_DUPLICATE_EXACT')));
    response = contract('restore_stale_error');
    await expectLater(h.api.invoicePost('/invoices/i/restore', {'expected_revision': 1}),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', response['detail']['code'])));
  });

  for (final status in [429, 500, 503]) {
    test('Refresh $status is temporary and never expires the session', () async {
      var expired = 0;
      await h.init((r) async => jsonResponse({'detail': 'temporary'},
          r.url.path.endsWith('/auth/refresh') ? status : 401));
      h.api.onSessionExpired = () => expired++;
      await expectLater(h.api.get('/notifications'), throwsA(isA<ApiException>()));
      expect(expired, 0);
      expect(h.tokens.hasSession, isTrue);
      expect(h.tokens.ownerId, 'owner-a');
    });
  }

  test('Concurrent 401s share one refresh and replay with rotated token', () async {
    final release = Completer<void>();
    var refreshes = 0;
    var initial = 0;
    await h.init((r) async {
      if (r.url.path.endsWith('/auth/refresh')) {
        refreshes++;
        await release.future;
        return jsonResponse({'access_token': jwt('owner-a'), 'refresh_token': 'rotated'});
      }
      if (initial++ < 2) return jsonResponse({}, 401);
      return jsonResponse({'ok': true});
    });
    final a = h.api.get('/a');
    final b = h.api.get('/b');
    await Future<void>.delayed(const Duration(milliseconds: 10));
    release.complete();
    await Future.wait([a, b]);
    expect(refreshes, 1);
    expect(h.tokens.refreshToken, 'rotated');
  });

  test('Lost confirmation response reuses key and exact body across client restart', () async {
    final requests = <http.Request>[];
    Future<http.Response> respond(http.Request r) async {
      requests.add(r);
      if (requests.length == 1) throw TimeoutException('response lost');
      return jsonResponse(contract('invoice_confirm_replay'), 201);
    }
    await h.init(respond);
    final body = {'account_id': 'wallet', 'expected_revision': 1};
    await expectLater(h.api.invoicePost('/invoices/i/confirm', body), throwsA(isA<ApiException>()));
    h.api.close();
    // Same durable preferences/token store, new client as after restarting the app.
    // Construct directly so the pending persisted key is not reset by init().
    final client = h.api = ApiClient(config: h.config, tokens: h.tokens,
        client: MockClient(respond));
    await client.invoicePost('/invoices/i/confirm', body);
    expect(requests[1].headers['Idempotency-Key'], requests[0].headers['Idempotency-Key']);
    expect(jsonDecode(requests[1].body), jsonDecode(requests[0].body));
    expect(h.prefs.getKeys().where((k) => k.startsWith('cf_pending_invoice_')), isEmpty);
  });

  test('Response from an old invoice session is rejected after account switch', () async {
    final release = Completer<void>();
    final sent = Completer<void>();
    await h.init((r) async { sent.complete(); await release.future; return jsonResponse(contract('invoice_confirm')); });
    final pending = h.api.invoicePost('/invoices/i/confirm', {'account_id': 'a'});
    final assertion = expectLater(pending, throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    await sent.future;
    await h.tokens.clear();
    await h.tokens.save(access: jwt('owner-b'), refresh: 'refresh-b');
    release.complete();
    await assertion;
    expect(h.tokens.ownerId, 'owner-b');
  });
}
