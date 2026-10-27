import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:capitalflow_mobile/services/invoice_queue_runner.dart';
import 'package:capitalflow_mobile/services/invoice_queue_store.dart';
import 'test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late ApiHarness h;
  late InvoiceQueueStore store;
  late QueueSession session;
  late Directory dir;
  late DateTime now;
  final bytes = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
  setUp(() async {
    h = ApiHarness();
    await h.init((_) async => jsonResponse({}), refreshEnabled: false);
    dir = await Directory.systemTemp.createTemp('capitalflow-queue-test-');
    now = DateTime(2026, 10, 23);
    store = await InvoiceQueueStore.open(path: '${dir.path}/queue.db',
      factory: databaseFactoryFfi, clock: () => now);
    session = await store.activate(h.config.apiRoot, 'owner-a');
  });
  tearDown(() async {
    h.dispose();
    await store.db.close();
    await dir.delete(recursive: true); // Only the temp directory created by this test.
  });
  Future<QueuedInvoice> enqueue() => store.enqueue(session, bytes, 'qa.png', 'CAMERA');
  Future<QueuedInvoice> job() async => (await store.list(session.scope)).single;
  Future<void> handler(Future<http.Response> Function(http.Request) respond) async {
    h.dispose();
    await h.init(respond, refreshEnabled: false);
  }

  test('Exact queued bytes coalesce; bytes and request key survive database reopen', () async {
    final first = await enqueue();
    expect((await enqueue()).id, first.id);
    await store.db.close();
    store = await InvoiceQueueStore.open(path: '${dir.path}/queue.db',
      factory: databaseFactoryFfi, clock: () => now);
    session = await store.activate(h.config.apiRoot, 'owner-a');
    final claimed = (await store.claim(session))!;
    expect(claimed.requestKey, first.requestKey);
    expect(await store.bytes(claimed), bytes);
    expect(await store.claim(session), isNull); // A live lease cannot be claimed twice.
  });

  test('Offline/lost upload keeps bytes and replays same key, then OCR only once', () async {
    final requests = <http.Request>[];
    var offline = true;
    await handler((r) async {
      requests.add(r);
      if (offline) throw const SocketException('offline');
      if (r.url.path.endsWith('/invoices')) return jsonResponse(contract('upload_replayed'));
      if (r.method == 'GET') return jsonResponse({'status': 'UPLOADED', 'deleted_at': null});
      return jsonResponse({'queued': true});
    });
    final first = await enqueue();
    final runner = InvoiceQueueRunner(store, h.api, session);
    await runner.run(limit: 40);
    expect((await job()).state, 'retry');
    expect((await job()).attempts, 1);
    expect((await job()).requestKey, first.requestKey);
    await runner.run();
    expect(requests.length, 1); // Backoff prevents hot retry.
    offline = false;
    now = now.add(const Duration(seconds: 16));
    await runner.run(limit: 40);
    expect((await job()).state, 'done');
    expect(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
    expect(requests.where((r) => r.url.path.endsWith('/ocr')).length, 1);
    expect(requests.any((r) => RegExp(r'confirm|restore|duplicate-resolution|transactions').hasMatch(r.url.path)), false);
    expect((await store.db.query('invoice_queue', columns: ['content'])).single['content'], isNull);
  });

  test('Lost OCR response reconciles PROCESSING without scheduling a second OCR', () async {
    var ocrCalls = 0;
    var processing = false;
    await handler((r) async {
      if (r.url.path.endsWith('/invoices')) return jsonResponse(contract('upload_created'));
      if (r.method == 'GET') return jsonResponse({'status': processing ? 'PROCESSING' : 'UPLOADED'});
      ocrCalls++;
      processing = true;
      throw TimeoutException('OCR accepted, response lost');
    });
    await enqueue();
    final runner = InvoiceQueueRunner(store, h.api, session);
    await runner.run(limit: 40);
    expect((await job()).stage, 'ocr');
    expect((await job()).state, 'retry');
    now = now.add(const Duration(seconds: 16));
    await runner.run(limit: 40);
    expect((await job()).state, 'done');
    expect(ocrCalls, 1);
  });

  test('Hidden upload stops for explicit restoration and keeps the selected image', () async {
    var requests = 0;
    await handler((_) async { requests++; return jsonResponse(contract('upload_hidden')); });
    await enqueue();
    await InvoiceQueueRunner(store, h.api, session).run(limit: 40);
    expect((await job()).state, 'attention');
    expect((await job()).outcome, 'RESTORE_REQUIRED');
    expect(requests, 1);
    final content = (await store.db.query('invoice_queue', columns: ['content'])).single['content'];
    expect(content, bytes);
  });

  test('Account switch during upload rejects late response and does not send A data as B', () async {
    final sent = Completer<void>();
    final release = Completer<void>();
    final requests = <http.Request>[];
    await handler((r) async {
      requests.add(r); sent.complete(); await release.future;
      return jsonResponse(contract('upload_created'));
    });
    await enqueue();
    final pending = InvoiceQueueRunner(store, h.api, session).run(limit: 40);
    await sent.future;
    await h.tokens.clear();
    await h.tokens.save(access: jwt('owner-b'), refresh: 'b');
    final other = await store.activate(h.config.apiRoot, 'owner-b');
    release.complete();
    await pending;
    expect((await job()).remoteId, isNull);
    expect((await store.list(other.scope)), isEmpty);
    await InvoiceQueueRunner(store, h.api, other).run(limit: 40);
    expect(requests.length, 1);
    expect(requests.single.headers['Authorization'], 'Bearer ${jwt('owner-a')}');
    await h.tokens.save(access: jwt('owner-a'), refresh: 'a');
    session = await store.activate(h.config.apiRoot, 'owner-a');
    expect((await job()).state, 'waiting');
  });

  test('Pause, logout and stale generation stop claims; separate servers isolate queues', () async {
    await enqueue();
    await store.pause(session.scope, true);
    expect(await store.claim(session), isNull);
    await store.pause(session.scope, false);
    await store.deactivate();
    expect(await store.claim(session), isNull);
    await expectLater(enqueue(), throwsA(isA<QueueInterrupted>()));
    final other = await store.activate('https://another.invalid/api/v1', 'owner-a');
    expect(await store.list(other.scope), isEmpty);
    expect(await store.claim(session), isNull);
    expect(await store.list(session.scope), hasLength(1));
  });

  test('401 waits for foreground login; definitive 415 is attention, not an endless retry', () async {
    var status = 401;
    await handler((_) async => jsonResponse({'detail': 'rejected'}, status));
    await enqueue();
    final runner = InvoiceQueueRunner(store, h.api, session);
    await runner.run();
    expect((await job()).state, 'auth');
    await store.resumeAuth(session);
    status = 415;
    await runner.run();
    expect((await job()).state, 'attention');
  });

  test('Chunked 2MB image survives store roundtrip and corrupted bytes never upload', () async {
    var requests = 0;
    await handler((_) async { requests++; return jsonResponse({}); });
    final large = Uint8List(2 * 1024 * 1024 + 17)..fillRange(0, 2 * 1024 * 1024 + 17, 42);
    await store.enqueue(session, large, 'large.jpg', 'UPLOAD');
    final claimed = (await store.claim(session))!;
    expect(await store.bytes(claimed), large);
    await store.update(claimed, {'content': bytes, 'lease_id': null, 'lease_until': 0});
    await InvoiceQueueRunner(store, h.api, session).run();
    expect((await job()).state, 'attention');
    expect(requests, 0);
  });
}
