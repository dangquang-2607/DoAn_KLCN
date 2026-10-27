import 'dart:async';
import 'dart:typed_data';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../services/invoice_queue.dart';
import 'invoice_queue_screen.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/common.dart';
import 'invoice_common.dart';
import 'invoice_review_screen.dart';

/// Cách bắt đầu khi mở màn hóa đơn từ nút tắt ở trang chủ.
enum InvoiceStartAction { camera, gallery }

/// Hóa đơn AI: chụp hoặc tải hóa đơn lên, lưu trữ, tra cứu và theo dõi trạng thái nhận dạng OCR.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key, this.startAction});

  final InvoiceStartAction? startAction;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen>
    with AutoRefresh<InvoicesScreen> {
  static const List<MapEntry<String, String>> _filters = [
    MapEntry('ALL', 'Tất cả'),
    MapEntry('REVIEW_REQUIRED', 'Cần kiểm tra'),
    MapEntry('PROCESSING', 'Đang quét'),
    MapEntry('UPLOADED', 'Chờ quét'),
    MapEntry('CONFIRMED', 'Đã ghi sổ'),
    MapEntry('FAILED', 'Quét lỗi'),
    MapEntry('HIDDEN', 'Thùng rác'),
  ];

  final ImagePicker _picker = ImagePicker();

  List<InvoiceSummary> _invoices = <InvoiceSummary>[];
  String _filter = 'ALL';
  String _query = '';
  bool _loading = true;
  bool _uploading = false;

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
        _pickImage(ImageSource.camera);
      } else if (widget.startAction == InvoiceStartAction.gallery) {
        _pickImage(ImageSource.gallery);
      }
    });
  }

  Future<bool> _recoverPicker() async {
    if (!Platform.isAndroid) return false;
    final queue = context.read<InvoiceQueue>();
    final session = queue.session;
    final intent = await queue.store.pickerIntent();
    if (session == null || intent == null || intent['scope'] != session.scope) {
      return false;
    }
    try {
      final lost = await _picker.retrieveLostData();
      if (!mounted) return false;
      if (lost.files?.isNotEmpty == true) {
        final file = lost.files!.first;
        final bytes = await file.readAsBytes();
        if (!mounted || queue.session?.scope != session.scope) return false;
        await _previewImage(
            bytes,
            file.name,
            intent['source'] == 'CAMERA'
                ? ImageSource.camera
                : ImageSource.gallery);
        return true;
      }
      if (lost.exception != null) {
        showSnack('Chưa khôi phục được ảnh từ camera. Hãy chụp hoặc chọn lại.',
            error: true);
      }
    } catch (_) {
      showSnack('Chưa khôi phục được ảnh vừa chọn. Hãy chọn lại.', error: true);
    } finally {
      await queue.store.clearPicker(scope: session.scope);
    }
    return false;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Future<void> reload() async {
    final request = ++_request;
    final appData = context.read<AppData>();
    try {
      final invoices = await appData.invoices
          .list(status: _filter == 'ALL' ? null : _filter, pageSize: 100);
      if (!mounted || request != _request) return;
      setState(() {
        _invoices = invoices;
        _error = null;
        _loading = false;
      });
      _schedulePolling();
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  /// Khi còn hóa đơn đang quét, tự kiểm tra lại mỗi 4 giây cho tới khi worker xử lý xong.
  void _schedulePolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    if (_invoices.any((invoice) => invoice.status == 'PROCESSING')) {
      _pollTimer = Timer(const Duration(seconds: 4), () {
        if (mounted) reload();
      });
    }
  }

  void _setFilter(String value) {
    if (value == _filter) return;
    setState(() {
      _filter = value;
      _loading = true;
      _invoices = <InvoiceSummary>[];
    });
    reload();
  }

  // ── Chụp / chọn tệp và tải lên ────────────────────────────────────────────

  void _openAddSheet() {
    showPickerSheet<void>(
      context,
      title: 'Thêm hóa đơn',
      children: (sheetContext) => [
        SheetOption(
          title: 'Chụp ảnh hóa đơn',
          subtitle: 'Dùng camera để chụp hóa đơn giấy',
          leading: const IconBadge(
              icon: Icons.photo_camera_outlined,
              color: AppColors.blue,
              size: 40),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickImage(ImageSource.camera);
          },
        ),
        SheetOption(
          title: 'Chọn ảnh từ thư viện',
          subtitle: 'Ảnh hóa đơn đã chụp sẵn (JPG, PNG, WEBP)',
          leading: const IconBadge(
              icon: Icons.photo_library_outlined,
              color: AppColors.success,
              size: 40),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickImage(ImageSource.gallery);
          },
        ),
        SheetOption(
          title: 'Chọn tệp PDF / XML',
          subtitle:
              'Hóa đơn điện tử dạng PDF hoặc XML (đọc trực tiếp, không cần quét)',
          leading: const IconBadge(
              icon: Icons.description_outlined,
              color: AppColors.amber,
              size: 40),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _pickFile();
          },
        ),
      ],
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    if (_uploading) return;
    final queue = context.read<InvoiceQueue>();
    await queue.ready;
    final session = queue.session;
    if (!mounted || session == null) return;
    try {
      await queue.store.rememberPicker(
          session, source == ImageSource.camera ? 'CAMERA' : 'UPLOAD');
      final file = await _picker.pickImage(
          source: source, imageQuality: 88, maxWidth: 2400, maxHeight: 2400);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (!mounted ||
          queue.session?.scope != session.scope ||
          queue.session?.generation != session.generation) {
        return;
      }
      await _previewImage(bytes, file.name, source);
    } catch (_) {
      showSnack(
          'Không đọc được ảnh. Hãy kiểm tra quyền camera/thư viện và thử lại.',
          error: true);
    } finally {
      await queue.store.clearPicker(scope: session.scope);
    }
  }

  Future<void> _previewImage(
      Uint8List bytes, String name, ImageSource source) async {
    final queue = context.read<InvoiceQueue>();
    final session = queue.session;
    if (bytes.length > maxInvoiceBytes ||
        detectInvoiceExtension(bytes, name) == null) {
      showSnack('Ảnh không được hỗ trợ hoặc lớn hơn 10 MB.', error: true);
      return;
    }
    final decision = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
              title: const Text('Kiểm tra ảnh hóa đơn'),
              content: SizedBox(
                  width: double.maxFinite,
                  child: Image.memory(bytes,
                      cacheWidth: 900,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Text(
                          'Không xem trước được ảnh. Hãy chọn ảnh khác nếu ảnh bị lỗi.'))),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Hủy')),
                if (source == ImageSource.camera)
                  TextButton(
                      onPressed: () => Navigator.pop(context, 'retake'),
                      child: const Text('Chụp lại')),
                FilledButton(
                    onPressed: () => Navigator.pop(context, 'use'),
                    child: const Text('Lưu vào hàng đợi')),
              ],
            ));
    if (!mounted ||
        queue.session?.scope != session?.scope ||
        queue.session?.generation != session?.generation) {
      return;
    }
    if (decision == 'retake') {
      await _pickImage(source);
      return;
    }
    if (decision == 'use') {
      await _upload(bytes, name,
          source: source == ImageSource.camera ? 'CAMERA' : 'UPLOAD');
    }
  }

  Future<void> _pickFile() async {
    if (_uploading) return;
    try {
      const group = XTypeGroup(
        label: 'Hóa đơn',
        extensions: <String>['pdf', 'xml', 'jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: <String>[
          'application/pdf',
          'text/xml',
          'application/xml',
          'image/jpeg',
          'image/png',
          'image/webp'
        ],
      );
      final file = await openFile(acceptedTypeGroups: <XTypeGroup>[group]);
      if (file == null) return;
      await _upload(await file.readAsBytes(), file.name);
    } catch (error) {
      showSnack('Không đọc được tệp đã chọn.', error: true);
    }
  }

  Future<void> _upload(List<int> bytes, String originalName,
      {String source = 'UPLOAD'}) async {
    if (_uploading || !mounted) return;
    final queue = context.read<InvoiceQueue>();
    setState(() => _uploading = true);
    try {
      await queue.enqueue(bytes, originalName, source);
      if (!mounted) return;
      setState(() => _uploading = false);
      showSnack(
          'Đã lưu ảnh vào hàng đợi trên điện thoại. Có thể tiếp tục thêm hóa đơn.');
    } catch (error) {
      showSnack(
          error is StateError
              ? error.message.toString()
              : 'Chưa lưu được ảnh vào hàng đợi. Hãy kiểm tra dung lượng và thử lại.',
          error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  // ── Giao diện ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final visible = query.isEmpty
        ? _invoices
        : _invoices
            .where(
                (invoice) => invoice.displayName.toLowerCase().contains(query))
            .toList();

    Widget content;
    if (_loading && _invoices.isEmpty) {
      content =
          ListView(children: const [SizedBox(height: 120), LoadingView()]);
    } else if (_error != null && _invoices.isEmpty) {
      content = ListView(children: [
        const SizedBox(height: 60),
        ErrorView(message: _error!, onRetry: reload)
      ]);
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
            actionLabel:
                _filter == 'ALL' && query.isEmpty ? 'Thêm hóa đơn' : null,
            onAction: _filter == 'ALL' && query.isEmpty ? _openAddSheet : null,
          ),
        ],
      );
    } else {
      content = ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        itemCount: visible.length,
        itemBuilder: (context, index) {
          final invoice = visible[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _InvoiceCard(
              invoice: invoice,
              onTap: () => pushScreen<bool>(
                  context, InvoiceReviewScreen(invoiceId: invoice.id)),
            ),
          );
        },
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Hóa đơn AI'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _uploading ? null : _openAddSheet,
        icon: const Icon(Icons.add_a_photo_outlined),
        label: const Text('Thêm hóa đơn'),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: TextField(
                  textInputAction: TextInputAction.search,
                  onChanged: (value) => setState(() => _query = value),
                  decoration: fieldDecoration('Tìm theo cửa hàng hoặc tên tệp',
                      icon: Icons.search),
                ),
              ),
              SizedBox(
                height: 40,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _filters.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final option = _filters[index];
                    final selected = option.key == _filter;
                    return ChoiceChip(
                      label: Text(option.value),
                      selected: selected,
                      showCheckmark: false,
                      onSelected: (_) => _setFilter(option.key),
                      selectedColor: AppColors.soft,
                      backgroundColor: AppColors.surface,
                      side: BorderSide(
                          color: selected ? AppColors.blue : AppColors.line),
                      labelStyle: TextStyle(
                        fontSize: 13,
                        fontWeight:
                            selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? AppColors.blue : AppColors.muted,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              Consumer<InvoiceQueue>(
                  builder: (context, queue, _) => ListTile(
                        leading: const Icon(Icons.cloud_upload_outlined),
                        title: Text(
                            'Hàng đợi trên điện thoại (${queue.pendingCount} chưa hoàn tất)'),
                        subtitle: Text(queue.error ??
                            (queue.paused
                                ? 'Đang tạm dừng gửi'
                                : 'Lưu ảnh khi mất mạng, tự gửi lại khi có kết nối')),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => pushScreen<void>(
                            context, const InvoiceQueueScreen()),
                      )),
              Expanded(
                child: RefreshIndicator(
                    onRefresh: reload, color: AppColors.blue, child: content),
              ),
            ],
          ),
          if (_uploading)
            Positioned.fill(
              child: ColoredBox(
                color: const Color(0x99172033),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 28, vertical: 22),
                    decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16)),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                            width: 30,
                            height: 30,
                            child: CircularProgressIndicator(strokeWidth: 3)),
                        SizedBox(height: 14),
                        Text('Đang lưu ảnh trên điện thoại...',
                            style: TextStyle(
                                fontSize: 14.5, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice, required this.onTap});

  final InvoiceSummary invoice;
  final VoidCallback onTap;

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

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          IconBadge(icon: typeIcon, color: style.color, size: 46),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  details.join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      const TextStyle(fontSize: 12.5, color: AppColors.muted),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    InvoiceStatusChip(invoice.status),
                    const Spacer(),
                    if (total != null && total > 0)
                      Text(formatMoney(total),
                          style: moneyStyle.copyWith(
                              fontSize: 15, color: AppColors.ink)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
