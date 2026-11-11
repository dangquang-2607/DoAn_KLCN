import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../ha_tang/api.dart';
import 'toi_uu_anh.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'dung_chung.dart';
import 'doi_chieu_anh.dart';
import 'kiem_tra.dart';

/// Cách bắt đầu khi mở màn hóa đơn từ nút tắt ở trang chủ.
/// Hành động mở sẵn khi vào màn hình: chụp ngay, hoặc hiện bảng chọn nguồn hóa đơn.
enum InvoiceStartAction { camera, chooseSource }

typedef _UploadSession = ({String owner, String server, int epoch});

class _UploadImage {
  _UploadImage(this.file, this.source, this.session);

  final XFile file;
  final String source;
  final _UploadSession session;
  Uint8List? bytes;
  String? filename;
  String? acceptedTicket;
  InvoiceSummary? result;
  Object? error;
}

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
  static const _pickerIntentKey = 'cf_invoice_picker_intent';

  final ImagePicker _picker = ImagePicker();
  final _search = TextEditingController();
  final _listScroll = ScrollController();

  List<InvoiceSummary> _invoices = <InvoiceSummary>[];
  String _filter = 'ALL';
  String _query = '';
  bool _loading = true;
  bool _uploading = false;
  bool _picking = false;
  String _uploadProgress = '';
  final List<_UploadImage> _uploadResults = [];
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
    final session = _uploadSession();
    if (session == null) return false;
    _picking = true;
    var retake = false;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!_sameSession(session)) return false;
      final intent = prefs.getString(_pickerIntentKey);
      final scope = _pickerScope(session);
      if (intent != '$scope:CAMERA' && intent != '$scope:UPLOAD') return false;
      await prefs.remove(_pickerIntentKey);
      if (!_sameSession(session)) return false;
      final lost = await _picker.retrieveLostData();
      if (!_sameSession(session)) return false;
      final files = lost.files;
      if (files != null && files.isNotEmpty) {
        if (intent == '$scope:CAMERA') {
          final decision = await _cameraDecision(files.first, session);
          retake = decision == 'retake';
          if (decision == 'use') {
            await _uploadFiles([files.first], session, source: 'CAMERA');
          }
        } else {
          await _uploadFiles(files, session, source: 'UPLOAD');
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
      if (_sameSession(session)) {
        showSnack('Chưa khôi phục được ảnh vừa chọn. Hãy chọn lại.',
            error: true);
      }
    } finally {
      _picking = false;
      if (retake && _sameSession(session)) unawaited(_pickCamera());
    }
    return false;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _search.dispose();
    _listScroll.dispose();
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

  // ── Chụp / chọn ảnh và tải lên ────────────────────────────────────────────

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
      ],
    );
  }

  Future<void> _pickCamera() => _runPicker((session) async {
        while (_sameSession(session)) {
          final file = await _picker.pickImage(source: ImageSource.camera);
          if (file == null || !_sameSession(session)) return;
          final decision = await _cameraDecision(file, session);
          if (decision == 'retake') continue;
          if (decision == 'use') {
            await _uploadFiles([file], session, source: 'CAMERA');
          }
          return;
        }
      }, recoverySource: 'CAMERA');

  Future<void> _pickImages() => _runPicker(
        (session) async {
          final files = await _picker.pickMultiImage(limit: _uploadLimit);
          await _uploadFiles(files, session, source: 'UPLOAD');
        },
        recoverySource: 'UPLOAD',
      );

  Future<void> _runPicker(
    Future<void> Function(_UploadSession) pick, {
    required String recoverySource,
  }) async {
    if (_picking || _uploading) return;
    final session = _uploadSession();
    if (session == null) return;
    _picking = true;
    try {
      final prefs =
          Platform.isAndroid ? await SharedPreferences.getInstance() : null;
      if (!_sameSession(session)) return;
      final intent = '${_pickerScope(session)}:$recoverySource';
      await prefs?.setString(_pickerIntentKey, intent);
      try {
        if (_sameSession(session)) await pick(session);
      } finally {
        if (prefs?.getString(_pickerIntentKey) == intent) {
          await prefs?.remove(_pickerIntentKey);
        }
      }
    } catch (error) {
      if (_sameSession(session)) {
        showSnack(
            error is StateError
                ? error.message.toString()
                : 'Không đọc được ảnh. Hãy chọn hoặc chụp lại.',
            error: true);
      }
    } finally {
      _picking = false;
    }
  }

  _UploadSession? _uploadSession() {
    final api = context.read<AppData>().invoices.api;
    final owner = api.tokens.ownerId;
    return owner == null
        ? null
        : (owner: owner, server: api.config.apiRoot, epoch: api.tokens.epoch);
  }

  bool _sameSession(_UploadSession session) =>
      mounted && _uploadSession() == session;

  // Chỉ lưu nguồn chọn ảnh và mã phạm vi tài khoản để khôi phục bộ chọn Android.
  String _pickerScope(_UploadSession session) => sha256
      .convert(utf8.encode('${session.server}|${session.owner}'))
      .toString();

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
    _UploadSession session,
  ) async {
    await _validateImage(file);
    final bytes = await file.readAsBytes();
    if (!_sameSession(session)) return null;
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

  Future<void> _uploadFiles(
    List<XFile> files,
    _UploadSession session, {
    required String source,
  }) async {
    if (files.isEmpty || !_sameSession(session)) return;
    if (files.length > _uploadLimit) {
      showSnack('Chọn tối đa $_uploadLimit ảnh mỗi lượt.', error: true);
      return;
    }
    await _sendUploads(
      files.map((file) => _UploadImage(file, source, session)).toList(),
      newBatch: true,
    );
  }

  Future<void> _sendUploads(List<_UploadImage> images,
      {bool newBatch = false}) async {
    final session = images.first.session;
    if (_uploading || !_sameSession(session)) return;
    final repository = context.read<AppData>().invoices;
    setState(() {
      _uploading = true;
      _uploadProgress = 'Đang kiểm tra ảnh hóa đơn…';
    });
    try {
      if (newBatch) {
        for (final image in images) {
          await _validateImage(image.file);
          if (!_sameSession(session)) return;
        }
        _uploadResults.removeWhere((entry) =>
            entry.error == null ||
            entry.session != session ||
            images.any((image) => image.file.path == entry.file.path));
        _uploadResults.addAll(images);
      }

      for (final (index, image) in images.indexed) {
        if (!_sameSession(session)) return;
        setState(() => _uploadProgress =
            'Đang nhận dạng và đối chiếu ảnh ${index + 1}/${images.length}');
        try {
          final bytes = image.bytes ??=
              await prepareInvoiceImage(await image.file.readAsBytes());
          final extension = detectInvoiceExtension(bytes, image.file.name);
          if (extension == null) {
            throw StateError('Không đọc được định dạng ảnh.');
          }
          final filename = invoiceUploadName(image.file.name, extension);
          if (!_sameSession(session)) return;
          image.result = await repository.upload(
            bytes: bytes,
            filename: filename,
            source: image.source,
            reviewTicket: image.acceptedTicket,
            beforeSend: () async {
              if (!_sameSession(session)) {
                throw ApiException('Phiên đăng nhập đã thay đổi.',
                    statusCode: 401);
              }
            },
          );
          image.error = null;
          image.bytes = null;
          image.acceptedTicket = null;
        } catch (error) {
          if (!_sameSession(session)) return;
          image.error = error;
          if (error is ApiException &&
              !error.uncertain &&
              error.statusCode != 401) {
            image.acceptedTicket = null;
          }
        }
      }

      if (!_sameSession(session)) return;
      final created =
          images.where((image) => image.result?.outcome == 'CREATED');
      final duplicates = images.where(_isUploadMatch);
      final failed = images.where((image) => image.error != null);
      if (created.isNotEmpty || duplicates.isNotEmpty) {
        if (_filter != 'ALL') {
          _setFilter('ALL');
        } else {
          unawaited(reload());
        }
      }
      showSnack(
        '${created.length} hóa đơn mới · ${duplicates.length} ảnh trùng · ${failed.length} ảnh chưa hoàn tất.',
        error: failed.isNotEmpty,
        warning: failed.isEmpty && duplicates.isNotEmpty,
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _listScroll.hasClients) _listScroll.jumpTo(0);
      });
    } catch (error) {
      if (_sameSession(session)) {
        showSnack(
            error is StateError
                ? error.message.toString()
                : 'Không đọc được ảnh đã chọn.',
            error: true);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openInvoice(String id) async {
    await pushScreen<bool>(context, InvoiceReviewScreen(invoiceId: id));
    if (mounted) unawaited(reload());
  }

  bool _isUploadMatch(_UploadImage image) =>
      image.result != null && image.result?.outcome != 'CREATED';

  String _matchLabel(InvoiceSummary invoice) {
    if (invoice.hidden || invoice.outcome == 'RESTORE_REQUIRED') {
      return 'Trong Thùng rác';
    }
    if (invoice.outcome == 'ALREADY_CONFIRMED') return 'Đã ghi sổ';
    if (invoice.raw['match_kind'] == 'DATA') {
      return 'Khớp dữ liệu hóa đơn đã có';
    }
    return 'Đã tải lên trước đó';
  }

  Future<void> _openDuplicate(List<_UploadImage> matches) async {
    final match = matches.length == 1
        ? matches.single
        : await pickOption<_UploadImage>(
            context,
            title: 'Ảnh trùng hóa đơn đã có',
            options: [
              for (final image in matches)
                MapEntry(image,
                    '${image.file.name} · ${_matchLabel(image.result!)}'),
            ],
          );
    if (match == null || !_sameSession(match.session) || _uploading) return;
    setState(() => _uploadResults.removeWhere(matches.contains));
    await _openInvoice(match.result!.id);
  }

  Future<void> _reviewUpload(
      _UploadImage image, Json review, String ticket) async {
    final decision =
        await reviewInvoiceDuplicates(context, review, upload: image.bytes);
    if (decision == null || !_sameSession(image.session) || _uploading) return;
    if (decision.startsWith('open:')) {
      await _openInvoice(decision.substring('open:'.length));
    } else if (decision == 'distinct') {
      image.acceptedTicket = ticket;
      await _sendUploads([image]);
    }
  }

  Widget? _uploadFeedback(List<_UploadImage> results) {
    final matches = results.where(_isUploadMatch).toList();
    final created =
        results.where((image) => image.result?.outcome == 'CREATED');
    final failed = results.where((image) => image.error != null);
    if (matches.isEmpty && created.length != 1 && failed.isEmpty) return null;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (matches.isNotEmpty) ...[
            InfoBanner(
              message: '${matches.length} ảnh trùng. Không tạo thêm hóa đơn.',
              icon: Icons.copy_all_outlined,
              color: AppColors.warning,
            ),
            TextButton.icon(
              icon: const Icon(Icons.open_in_new, size: 18),
              label: const Text('Mở hóa đơn'),
              onPressed: () => _openDuplicate(matches),
            ),
          ],
          if (created.length == 1)
            TextButton.icon(
              icon: const Icon(Icons.receipt_long_outlined, size: 18),
              label: const Text('Kiểm tra hóa đơn mới'),
              onPressed: () => _openInvoice(created.single.result!.id),
            ),
          for (final image in failed) _uploadIssue(image),
        ],
      ),
    );
  }

  Widget _uploadIssue(_UploadImage image) {
    final error = image.error!;
    final detail =
        error is ApiException ? error.detail : const <String, dynamic>{};
    final ticket = asText(detail['upload_ticket']);
    final check = detail['duplicate_check'];
    final blockers = asJsonList(detail['blockers']);
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InfoBanner(
            message:
                '${image.file.name}: ${error is StateError ? error.message : errorText(error)}',
            icon: Icons.info_outline,
            color: AppColors.warning,
          ),
          Wrap(
            children: [
              if (ticket != null && check is Map<String, dynamic>)
                TextButton(
                  onPressed: () => _reviewUpload(image, check, ticket),
                  child: const Text('Đối chiếu hóa đơn nghi trùng'),
                )
              else
                TextButton(
                  onPressed: () => _sendUploads([image]),
                  child: const Text('Thử lại ảnh này'),
                ),
              for (final blocker in blockers)
                if (asText(blocker['id']) case final id?)
                  TextButton(
                    onPressed: () => _openInvoice(id),
                    child: Text(
                        asText(blocker['filename']) ?? 'Mở bản cần kiểm tra'),
                  ),
              TextButton(
                onPressed: () => setState(() => _uploadResults.remove(image)),
                child: const Text('Bỏ ảnh'),
              ),
            ],
          ),
        ],
      ),
    );
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
    final session = _uploadSession();
    final results = _selecting || _uploading
        ? const <_UploadImage>[]
        : _uploadResults.where((image) => image.session == session).toList();
    final feedback = _uploadFeedback(results);
    final feedbackItems = [
      if (feedback != null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Space.md),
          child: feedback,
        ),
    ];
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
        controller: _listScroll,
        children: [
          ...feedbackItems,
          const SizedBox(height: 120),
          const LoadingView(),
        ],
      );
    } else if (_error != null && _invoices.isEmpty) {
      content = ListView(
        controller: _listScroll,
        children: [
          ...feedbackItems,
          const SizedBox(height: 60),
          ErrorView(message: _error!, onRetry: reload),
        ],
      );
    } else if (visible.isEmpty) {
      content = ListView(
        controller: _listScroll,
        children: [
          ...feedbackItems,
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
        controller: _listScroll,
        padding: EdgeInsets.fromLTRB(
            Space.md, Space.xxs, Space.md, _selecting ? Space.sm : Space.xl),
        itemCount: visible.length + feedbackItems.length,
        itemBuilder: (context, index) {
          if (index == 0 && feedback != null) return feedback;
          final invoice = visible[index - feedbackItems.length];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _InvoiceCard(
              invoice: invoice,
              checked: _selecting ? _selected.contains(invoice.id) : null,
              onTap: _selecting
                  ? _batchBusy || !_canSelect(invoice)
                      ? null
                      : () => _toggleSelection(invoice)
                  : () => _openInvoice(invoice.id),
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
              Positioned.fill(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    const ModalBarrier(
                      dismissible: false,
                      color: Color(0x99172033),
                    ),
                    Center(
                      child: AppCard(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const CircularProgressIndicator(strokeWidth: 3),
                            const SizedBox(height: Space.sm),
                            Semantics(
                              liveRegion: true,
                              child: Text(_uploadProgress,
                                  textAlign: TextAlign.center,
                                  style: AppText.cardTitle),
                            ),
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
                  key: ValueKey(_filter),
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
