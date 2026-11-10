import 'dart:async';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import 'hang_doi/dieu_phoi.dart';
import 'hang_doi/luu_anh.dart' show QueueSession;
import 'hang_doi/danh_sach_cho.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'dung_chung.dart';
import 'kiem_tra.dart';

/// Cách bắt đầu khi mở màn hóa đơn từ nút tắt ở trang chủ.
/// Hành động mở sẵn khi vào màn hình: chụp ngay, hoặc hiện bảng chọn nguồn hóa đơn.
enum InvoiceStartAction { camera, chooseSource }

/// Hóa đơn AI: chụp hoặc tải hóa đơn lên, lưu trữ, tra cứu và theo dõi trạng thái nhận dạng OCR.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key, this.startAction});

  final InvoiceStartAction? startAction;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen>
    with AutoRefresh<InvoicesScreen> {
  static const _statusFilters = [
    'PROCESSING',
    'REVIEW_REQUIRED',
    'CONFIRMED',
    'FAILED',
  ];
  static const _uploadLimit = 3;
  static const _ocrLimit = 5;
  static const _selectionLimit = 100;
  static const _maxSourceBytes = 20 * 1024 * 1024;

  final ImagePicker _picker = ImagePicker();
  final _search = TextEditingController();

  List<InvoiceSummary> _invoices = <InvoiceSummary>[];
  String _filter = 'ALL';
  String _query = '';
  bool _loading = true;
  bool _uploading = false;
  bool _picking = false;
  bool _more = false;
  int _page = 1, _total = 0;
  bool _selecting = false, _batchBusy = false;
  final Set<String> _selected = {};

  String? _error;
  Timer? _pollTimer;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final queue = context.read<InvoiceQueue>();
      await queue.ready;
      if (!mounted) return;
      if (await _recoverPicker()) return;
      if (!mounted) return;
      if (widget.startAction == InvoiceStartAction.camera) {
        _pickCamera();
      } else if (widget.startAction == InvoiceStartAction.chooseSource) {
        _openAddSheet();
      }
    });
  }

  Future<bool> _recoverPicker() async {
    if (!Platform.isAndroid || _picking) return false;
    final queue = context.read<InvoiceQueue>();
    final session = queue.session;
    final intent = await queue.store.pickerIntent();
    if (_picking ||
        session == null ||
        intent == null ||
        intent['scope'] != session.scope ||
        !_sameSession(queue, session)) {
      return false;
    }
    _picking = true;
    var retake = false;
    try {
      final lost = await _picker.retrieveLostData();
      if (!_sameSession(queue, session)) return false;
      final files = lost.files;
      if (files != null && files.isNotEmpty) {
        if (intent['source'] == 'CAMERA') {
          final decision = await _cameraDecision(files.first, queue, session);
          retake = decision == 'retake';
          if (decision == 'use') {
            await _queueImages([files.first], queue, session, source: 'CAMERA');
          }
        } else {
          await _queueImages(files, queue, session);
        }
        return true;
      }
      if (lost.exception != null) {
        showSnack(
          'Chưa khôi phục được ảnh. Hãy chụp hoặc chọn lại.',
          error: true,
        );
      }
    } catch (_) {
      showSnack('Chưa khôi phục được ảnh vừa chọn. Hãy chọn lại.', error: true);
    } finally {
      try {
        await queue.store.clearPicker(scope: session.scope);
      } finally {
        _picking = false;
      }
      if (retake && _sameSession(queue, session)) unawaited(_pickCamera());
    }
    return false;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  Future<void> reload() async {
    if (_selecting) return;
    final request = ++_request;
    final appData = context.read<AppData>();
    try {
      final result = await appData.invoices.listPage(
        status: _filter == 'ALL' ? null : _filter,
        pageSize: 100,
      );
      if (!mounted || _selecting || request != _request) return;
      setState(() {
        _invoices = result.items;
        _total = result.total;
        _page = 1;
        _error = null;
        _loading = false;
      });
      _schedulePolling();
    } catch (error) {
      if (!mounted || _selecting || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_more) return;
    final request = _request;
    setState(() => _more = true);
    try {
      final result = await context.read<AppData>().invoices.listPage(
          status: _filter == 'ALL' ? null : _filter,
          page: _page + 1,
          pageSize: 100);
      if (!mounted || request != _request) return;
      setState(() {
        final ids = _invoices.map((i) => i.id).toSet();
        _invoices.addAll(result.items.where((i) => ids.add(i.id)));
        _total = result.total;
        _page++;
        _error = null;
      });
    } catch (e) {
      if (mounted && request == _request) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _more = false);
    }
  }

  void _startSelection() {
    FocusScope.of(context).unfocus();
    setState(() => _selecting = true);
  }

  void _endSelection() {
    setState(() {
      _selecting = false;
      _selected.clear();
    });
    unawaited(reload());
  }

  bool _canSelect(InvoiceSummary invoice) =>
      invoice.hidden || invoice.status != 'PROCESSING';

  bool _canRescan(InvoiceSummary invoice) =>
      !invoice.hidden &&
      !invoice.isXml &&
      const {'UPLOADED', 'FAILED', 'REVIEW_REQUIRED'}.contains(invoice.status);

  void _toggleSelection(InvoiceSummary invoice) {
    if (_batchBusy || !_canSelect(invoice)) return;
    if (!_selected.contains(invoice.id) &&
        _selected.length >= _selectionLimit) {
      showSnack('Chỉ có thể chọn tối đa $_selectionLimit hóa đơn.',
          error: true);
      return;
    }
    setState(() {
      if (!_selected.remove(invoice.id)) _selected.add(invoice.id);
    });
  }

  Future<void> _submitBatch(String action, List<String> ids) async {
    if (_batchBusy || ids.isEmpty) return;
    final scan = action == 'ocr';
    final purge = action == 'purge';
    final label = scan
        ? 'Quét lại'
        : purge
            ? 'Xóa vĩnh viễn'
            : 'Chuyển vào thùng rác';
    setState(() => _batchBusy = true);
    try {
      final confirmed = await confirmDialog(
        context,
        title: '$label ${ids.length} hóa đơn?',
        message: scan
            ? 'Mỗi hóa đơn sử dụng một lượt AI. Hệ thống xử lý từng hóa đơn và cập nhật kết quả trong danh sách.'
            : purge
                ? 'Ảnh và dữ liệu hóa đơn sẽ bị xóa vĩnh viễn. Các khoản chi đã ghi vẫn được lưu.'
                : 'Hóa đơn sẽ được giữ trong Thùng rác trong 30 ngày. Các khoản chi đã ghi vẫn được lưu.',
        confirmLabel: label,
        danger: !scan,
      );
      if (!mounted || !confirmed) return;
      final result = await context.read<AppData>().invoices.batch(action, ids);
      if (!mounted) return;
      _endSelection();
      if (scan) {
        final failed = asJsonList(result['results'])
            .where((row) => row['success'] == false);
        final firstError = failed.firstOrNull?['error'];
        final message = firstError is Map ? firstError['message'] : firstError;
        showSnack(
          'Đã xếp hàng ${result['success_count']}/${ids.length} hóa đơn.'
          '${message == null ? '' : ' $message'}',
          error: failed.isNotEmpty,
        );
      } else {
        final count = asInt(result['deleted']);
        final skipped = ids.length - count;
        showSnack(
          '${purge ? 'Đã xóa vĩnh viễn' : 'Đã chuyển vào Thùng rác'} $count hóa đơn.'
          '${skipped > 0 ? ' $skipped hóa đơn chưa được xử lý.' : ''}',
          error: skipped > 0,
        );
      }
    } catch (error) {
      if (mounted) showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _batchBusy = false);
    }
  }

  /// Khi còn hóa đơn đang quét, tự kiểm tra lại mỗi 4 giây cho tới khi worker xử lý xong.
  void _schedulePolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    if (_invoices.any((invoice) => invoice.status == 'PROCESSING')) {
      _pollTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && _page == 1 && !_more) reload();
      });
    }
  }

  void _setFilter(String value) {
    if (value == _filter) return;
    setState(() {
      _filter = value;
      _loading = true;
      _invoices = <InvoiceSummary>[];
      _page = 1;
      _total = 0;
      _error = null;
    });
    reload();
  }

  // ── Chụp / chọn tệp và tải lên ────────────────────────────────────────────

  void _openAddSheet() {
    if (_picking || _uploading || _selecting) return;
    showPickerSheet<void>(
      context,
      title: 'Thêm hóa đơn',
      children: (sheetContext) => [
        const Padding(
          padding: EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.sm),
          child: Text(
            'JPG, JPEG, PNG hoặc WEBP, tối đa 20 MB mỗi ảnh. Hệ thống tự quét và đối chiếu khi tải lên.',
            style: TextStyle(color: AppColors.muted),
          ),
        ),
        SheetOption(
          title: 'Chụp ảnh hóa đơn',
          subtitle: 'Dùng camera để chụp hóa đơn giấy',
          leading: const IconBadge(
            icon: Icons.photo_camera_outlined,
            color: AppColors.blue,
            size: 40,
          ),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickCamera();
          },
        ),
        SheetOption(
          title: 'Chọn ảnh từ thư viện',
          subtitle: 'Chọn tối đa 3 ảnh trong bộ sưu tập',
          leading: const IconBadge(
            icon: Icons.photo_library_outlined,
            color: AppColors.success,
            size: 40,
          ),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickImages();
          },
        ),
        SheetOption(
          title: 'Chọn tệp ảnh',
          subtitle: 'Chọn tối đa 3 ảnh từ Tệp hoặc Tải xuống',
          leading: const IconBadge(
            icon: Icons.description_outlined,
            color: AppColors.amber,
            size: 40,
          ),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickImages(fromFiles: true);
          },
        ),
      ],
    );
  }

  Future<void> _pickCamera() => _runPicker((queue, session) async {
        while (_sameSession(queue, session)) {
          final file = await _picker.pickImage(source: ImageSource.camera);
          if (file == null || !_sameSession(queue, session)) return;
          final decision = await _cameraDecision(file, queue, session);
          if (decision == 'retake') continue;
          if (decision == 'use') {
            await _queueImages([file], queue, session, source: 'CAMERA');
          }
          return;
        }
      }, recoverySource: 'CAMERA');

  Future<void> _pickImages({bool fromFiles = false}) => _runPicker(
        (queue, session) async {
          const group = XTypeGroup(
            label: 'Ảnh hóa đơn',
            extensions: ['jpg', 'jpeg', 'png', 'webp'],
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          );
          final files = fromFiles
              ? await openFiles(acceptedTypeGroups: [group])
              : await _picker.pickMultiImage(limit: _uploadLimit);
          await _queueImages(files, queue, session);
        },
        recoverySource: fromFiles ? null : 'UPLOAD',
      );

  Future<void> _runPicker(
    Future<void> Function(InvoiceQueue, QueueSession) pick, {
    required String? recoverySource,
  }) async {
    if (_picking || _uploading) return;
    _picking = true;
    final queue = context.read<InvoiceQueue>();
    try {
      await queue.ready;
      final session = queue.session;
      if (!mounted || session == null) return;
      if (recoverySource != null) {
        await queue.store.rememberPicker(session, recoverySource);
      }
      try {
        if (_sameSession(queue, session)) await pick(queue, session);
      } finally {
        if (recoverySource != null) {
          await queue.store.clearPicker(scope: session.scope);
        }
      }
    } catch (_) {
      if (mounted) {
        showSnack('Không đọc được ảnh. Hãy chọn hoặc chụp lại.', error: true);
      }
    } finally {
      _picking = false;
    }
  }

  bool _sameSession(InvoiceQueue queue, QueueSession session) =>
      mounted &&
      queue.session?.scope == session.scope &&
      queue.session?.generation == session.generation;

  Future<void> _validateImage(XFile file) async {
    final length = await file.length();
    if (length <= 0 || length > _maxSourceBytes) {
      throw StateError(
          '${file.name}: Chọn ảnh có dung lượng từ 1 byte đến 20 MB.');
    }
    final header = await file
        .openRead(0, length < 12 ? length : 12)
        .expand((chunk) => chunk)
        .toList();
    if (detectInvoiceExtension(header, file.name) == null) {
      throw StateError('${file.name}: Chọn ảnh JPG, JPEG, PNG hoặc WEBP.');
    }
  }

  Future<String?> _cameraDecision(
    XFile file,
    InvoiceQueue queue,
    QueueSession session,
  ) async {
    await _validateImage(file);
    final bytes = await file.readAsBytes();
    if (!_sameSession(queue, session)) return null;
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kiểm tra ảnh hóa đơn'),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Chụp đủ bốn góc, rõ người bán, ngày, tổng tiền và chi tiết hàng hoặc số hóa đơn.',
                ),
                const SizedBox(height: Space.sm),
                Image.memory(
                  bytes,
                  cacheWidth: 900,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Text(
                    'Không xem trước được ảnh. Hãy chụp lại nếu ảnh bị lỗi.',
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, 'retake'),
            child: const Text('Chụp lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'use'),
            child: const Text('Tải lên và quét'),
          ),
        ],
      ),
    );
  }

  Future<void> _queueImages(
    List<XFile> files,
    InvoiceQueue queue,
    QueueSession session, {
    String source = 'UPLOAD',
  }) async {
    if (files.isEmpty || !_sameSession(queue, session)) return;
    if (files.length > _uploadLimit) {
      showSnack('Chọn tối đa $_uploadLimit ảnh mỗi lượt.', error: true);
      return;
    }
    setState(() => _uploading = true);
    try {
      for (final file in files) {
        await _validateImage(file);
        if (!_sameSession(queue, session)) return;
      }

      var queued = 0;
      String? firstError;
      for (final file in files) {
        if (!_sameSession(queue, session)) return;
        try {
          final bytes = await file.readAsBytes();
          if (!_sameSession(queue, session)) return;
          await queue.enqueue(bytes, file.name, source);
          queued++;
        } catch (error) {
          firstError ??= error is StateError
              ? error.message.toString()
              : 'Chưa lưu được ${file.name}. Hãy chọn lại ảnh.';
        }
      }
      if (!_sameSession(queue, session)) return;
      if (queued > 0 && _filter != 'ALL') _setFilter('ALL');
      showSnack(
        firstError == null
            ? 'Đã thêm $queued ảnh. Hệ thống sẽ tự quét và đối chiếu khi tải lên.'
            : 'Đã thêm $queued/${files.length} ảnh. $firstError',
        error: firstError != null,
      );
    } catch (error) {
      if (_sameSession(queue, session)) {
        showSnack(
          error is StateError
              ? error.message.toString()
              : 'Không đọc được ảnh đã chọn.',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  // ── Giao diện ─────────────────────────────────────────────────────────────

  PreferredSizeWidget _selectionBar() => AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        automaticallyImplyLeading: false,
        titleSpacing: Space.xs,
        title: Row(
          children: [
            Expanded(
              child: TextButton(
                onPressed: _batchBusy ? null : _endSelection,
                child: const Text('Hủy'),
              ),
            ),
            Expanded(
              flex: 2,
              child: Semantics(
                liveRegion: true,
                child: Text(
                  'Đã chọn ${_selected.length}',
                  textAlign: TextAlign.center,
                  style: AppText.section,
                ),
              ),
            ),
            Expanded(
              child: TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: Space.xxs),
                ),
                onPressed: _batchBusy || _selected.isEmpty
                    ? null
                    : () => setState(_selected.clear),
                child: const Text('Bỏ chọn', textAlign: TextAlign.center),
              ),
            ),
          ],
        ),
      );

  Widget _selectionFooter() {
    final ids = _selected.toList();
    final scanIds = _invoices
        .where(
            (invoice) => _selected.contains(invoice.id) && _canRescan(invoice))
        .map((invoice) => invoice.id)
        .toList();
    final trash = _filter == 'HIDDEN';
    final canSubmit = !_batchBusy && ids.isNotEmpty;
    return Material(
      color: AppColors.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding:
              const EdgeInsets.fromLTRB(Space.md, Space.xs, Space.md, Space.sm),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_batchBusy)
                const LinearProgressIndicator(
                  semanticsLabel: 'Đang xử lý hóa đơn đã chọn',
                ),
              if (!trash && scanIds.length > _ocrLimit)
                const Padding(
                  padding: EdgeInsets.only(bottom: Space.xs),
                  child: Text(
                    'Mỗi lượt quét lại tối đa $_ocrLimit hóa đơn.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted),
                  ),
                ),
              if (!trash)
                FilledButton(
                  onPressed: canSubmit &&
                          scanIds.isNotEmpty &&
                          scanIds.length <= _ocrLimit
                      ? () => _submitBatch('ocr', scanIds)
                      : null,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 48),
                    shape: const StadiumBorder(),
                  ),
                  child: Text('Quét lại (${scanIds.length})'),
                ),
              if (trash)
                FilledButton(
                  onPressed:
                      canSubmit ? () => _submitBatch('purge', ids) : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.danger,
                    minimumSize: const Size(0, 48),
                    shape: const StadiumBorder(),
                  ),
                  child: Text('Xóa vĩnh viễn (${ids.length})'),
                )
              else
                TextButton(
                  onPressed:
                      canSubmit ? () => _submitBatch('delete', ids) : null,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    minimumSize: const Size(0, 48),
                  ),
                  child: Text('Chuyển vào thùng rác (${ids.length})'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final visible = query.isEmpty
        ? _invoices
        : _invoices
            .where(
              (invoice) =>
                  invoice.displayName.toLowerCase().contains(query) ||
                  (invoice.originalFilename?.toLowerCase().contains(query) ??
                      false),
            )
            .toList();

    Widget content;
    if (_loading && _invoices.isEmpty) {
      content = ListView(
        children: const [SizedBox(height: 120), LoadingView()],
      );
    } else if (_error != null && _invoices.isEmpty) {
      content = ListView(
        children: [
          const SizedBox(height: 60),
          ErrorView(message: _error!, onRetry: reload),
        ],
      );
    } else if (visible.isEmpty) {
      content = ListView(
        children: [
          const SizedBox(height: 30),
          EmptyView(
            icon: Icons.document_scanner_outlined,
            title: _filter == 'ALL' && query.isEmpty
                ? 'Chưa có hóa đơn nào'
                : 'Không có hóa đơn phù hợp',
            message: _filter == 'ALL' && query.isEmpty
                ? 'Chụp hoặc tải hóa đơn lên, AI sẽ nhận dạng cửa hàng, ngày, sản phẩm, tổng tiền và thuế VAT.'
                : 'Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm.',
          ),
        ],
      );
    } else {
      content = ListView.builder(
        padding: EdgeInsets.fromLTRB(
            Space.md, Space.xxs, Space.md, _selecting ? Space.sm : Space.xl),
        itemCount: visible.length,
        itemBuilder: (context, index) {
          final invoice = visible[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _InvoiceCard(
              invoice: invoice,
              checked: _selecting ? _selected.contains(invoice.id) : null,
              onTap: _selecting
                  ? _batchBusy || !_canSelect(invoice)
                      ? null
                      : () => _toggleSelection(invoice)
                  : () => pushScreen<bool>(
                        context,
                        InvoiceReviewScreen(invoiceId: invoice.id),
                      ),
            ),
          );
        },
      );
    }

    return PopScope(
      canPop: !_selecting && !_uploading,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selecting && !_batchBusy) _endSelection();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: _selecting
            ? _selectionBar()
            : appBar(
                context,
                'Quét hóa đơn',
                addAction: PillAddButton(
                  label: 'Thêm hóa đơn',
                  onPressed: _uploading ? null : _openAddSheet,
                ),
              ),
        bottomNavigationBar: _selecting ? _selectionFooter() : null,
        body: Stack(
          children: [
            Column(
              children: [
                if (!_selecting) ..._browseControls(visible.any(_canSelect)),
                if (_error != null && _invoices.isNotEmpty) Text(_error!),
                if (_page * 100 < _total)
                  TextButton(
                    onPressed: _more || _batchBusy ? null : _loadMore,
                    child: Text(_more
                        ? 'Đang tải…'
                        : 'Tải thêm (${_invoices.length}/$_total)'),
                  ),
                if (!_selecting && query.isNotEmpty)
                  const Text(
                    'Tìm trong các hóa đơn đã tải. Tải thêm để tìm mục cũ hơn.',
                  ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: reload,
                    notificationPredicate: (notification) =>
                        !_selecting &&
                        defaultScrollNotificationPredicate(notification),
                    color: AppColors.blue,
                    child: content,
                  ),
                ),
              ],
            ),
            if (_uploading)
              const Positioned.fill(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ModalBarrier(
                      dismissible: false,
                      color: Color(0x99172033),
                    ),
                    Center(
                      child: AppCard(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(strokeWidth: 3),
                            SizedBox(height: Space.sm),
                            Text('Đang chuẩn bị ảnh…',
                                style: AppText.cardTitle),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> _browseControls(bool canSelect) => [
        Padding(
          padding: const EdgeInsets.fromLTRB(
              Space.md, Space.xxs, Space.md, Space.xs),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onChanged: (value) => setState(() => _query = value),
            decoration: fieldDecoration(
              'Tìm theo cửa hàng hoặc tên tệp',
              icon: Icons.search,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Space.md),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _filter,
                  isExpanded: true,
                  decoration: fieldDecoration('Trạng thái'),
                  items: [
                    const DropdownMenuItem(
                      value: 'ALL',
                      child: Text('Tất cả hóa đơn'),
                    ),
                    const DropdownMenuItem(
                      value: 'HIDDEN',
                      child: Text('Thùng rác'),
                    ),
                    for (final status in _statusFilters)
                      DropdownMenuItem(
                        value: status,
                        child: Text(invoiceStatusStyle(status).label),
                      ),
                  ],
                  onChanged: (value) {
                    if (value != null) _setFilter(value);
                  },
                ),
              ),
              const SizedBox(width: Space.xs),
              IconButton(
                tooltip: 'Chọn hóa đơn',
                icon: const Icon(Icons.checklist_rounded),
                onPressed: _uploading || !canSelect ? null : _startSelection,
              ),
            ],
          ),
        ),
        const SizedBox(height: Space.xs),
        Consumer<InvoiceQueue>(
          builder: (context, queue, _) => ListTile(
            leading: const Icon(Icons.cloud_upload_outlined),
            title: Text('Hàng đợi trên điện thoại (${queue.pendingCount})'),
            subtitle: Text(
              queue.error ??
                  (queue.items.any(
                    (job) => job.state == 'attention' || job.state == 'auth',
                  )
                      ? 'Có ảnh cần kiểm tra. Mở hàng đợi để xem chi tiết.'
                      : queue.paused
                          ? 'Đang tạm dừng gửi'
                          : 'Ảnh được tự quét và đối chiếu khi tải lên.'),
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => pushScreen<void>(context, const InvoiceQueueScreen()),
          ),
        ),
      ];
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard(
      {required this.invoice, required this.onTap, this.checked});

  final InvoiceSummary invoice;
  final VoidCallback? onTap;
  final bool? checked;

  @override
  Widget build(BuildContext context) {
    final style = invoiceStatusStyle(invoice.status);
    final typeIcon = invoice.isXml
        ? Icons.code
        : invoice.isImage
            ? Icons.image_outlined
            : Icons.picture_as_pdf_outlined;
    final details = <String>[
      if (invoice.invoiceDate != null)
        'Ngày ${formatDate(invoice.invoiceDate)}',
      'Tải lên ${relativeTime(invoice.createdAt)}',
      if (invoice.hidden) 'Thùng rác',
      if (invoice.duplicateLevel == 'EXACT') 'Trùng hóa đơn',
      if (invoice.duplicateLevel == 'SUSPECTED') 'Có thể trùng',
    ];
    final total = invoice.totalAmount;
    final selected = checked;
    final tap = onTap;

    return AppCard(
      onTap: tap,
      padding: selected == null
          ? const EdgeInsets.all(Space.md)
          : const EdgeInsets.fromLTRB(Space.xxs, Space.sm, Space.md, Space.sm),
      child: Row(
        children: [
          if (selected == null) ...[
            IconBadge(icon: typeIcon, color: style.color, size: 46),
            const SizedBox(width: Space.sm),
          ] else
            Checkbox(
              value: selected,
              semanticLabel: 'Chọn ${invoice.displayName}',
              onChanged: tap == null ? null : (_) => tap(),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  details.join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.muted,
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: Space.xs,
                    runSpacing: Space.xxs,
                    children: [
                      InvoiceStatusChip(invoice.status),
                      if (total != null && total > 0)
                        Text(
                          formatMoney(total),
                          style: moneyStyle.copyWith(
                            fontSize: 15,
                            color: AppColors.ink,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
