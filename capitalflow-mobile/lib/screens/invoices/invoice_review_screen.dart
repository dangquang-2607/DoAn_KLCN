import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/api_client.dart';
import 'invoice_duplicate_dialog.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';
import 'invoice_common.dart';

/// Bộ điều khiển nhập liệu của một dòng hàng trên hóa đơn.
class _LineEditor {
  _LineEditor([InvoiceLine? line]) {
    if (line == null) return;
    name.text = line.name;
    unit.text = line.unit ?? '';
    quantity.text = _number(line.quantity, decimals: true);
    unitPrice.text = _money(line.unitPrice);
    lineTotal.text = _money(line.lineTotal);
    taxAmount = line.taxAmount;
  }

  final TextEditingController name = TextEditingController();
  final TextEditingController unit = TextEditingController();
  final TextEditingController quantity = TextEditingController();
  final TextEditingController unitPrice = TextEditingController();
  final TextEditingController lineTotal = TextEditingController();
  double? taxAmount;

  static String _money(double? value) {
    if (value == null) return '';
    return groupThousands(value.round().toString());
  }

  static String _number(double? value, {bool decimals = false}) {
    if (value == null) return '';
    if (!decimals || value == value.roundToDouble()) {
      return value.round().toString();
    }
    var text = value.toStringAsFixed(4);
    text = text.replaceFirst(RegExp(r'0+$'), '');
    return text.endsWith('.') ? text.substring(0, text.length - 1) : text;
  }

  InvoiceLine toLine() {
    double? money(TextEditingController controller) {
      if (controller.text.trim().isEmpty) return null;
      return parseAmountInput(controller.text).toDouble();
    }

    final quantityText = quantity.text.trim().replaceAll(',', '.');
    return InvoiceLine(
      name: name.text.trim(),
      unit: unit.text.trim(),
      quantity: quantityText.isEmpty ? null : double.tryParse(quantityText),
      unitPrice: money(unitPrice),
      lineTotal: money(lineTotal),
      taxAmount: taxAmount,
    );
  }

  void dispose() {
    name.dispose();
    unit.dispose();
    quantity.dispose();
    unitPrice.dispose();
    lineTotal.dispose();
  }
}

/// Kiểm tra và chỉnh sửa kết quả OCR trước khi lưu thành giao dịch chi tiêu.
///
/// Luồng: hóa đơn vừa tải lên → AI nhận dạng (worker nền) → người dùng soát lại tên
/// cửa hàng, ngày, danh sách sản phẩm, tổng tiền, thuế VAT → chọn ví/danh mục → xác nhận.
class InvoiceReviewScreen extends StatefulWidget {
  const InvoiceReviewScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  State<InvoiceReviewScreen> createState() => _InvoiceReviewScreenState();
}

