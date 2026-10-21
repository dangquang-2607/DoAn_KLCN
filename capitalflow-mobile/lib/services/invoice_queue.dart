import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';
import '../core/api_client.dart';
import '../screens/invoices/invoice_common.dart';
import 'invoice_queue_background.dart';
import 'invoice_queue_runner.dart';
import 'invoice_queue_store.dart';

class InvoiceQueue extends ChangeNotifier with WidgetsBindingObserver {
  InvoiceQueue(this.store, this.api,
      {this.onUploaded,
      Future<void> Function()? schedule,
      Future<void> Function()? cancel})
      : _scheduleWork = schedule ?? scheduleInvoiceBackground,
        _cancelWork = cancel ?? cancelInvoiceBackground;
  final Future<void> Function() _scheduleWork, _cancelWork;
  final InvoiceQueueStore store;
  final ApiClient api;
  final Future<void> Function()? onUploaded;
  QueueSession? _session;
  List<QueuedInvoice> _items = [];
  Timer? _timer;
  bool _foreground = true, _running = false, _disposed = false;
  int _activation = 0;
  Completer<void>? _ready;
  Future<void> get ready => _ready?.future ?? Future.value();
  String? error;
  String? backgroundNotice;
  QueueSession? get session => _session;
  List<QueuedInvoice> get items => List.unmodifiable(_items);
  bool get paused => _session?.paused ?? false;
  int get pendingCount => _items.where((e) => e.state != 'done').length;

  void observe() {
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_foreground && _session != null) unawaited(sync());
    });
    api.config.addListener(_serverChanged);
  }

  void _serverChanged() {
    unawaited(deactivate());
  }

  Future<void> activate() async {
    final owner = api.tokens.ownerId;
    if (owner == null) return;
    final generation = ++_activation;
    final ready = Completer<void>();
    _ready = ready;
    try {
      final value = await store.activate(api.config.apiRoot, owner);
      if (_disposed || generation != _activation) return;
      _session = value;
      await store.prune();
      await refresh();
      await _schedule();
      unawaited(sync());
    } catch (_) {
      error =
          'Không mở được hàng đợi trên thiết bị. Chưa có ảnh nào được tự xóa.';
      _notify();
    } finally {
      ready.complete();
    }
  }

  Future<void> deactivate() async {
    _activation++;
    _session = null;
    _items = [];
    error = null;
    _notify();
    await store.deactivate();
    try {
      if (_session == null) await _cancelWork();
    } catch (_) {/* Database guard remains authoritative. */}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) unawaited(sync());
  }

  Future<void> refresh() async {
    final captured = _session;
    if (captured == null) return;
    final rows = await store.list(captured.scope);
    final current = await store.active();
    if (_session != captured ||
        current?.scope != captured.scope ||
        current?.generation != captured.generation) {
      return;
    }
    _session = current;
    _items = rows;
    _notify();
  }

  Future<QueuedInvoice> enqueue(
      List<int> bytes, String name, String source) async {
    final captured = _session;
    if (captured == null) {
      throw StateError('Hãy đăng nhập trước khi lưu ảnh vào hàng đợi.');
    }
    final extension = detectInvoiceExtension(bytes, name);
    if (extension == null) {
      throw StateError(
          'Định dạng không hỗ trợ. Dùng JPG/PNG/WEBP, PDF hoặc XML.');
    }
    final row = await store.enqueue(captured, Uint8List.fromList(bytes),
        invoiceUploadName(name, extension), source);
    await refresh();
    unawaited(sync());
    unawaited(_schedule());
    return row;
  }

  Future<void> sync() async {
    if (_running || _disposed || _session == null) return;
    _running = true;
    final captured = _session!;
    final before = {
      for (final job in _items) job.id: '${job.state}:${job.remoteId}'
    };
    try {
      if (_foreground) await store.resumeAuth(captured);
      await InvoiceQueueRunner(store, api, captured, extraGuard: () async {
        if (_session?.scope != captured.scope ||
            _session?.generation != captured.generation ||
            !_foreground) {
          throw QueueInterrupted();
        }
      }, onChanged: refresh)
          .run(limit: InvoiceQueueStore.maxFiles * 2);
      if (_session?.scope == captured.scope) {
        await refresh();
        if (_items.any((e) =>
            e.remoteId != null && before[e.id] != '${e.state}:${e.remoteId}')) {
          await onUploaded?.call();
        }
      }
      error = null;
    } catch (_) {
      error =
          'Chưa đồng bộ được hàng đợi. Dữ liệu vẫn được giữ trên điện thoại.';
    } finally {
      _running = false;
      _notify();
    }
  }

  Future<void> setPaused(bool value) async {
    final captured = _session;
    if (captured == null) return;
    await store.pause(captured.scope, value);
    await refresh();
    if (!value) {
      await _schedule();
      unawaited(sync());
    }
  }

  Future<void> retry(String id) async {
    final captured = _session;
    if (captured == null) return;
    await store.retry(captured.scope, id);
    await refresh();
    await _schedule();
    unawaited(sync());
  }

  Future<void> remove(String id) async {
    final captured = _session;
    if (captured == null) return;
    await store.remove(captured.scope, id);
    await refresh();
  }

  Future<void> _schedule() async {
    try {
      await _scheduleWork();
      backgroundNotice = null;
    } catch (_) {
      backgroundNotice =
          'Chưa bật được gửi nền. Hàng đợi vẫn tự gửi khi mở ứng dụng.';
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    api.config.removeListener(_serverChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