class _InvoiceReviewScreenState extends State<InvoiceReviewScreen>
    with AutoRefresh<InvoiceReviewScreen> {
  final TextEditingController _address = TextEditingController();
  final TextEditingController _symbol = TextEditingController();
  final TextEditingController _time = TextEditingController();
  int _revision = 1;
  Json? _pendingConfirm;
  bool _versionConflict = false;
  final TextEditingController _merchant = TextEditingController();
  final TextEditingController _number = TextEditingController();
  final TextEditingController _taxCode = TextEditingController();
  final TextEditingController _vatRate = TextEditingController();
  final TextEditingController _subtotal = TextEditingController();
  final TextEditingController _tax = TextEditingController();
  final TextEditingController _total = TextEditingController();
  final TextEditingController _note = TextEditingController();
  final List<_LineEditor> _lines = <_LineEditor>[];

  InvoiceDetail? _detail;
  String? _populatedStatus;
  DateTime? _invoiceDate;
  String? _walletId;
  String? _categoryId;
  CategorySuggestion? _suggestion;
  Uint8List? _image;
  bool _imageRequested = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Timer? _pollTimer;
  int _request = 0;

  @override
  void dispose() {
    _pollTimer?.cancel();
    _address.dispose();
    _symbol.dispose();
    _time.dispose();
    _merchant.dispose();
    _number.dispose();
    _taxCode.dispose();
    _vatRate.dispose();
    _subtotal.dispose();
    _tax.dispose();
    _total.dispose();
    _note.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  bool get _hidden => _detail?.summary.hidden == true;
  bool get _locked => _busy || _pendingConfirm != null;
  bool get _confirmed => _detail?.summary.status == 'CONFIRMED';
  bool get _processing => _detail?.summary.status == 'PROCESSING';

  // ── Tải dữ liệu ───────────────────────────────────────────────────────────

  @override
  Future<void> reload() async {
    final request = ++_request;
    final appData = context.read<AppData>();
    try {
      if (!appData.loaded) await appData.refreshLookups();
      final detail = await appData.invoices.detail(widget.invoiceId);
      if (!mounted || request != _request) return;
      setState(() {
        _detail = detail;
        if (detail.summary.status == 'CONFIRMED') {
          _pendingConfirm = null;
          _versionConflict = false;
        }
        _error = null;
        _loading = false;
        // Chỉ nạp lại biểu mẫu khi trạng thái hóa đơn đổi (ví dụ OCR vừa xong), để
        // không ghi đè những gì người dùng đang chỉnh sửa.
        if (_populatedStatus != detail.summary.status) {
          _populate(detail, appData);
        }
      });
      _schedulePolling();
      _loadImage(detail, appData);
      if (_categoryId == null && !_confirmed) _fetchSuggestion();
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  void _populate(InvoiceDetail detail, AppData appData) {
    String money(double? value) => value == null || value == 0
        ? ''
        : groupThousands(value.round().toString());

    _populatedStatus = detail.summary.status;
    _revision = detail.summary.revision;
    _address.text = detail.merchantAddress ?? '';
    _symbol.text = detail.invoiceSymbol ?? '';
    _time.text = detail.invoiceTime ?? '';
    _merchant.text = detail.summary.merchantName ?? '';
    _number.text = detail.invoiceNumber ?? '';
    _taxCode.text = detail.merchantTaxCode ?? '';
    _vatRate.text = detail.vatRate ?? '';
    _subtotal.text = money(detail.subtotalAmount);
    _tax.text = money(detail.taxAmount);
    _total.text = money(detail.summary.totalAmount);
    _note.text = detail.note ?? '';
    _invoiceDate = detail.summary.invoiceDate;
    for (final line in _lines) {
      line.dispose();
    }
    _lines
      ..clear()
      ..addAll(detail.items.map((item) => _LineEditor(item)));
    _walletId = detail.accountId ??
        _walletId ??
        (appData.wallets.isNotEmpty ? appData.wallets.first.id : null);
    _categoryId = detail.categoryId ?? _categoryId;
  }

  void _schedulePolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    if (_processing) {
      _pollTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) reload();
      });
    }
  }

  Future<void> _loadImage(InvoiceDetail detail, AppData appData) async {
    if (_imageRequested || !detail.summary.isImage) return;
    _imageRequested = true;
    try {
      final bytes = await appData.invoices.fileBytes(widget.invoiceId);
      if (mounted) setState(() => _image = bytes);
    } catch (_) {
      // Không tải được ảnh gốc: vẫn cho duyệt dữ liệu đã nhận dạng.
    }
  }

  Future<void> _fetchSuggestion() async {
    final appData = context.read<AppData>();
    final merchant = _merchant.text.trim();
    final names = _lines
        .map((line) => line.name.text.trim())
        .where((name) => name.isNotEmpty)
        .toList();
    if (merchant.isEmpty && names.isEmpty) return;
    try {
      final suggestion = await appData.finance.suggestCategory(
        type: 'EXPENSE',
        description: merchant.isEmpty ? 'Hóa đơn' : merchant,
        itemNames: names,
      );
      if (!mounted || _categoryId != null) return;
      setState(() =>
          _suggestion = suggestion.categoryId == null ? null : suggestion);
    } catch (_) {
      // Gợi ý danh mục chỉ là tiện ích bổ sung.
    }
  }

  // ── Hành động ─────────────────────────────────────────────────────────────

  Future<void> _runOcr() async {
    final appData = context.read<AppData>();
    setState(() => _busy = true);
    try {
      await appData.invoices.requestOcr(widget.invoiceId);
      showSnack('Đã gửi yêu cầu quét. AI đang nhận dạng hóa đơn...');
      await reload();
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    if (_busy || _hidden || _confirmed || _processing || _versionConflict) {
      return;
    }
    final total = parseAmountInput(_total.text);
    if (total <= 0 || _walletId == null) {
      showSnack('Nhập tổng tiền lớn hơn 0 và chọn ví thanh toán.', error: true);
      return;
    }
    final time = _time.text.trim();
    if (time.isNotEmpty &&
        !RegExp(r'^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$').hasMatch(time)) {
      showSnack('Giờ hóa đơn phải có dạng HH:mm, ví dụ 09:14.', error: true);
      return;
    }
    String? clean(TextEditingController field) =>
        field.text.trim().isEmpty ? null : field.text.trim();
    final fields = <String, dynamic>{
      'account_id': _walletId,
      'category_id': _categoryId,
      'merchant_name': clean(_merchant),
      'merchant_address': clean(_address),
      'merchant_tax_code': clean(_taxCode),
      'invoice_number': clean(_number),
      'invoice_symbol': clean(_symbol),
      'invoice_time': clean(_time),
      'invoice_date': _invoiceDate == null ? null : isoDate(_invoiceDate!),
      'total_amount': total,
      'vat_rate': clean(_vatRate),
      'note': clean(_note),
      'subtotal_amount':
          clean(_subtotal) == null ? null : parseAmountInput(_subtotal.text),
      'tax_amount': clean(_tax) == null ? null : parseAmountInput(_tax.text),
      'items': _lines
          .map((e) => e.toLine())
          .where((e) => e.name.isNotEmpty)
          .map((e) => e.toJson())
          .toList(),
      'expected_revision': _revision,
    };
    final appData = context.read<AppData>();
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      var payload = _pendingConfirm;
      if (payload == null) {
        final check = await appData.invoices.preview(widget.invoiceId, fields);
        if (!mounted) return;
        String? decision;
        if (check['level'] != 'NONE') {
          decision = await reviewInvoiceDuplicates(context, check);
          if (!mounted || decision == null) return;
          if (decision.startsWith('open:') || decision.startsWith('same:')) {
            final id = decision.substring(decision.indexOf(':') + 1);
            if (decision.startsWith('same:')) {
              await appData.invoices
                  .resolve(widget.invoiceId, _revision, matchedId: id);
              await appData.markChanged();
            }
            if (!mounted) return;
            await pushScreen<bool>(context, InvoiceReviewScreen(invoiceId: id));
            await reload();
            return;
          }
          if (check['level'] == 'EXACT' || decision != 'distinct') return;
        }
        payload = {
          ...fields,
          'duplicate_review_token': check['review_token'],
          'accept_distinct': decision == 'distinct'
        };
        _pendingConfirm = payload;
      }
      final result = await appData.invoices.confirm(widget.invoiceId, payload);
      _pendingConfirm = null;
      await appData.markChanged();
      if (!mounted) return;
      showSnack(result['outcome'] == 'ALREADY_CONFIRMED'
          ? 'Hóa đơn đã ghi sổ trước đó. Không tạo thêm khoản chi.'
          : 'Đã ghi khoản chi ${formatMoney(total)} từ hóa đơn.');
      Navigator.of(context).pop(true);
    } catch (error) {
      final uncertain = error is ApiException && error.uncertain;
      if (!uncertain) _pendingConfirm = null;
      if (error is ApiException && error.statusCode == 409) {
        _versionConflict = true;
      }
      showSnack(
          uncertain
              ? 'Chưa xác định được kết quả. Bấm thử lại để kiểm tra bằng cùng yêu cầu, tránh ghi hai lần.'
              : errorText(error),
          error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshVersion() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final detail =
          await context.read<AppData>().invoices.detail(widget.invoiceId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _revision = detail.summary.revision;
        _versionConflict = false;
      });
      showSnack('Đã tải phiên bản mới. Hãy kiểm tra lại trước khi xác nhận.');
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    if (_busy) return;
    final appData = context.read<AppData>();
    setState(() => _busy = true);
    try {
      final result = await appData.invoices
          .restore(widget.invoiceId, _detail!.summary.revision);
      await appData.markChanged();
      await reload();
      _revision = _detail!.summary.revision;
      showSnack(result['requires_file'] == true
          ? 'Đã khôi phục dữ liệu. Tải lại ảnh gốc nếu cần xem ảnh hoặc quét lại.'
          : 'Đã khôi phục hóa đơn.');
    } catch (error) {
      showSnack(errorText(error), error: true);
      await reload();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clearDuplicate() async {
    final appData = context.read<AppData>();
    setState(() => _busy = true);
    try {
      await appData.invoices.resolve(widget.invoiceId, _revision);
      await appData.markChanged();
      await reload();
      _revision = _detail!.summary.revision;
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await confirmDialog(
      context,
      title: 'Xóa hóa đơn?',
      message:
          'Hóa đơn và ảnh được giữ trong Thùng rác 30 ngày để khôi phục, sau đó xóa vĩnh viễn. Khoản chi đã ghi sổ vẫn được giữ.',
      confirmLabel: 'Xóa',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _busy = true);
    try {
      _pollTimer?.cancel();
      await appData.invoices.delete(widget.invoiceId);
      // Rời màn hình trước khi báo dữ liệu đổi để không tải lại một hóa đơn đã xóa.
      navigator.pop(true);
      showSnack('Đã chuyển hóa đơn vào Thùng rác trong 30 ngày.');
      await appData.markChanged();
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _busy = false);
    }
  }

  void _useLinesTotal() {
    var sum = 0;
    for (final line in _lines) {
      sum += parseAmountInput(line.lineTotal.text);
    }
    if (sum <= 0) return;
    setState(() {
      final tax = parseAmountInput(_tax.text);
      _subtotal.text = groupThousands(sum.toString());
      _total.text = groupThousands((sum + tax).toString());
    });
  }

  void _openImage() {
    final image = _image;
    if (image == null) return;
    pushScreen<void>(
      context,
      Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: const Text('Ảnh hóa đơn gốc', style: TextStyle(fontSize: 17)),
        ),
        body: Center(
          child: InteractiveViewer(
              minScale: 1, maxScale: 5, child: Image.memory(image)),
        ),
      ),
    );
  }

  // ── Giao diện ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    Widget body;
    if (detail == null) {
      body = _loading
          ? const LoadingView()
          : ErrorView(
              message: _error ?? 'Không tải được hóa đơn.', onRetry: reload);
    } else {
      body = _buildContent(detail);
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(
        'Kiểm tra hóa đơn',
        actions: [
          if (detail != null && !_hidden)
            IconButton(
              onPressed: _locked ? null : _delete,
              icon: const Icon(Icons.delete_outline, color: AppColors.danger),
              tooltip: 'Xóa hóa đơn',
            ),
        ],
      ),
      body: SafeArea(child: body),
    );
  }

  Widget _buildContent(InvoiceDetail detail) {
    final appData = context.watch<AppData>();
    final status = detail.summary.status;
    final readOnly = _confirmed || _processing || _hidden || _locked;
    final wallet = appData.walletById(_walletId);
    final category = appData.categoryById(_categoryId);
    final suggestion = _suggestion;
    final confidence = detail.summary.ocrConfidence;

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            children: [
              _statusPanel(detail),
              if (_versionConflict) ...[
                const InfoBanner(
                    message:
                        'Hóa đơn hoặc kết quả đối chiếu đã thay đổi. Tải phiên bản mới rồi kiểm tra lại.'),
                TextButton(
                    onPressed: _busy ? null : _refreshVersion,
                    child: const Text('Tải phiên bản mới')),
              ],
              if (_pendingConfirm != null)
                const InfoBanner(
                    message:
                        'Đang chờ xác định kết quả ghi sổ. Giữ nguyên thông tin và bấm Thử lại xác nhận.'),
              if (detail.summary.duplicateOfInvoiceId != null && !_hidden) ...[
                TextButton(
                    onPressed: _locked
                        ? null
                        : () => pushScreen<bool>(
                            context,
                            InvoiceReviewScreen(
                                invoiceId:
                                    detail.summary.duplicateOfInvoiceId!)),
                    child: const Text('Mở hóa đơn gốc đã liên kết')),
                if (!_confirmed)
                  TextButton(
                      onPressed: _locked ? null : _clearDuplicate,
                      child: const Text('Bỏ đánh dấu cùng hóa đơn')),
              ],
              if (detail.isDuplicate) ...[
                const SizedBox(height: 10),
                InfoBanner(
                  message: detail.duplicateReason ??
                      'Hóa đơn này có thể trùng với một hóa đơn đã xác nhận.',
                  icon: Icons.copy_all_outlined,
                  color: AppColors.danger,
                ),
              ],
              if (_image != null) ...[
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: _openImage,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        Image.memory(
                          _image!,
                          cacheWidth: 900,
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          alignment: Alignment.topCenter,
                          gaplessPlayback: true,
                        ),
                        Container(
                          margin: const EdgeInsets.all(10),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                              color: const Color(0xCC172033),
                              borderRadius: BorderRadius.circular(999)),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.zoom_in,
                                  size: 16, color: Colors.white),
                              SizedBox(width: 4),
                              Text('Xem ảnh gốc',
                                  style: TextStyle(
                                      fontSize: 12.5, color: Colors.white)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SectionHeader('Thông tin hóa đơn'),
              if (_image == null && detail.summary.isImage)
                const Text(
                    'Nếu ảnh gốc không còn, hãy tải lại cùng ảnh sau khi khôi phục dữ liệu.'),
              if (confidence != null && status == 'REVIEW_REQUIRED') ...[
                InfoBanner(
                  message:
                      'Độ tin cậy nhận dạng: ${(confidence * 100).round()}%. '
                      'Hãy soát lại các trường bên dưới trước khi ghi sổ.',
                  icon: Icons.auto_awesome,
                  color: confidence >= 0.85
                      ? AppColors.success
                      : AppColors.warning,
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _merchant,
                enabled: !readOnly,
                maxLength: 255,
                textCapitalization: TextCapitalization.words,
                onEditingComplete: () {
                  FocusScope.of(context).unfocus();
                  if (_categoryId == null) _fetchSuggestion();
                },
                decoration: fieldDecoration('Tên cửa hàng / người bán',
                    icon: Icons.storefront_outlined),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: PickerField(
                      label: 'Ngày hóa đơn',
                      value: _invoiceDate == null
                          ? null
                          : formatDate(_invoiceDate),
                      placeholder: 'Chọn ngày',
                      onTap: readOnly
                          ? null
                          : () async {
                              final picked = await pickDate(
                                context,
                                initial: _invoiceDate ?? DateTime.now(),
                                last:
                                    DateTime.now().add(const Duration(days: 1)),
                              );
                              if (picked != null && mounted) {
                                setState(() => _invoiceDate = picked);
                              }
                            },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _number,
                      enabled: !readOnly,
                      maxLength: 100,
                      decoration: fieldDecoration('Số hóa đơn'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _taxCode,
                      enabled: !readOnly,
                      maxLength: 100,
                      decoration: fieldDecoration('Mã số thuế'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _vatRate,
                      enabled: !readOnly,
                      maxLength: 50,
                      decoration: fieldDecoration('Thuế suất VAT (%)'),
                    ),
                  ),
                ],
              ),
              TextField(
                  controller: _address,
                  enabled: !readOnly,
                  maxLength: 500,
                  decoration: fieldDecoration('Địa chỉ người bán')),
              TextField(
                  controller: _symbol,
                  enabled: !readOnly,
                  maxLength: 100,
                  decoration: fieldDecoration('Ký hiệu hóa đơn')),
              TextField(
                  controller: _time,
                  enabled: !readOnly,
                  maxLength: 8,
                  decoration: fieldDecoration('Giờ hóa đơn (HH:mm, nếu có)')),
              SectionHeader(
                'Danh sách sản phẩm (${_lines.length})',
                actionLabel: readOnly ? null : 'Thêm dòng',
                onAction: readOnly
                    ? null
                    : () => setState(() => _lines.add(_LineEditor())),
              ),
              if (_lines.isEmpty)
                const AppCard(
                  child: Text(
                    'Chưa có dòng sản phẩm nào. Bạn có thể thêm dòng hoặc chỉ nhập tổng tiền.',
                    style: TextStyle(fontSize: 13.5, color: AppColors.muted),
                  ),
                ),
              for (var i = 0; i < _lines.length; i++) _lineCard(i, readOnly),
              const SectionHeader('Tổng tiền & thuế'),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _subtotal,
                      enabled: !readOnly,
                      keyboardType: TextInputType.number,
                      inputFormatters: [ThousandsInputFormatter()],
                      decoration: fieldDecoration('Tiền hàng (₫)'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _tax,
                      enabled: !readOnly,
                      keyboardType: TextInputType.number,
                      inputFormatters: [ThousandsInputFormatter()],
                      decoration: fieldDecoration('Tiền thuế VAT (₫)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _total,
                enabled: !readOnly,
                keyboardType: TextInputType.number,
                inputFormatters: [ThousandsInputFormatter()],
                style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                decoration: fieldDecoration('Tổng thanh toán (₫)',
                    icon: Icons.payments_outlined),
              ),
              if (!readOnly && _lines.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _useLinesTotal,
                    icon: const Icon(Icons.calculate_outlined, size: 18),
                    label: const Text('Tính lại tổng từ các dòng sản phẩm'),
                  ),
                ),
              const SectionHeader('Ghi sổ vào'),
              PickerField(
                label: 'Ví thanh toán',
                value: wallet == null
                    ? null
                    : '${wallet.name} · ${formatMoney(wallet.balance, keepSign: true)}',
                placeholder: appData.wallets.isEmpty
                    ? 'Chưa có ví — hãy tạo ví trước'
                    : 'Chọn ví',
                leading: wallet == null
                    ? null
                    : IconBadge(
                        icon: walletIcon(wallet.accountType),
                        color: walletColor(wallet.accountType),
                        size: 36),
                icon: Icons.account_balance_wallet_outlined,
                onTap: readOnly
                    ? null
                    : () async {
                        final picked = await pickWallet(context,
                            wallets: appData.wallets, selectedId: _walletId);
                        if (picked != null && mounted) {
                          setState(() => _walletId = picked.id);
                        }
                      },
              ),
              const SizedBox(height: 10),
              PickerField(
                label: 'Danh mục chi',
                value: category?.name,
                placeholder: 'Không phân loại (tự gợi ý)',
                leading: category == null
                    ? null
                    : CategoryAvatar(
                        icon: category.icon,
                        color: category.color,
                        name: category.name,
                        size: 36),
                icon: Icons.sell_outlined,
                onTap: readOnly
                    ? null
                    : () async {
                        final choice = await pickCategory(
                          context,
                          categories: appData.categoriesOf('EXPENSE'),
                          selectedId: _categoryId,
                        );
                        if (choice == null || !mounted) return;
                        setState(() {
                          _categoryId = choice.category?.id;
                          if (_categoryId != null) _suggestion = null;
                        });
                      },
              ),
              if (!readOnly && suggestion != null && _categoryId == null) ...[
                const SizedBox(height: 8),
                InfoBanner(
                  message: 'Gợi ý tự động: ${suggestion.categoryName ?? ''} '
                      '(${(suggestion.confidence * 100).round()}%). '
                      '${suggestion.autoApply ? 'Sẽ tự áp dụng khi ghi sổ.' : 'Chạm ô Danh mục để chọn.'}',
                  icon: Icons.auto_awesome,
                  color: AppColors.warning,
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: _note,
                enabled: !readOnly,
                maxLength: 1000,
                minLines: 2,
                maxLines: 3,
                decoration: fieldDecoration('Ghi chú (không bắt buộc)',
                    icon: Icons.notes),
              ),
            ],
          ),
        ),
        if (!_confirmed && !_processing && !_hidden)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: PrimaryButton(
              label: _pendingConfirm != null
                  ? 'Thử lại xác nhận'
                  : 'Kiểm tra & ghi khoản chi',
              loading: _busy,
              onPressed: _versionConflict ? null : _confirm,
              icon: Icons.task_alt,
            ),
          ),
      ],
    );
  }

  Widget _statusPanel(InvoiceDetail detail) {
    if (_hidden) {
      return AppCard(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Hóa đơn trong Thùng rác, có thể khôi phục trong 30 ngày. Hết hạn sẽ xóa vĩnh viễn hóa đơn; khoản chi đã ghi sổ vẫn giữ lại.'),
        FilledButton(
            onPressed: _busy ? null : _restore,
            child: const Text('Khôi phục thông tin hóa đơn')),
      ]));
    }
    final status = detail.summary.status;
    final style = invoiceStatusStyle(status);
    String message;
    Widget? action;
    switch (status) {
      case 'PROCESSING':
        message =
            'AI đang nhận dạng hóa đơn. Màn hình sẽ tự cập nhật khi có kết quả (thường dưới 1 phút).';
        break;
      case 'UPLOADED':
        message =
            'Hóa đơn chưa được quét. Bấm "Quét AI" để nhận dạng tự động hoặc nhập tay thông tin bên dưới.';
        action = FilledButton.icon(
          onPressed: _locked ? null : _runOcr,
          icon: const Icon(Icons.document_scanner_outlined, size: 18),
          label: const Text('Quét AI'),
        );
        break;
      case 'FAILED':
        message =
            'Không nhận dạng được hóa đơn. Bạn có thể quét lại hoặc nhập tay rồi xác nhận.';
        action = OutlinedButton.icon(
          onPressed: _locked ? null : _runOcr,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Quét lại'),
        );
        break;
      case 'CONFIRMED':
        message = 'Hóa đơn đã được ghi thành khoản chi'
            '${detail.summary.confirmedAt == null ? '' : ' lúc ${formatDateTime(detail.summary.confirmedAt)}'}.';
        break;
      default:
        message = detail.summary.isXml
            ? 'Dữ liệu được đọc trực tiếp từ hóa đơn điện tử XML. Hãy kiểm tra rồi xác nhận.'
            : 'AI đã nhận dạng xong. Hãy kiểm tra, chỉnh sửa nếu cần rồi xác nhận để ghi khoản chi.';
        break;
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (status == 'PROCESSING')
                const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.4))
              else
                Icon(style.icon, size: 22, color: style.color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  detail.summary.originalFilename ?? 'Hóa đơn',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 14.5, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              InvoiceStatusChip(status),
            ],
          ),
          const SizedBox(height: 8),
          Text(message,
              style: const TextStyle(
                  fontSize: 13.5, height: 1.45, color: AppColors.muted)),
          if (action != null) ...[const SizedBox(height: 12), action],
        ],
      ),
    );
  }

  Widget _lineCard(int index, bool readOnly) {
    final line = _lines[index];
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.fromLTRB(12, 10, 6, 12),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      color: AppColors.soft, shape: BoxShape.circle),
                  child: Text(
                    '${index + 1}',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.blue),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: line.name,
                    enabled: !readOnly,
                    maxLength: 500,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w600),
                    decoration: const InputDecoration(
                      hintText: 'Tên hàng hóa / dịch vụ',
                      border: InputBorder.none,
                      isDense: true,
                      counterText: '',
                    ),
                  ),
                ),
                if (!readOnly)
                  IconButton(
                    onPressed: () => setState(() {
                      _lines.removeAt(index).dispose();
                    }),
                    icon: const Icon(Icons.close,
                        size: 18, color: AppColors.muted),
                    tooltip: 'Xóa dòng',
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: line.quantity,
                      enabled: !readOnly,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [DecimalInputFormatter()],
                      decoration: fieldDecoration('SL'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 4,
                    child: TextField(
                      controller: line.unitPrice,
                      enabled: !readOnly,
                      keyboardType: TextInputType.number,
                      inputFormatters: [ThousandsInputFormatter()],
                      decoration: fieldDecoration('Đơn giá'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 5,
                    child: TextField(
                      controller: line.lineTotal,
                      enabled: !readOnly,
                      keyboardType: TextInputType.number,
                      inputFormatters: [ThousandsInputFormatter()],
                      decoration: fieldDecoration('Thành tiền'),
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
}
