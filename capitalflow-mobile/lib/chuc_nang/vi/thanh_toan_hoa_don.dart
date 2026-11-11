import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../ha_tang/api.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import 'quet_qr.dart';

class BillPaymentScreen extends StatefulWidget {
  const BillPaymentScreen({super.key, this.walletId, this.initialPayload});
  final String? walletId, initialPayload;
  @override
  State<BillPaymentScreen> createState() => _BillPaymentScreenState();
}

class _BillPaymentScreenState extends State<BillPaymentScreen> {
  String _payload = '';
  String? _walletId, _error;
  Json? _bill, _receipt;
  DateTime? _displayedAt;
  bool _busy = false, _uncertain = false;
  @override
  void initState() {
    super.initState();
    _walletId = widget.walletId;
    _payload = widget.initialPayload?.trim() ?? '';
    if (_payload.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
    }
  }

  Future<void> _scan() async {
    final value = await pushScreen<String>(
        context, const QrScanScreen(pickOnly: true, billOnly: true));
    if (!mounted || value == null) return;
    _payload = value.trim();
    await _resolve();
  }

  Future<void> _resolve() async {
    if (!mounted || _busy || _uncertain || _payload.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
      _bill = null;
    });
    try {
      final data = context.read<AppData>();
      final result = await data.finance.api
          .post('/wallets/bills/resolve', body: {'qr_payload': _payload});
      if (!mounted) return;
      final bill = Map<String, dynamic>.from(result as Map);
      final receipt =
          await data.finance.findBillReceipt(bill['qr_payload'] as String);
      if (!mounted) return;
      setState(() {
        _bill = bill;
        _receipt = receipt;
        _displayedAt = DateTime.now();
        if (data.walletById(_walletId)?.isActive != true) {
          _walletId =
              data.wallets.where((wallet) => wallet.isActive).firstOrNull?.id;
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    if (_busy || _bill == null || _walletId == null) return;
    final data = context.read<AppData>();
    if (!_uncertain &&
        !await confirmDialog(context,
            title: 'Xác nhận thanh toán',
            message:
                'Trả ${editMoney(_bill!['amount'])} ₫ cho ${_bill!['merchant_name']} từ ví đã chọn?',
            confirmLabel: 'Thanh toán')) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_uncertain) {
        final receipt =
            await data.finance.findBillReceipt(_bill!['qr_payload'] as String);
        if (!mounted) return;
        if (receipt != null) {
          setState(() {
            _receipt = receipt;
            _uncertain = false;
          });
          await data.markChanged();
          return;
        }
      }
      final receipt = await data.finance.payBill(
        walletId: _walletId!,
        qrPayload: _bill!['qr_payload'] as String,
      );
      if (mounted) {
        setState(() {
          _receipt = receipt;
          _uncertain = false;
        });
      }
      await data.markChanged();
    } catch (e) {
      if (mounted) {
        setState(() {
          _uncertain = e is! ApiException || e.uncertain;
          _error = errorText(e);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppData>();
    final theme = Theme.of(context);
    final bill = _bill;
    final receipt = _receipt;
    final wallet = data.walletById(_walletId);
    final wallets = data.wallets.where((wallet) => wallet.isActive).toList();
    final canEdit = !_busy && !_uncertain;

    return Scaffold(
      appBar: appBar(
        context,
        receipt == null ? 'Thanh toán hóa đơn' : 'Thanh toán thành công',
        titleMaxLines: 2,
      ),
      body: SafeArea(
        top: false,
        bottom: bill == null,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  Space.md, Space.md, Space.md, Space.xl),
              children: [
                if (_error case final error?) ...[
                  InfoBanner(
                      message: error,
                      icon: Icons.error_outline,
                      color: theme.colorScheme.error),
                  const SizedBox(height: Space.md),
                ],
                if (bill == null)
                  _scanPrompt(context)
                else ...[
                  if (receipt == null) ...[
                    Text('Thanh toán từ ví',
                        style: theme.textTheme.titleMedium),
                    const SizedBox(height: Space.xs),
                    if (wallets.isEmpty)
                      const Text('Chưa có ví đang hoạt động để trích tiền.')
                    else
                      PickerField(
                        label: wallet?.isActive == true
                            ? 'Ví trích tiền · Số dư ${formatMoney(wallet!.balance)}'
                            : 'Ví trích tiền',
                        value: wallet?.name,
                        onTap: canEdit
                            ? () async {
                                final choice = await pickWallet(context,
                                    wallets: wallets, selectedId: _walletId);
                                if (choice != null && mounted) {
                                  setState(() => _walletId = choice.id);
                                }
                              }
                            : null,
                      ),
                    const SizedBox(height: Space.md),
                  ],
                  _BillReceipt(
                      bill: bill, receipt: receipt, displayedAt: _displayedAt),
                  if (receipt == null) ...[
                    const SizedBox(height: Space.md),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: canEdit ? _scan : null,
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Quét mã khác'),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: bill == null
          ? null
          : DecoratedBox(
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.line)),
              ),
              child: SafeArea(
                top: false,
                child: Align(
                  heightFactor: 1,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 640),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: Space.md, vertical: Space.sm),
                      child: PrimaryButton(
                        label: receipt != null
                            ? 'Hoàn tất'
                            : _uncertain
                                ? 'Kiểm tra lại kết quả'
                                : 'Xác nhận thanh toán',
                        wrapLabel: true,
                        loading: receipt == null && _busy,
                        onPressed: receipt != null
                            ? () => Navigator.pop(context, true)
                            : wallet?.isActive == true || _uncertain
                                ? _pay
                                : null,
                      ),
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _scanPrompt(BuildContext context) {
    if (_busy || (_error == null && _payload.isNotEmpty)) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: Space.xxl),
        child: Column(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: Space.md),
            Text('Đang kiểm tra hóa đơn…'),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          child: Column(
            children: [
              const Icon(Icons.qr_code_scanner,
                  size: 40, color: AppColors.blue),
              const SizedBox(height: Space.md),
              Text('Quét QR hóa đơn',
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: Space.xs),
              const Text(
                'Dùng camera hoặc chọn ảnh có mã QR hóa đơn mô phỏng CapitalFlow.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: Space.lg),
              PrimaryButton(
                  label: 'Quét mã QR', wrapLabel: true, onPressed: _scan),
            ],
          ),
        ),
        if (_payload.isNotEmpty) ...[
          const SizedBox(height: Space.xs),
          TextButton(onPressed: _resolve, child: const Text('Kiểm tra lại mã')),
        ],
      ],
    );
  }
}

class _BillReceipt extends StatelessWidget {
  const _BillReceipt({
    required this.bill,
    required this.receipt,
    required this.displayedAt,
  });

  final Json bill;
  final Json? receipt;
  final DateTime? displayedAt;

  static String _money(Object? value) => '${editMoney(value)} ₫';

  // Nhân theo đơn vị 1/100 đồng để giữ chính xác chuỗi Decimal từ API.
  static String _lineTotal(Json item) {
    final price = item['unit_price'].toString().split('.');
    final fraction = price.length == 2 ? price[1] : '';
    final minorUnits = BigInt.parse(price.first + fraction.padRight(2, '0'));
    final total = minorUnits * BigInt.from(asInt(item['quantity']));
    final digits = total.toString().padLeft(3, '0');
    return _money(
        '${digits.substring(0, digits.length - 2)}.${digits.substring(digits.length - 2)}');
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final items = asJsonList(bill['items']);
    final merchant = bill['merchant_name'].toString();
    final note = bill['note']?.toString().trim() ?? '';
    final paid = receipt != null;
    final paidAt = DateTime.tryParse(receipt?['paid_at']?.toString() ?? '');
    final operation = asText(receipt?['operation_id'] ?? receipt?['entry_id']);
    final amount = _money(receipt?['paid_amount'] ?? bill['amount']);
    final statusColor = paid ? AppColors.success : AppColors.warning;
    final media = MediaQuery.of(context);
    final compactItems =
        (media.size.width - media.padding.horizontal - 2 * Space.md)
                .clamp(0, 640) <
            media.textScaler.scale(300);

    Widget row(String label, String value, {bool total = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: Space.xxs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: total ? 2 : 1,
                child: Text(label,
                    style: total
                        ? text.titleSmall
                        : text.bodySmall?.copyWith(color: AppColors.muted)),
              ),
              const SizedBox(width: Space.xs),
              Expanded(
                flex: total ? 3 : 2,
                child: Text(value,
                    textAlign: TextAlign.right,
                    style: total
                        ? text.titleLarge?.copyWith(
                            color: AppColors.blue, fontWeight: FontWeight.w800)
                        : text.bodySmall
                            ?.copyWith(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        );

    TableRow itemRow(List<String> cells, {bool heading = false}) => TableRow(
          children: [
            for (var i = 0; i < cells.length; i++)
              Padding(
                padding: EdgeInsets.only(
                    left: i == 0 ? 0 : Space.xxs,
                    top: Space.xs,
                    bottom: Space.xs),
                child: Text(
                  cells[i],
                  textAlign: [
                    TextAlign.left,
                    TextAlign.center,
                    TextAlign.right,
                    TextAlign.right
                  ][i],
                  style: text.bodySmall?.copyWith(
                    color: heading ? AppColors.muted : AppColors.ink,
                    fontWeight: heading || i == 3 ? FontWeight.w700 : null,
                  ),
                ),
              ),
          ],
        );

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Column(
        children: [
          const ColoredBox(
              color: AppColors.blue,
              child: SizedBox(height: 3, width: double.infinity)),
          Padding(
            padding: const EdgeInsets.all(Space.sm),
            child: SelectionArea(
              child: Column(
                children: [
                  Text(merchant.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: text.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: Space.xxs),
                  Text('HÓA ĐƠN BÁN HÀNG',
                      textAlign: TextAlign.center, style: text.labelLarge),
                  Text('Hệ thống CapitalFlow POS Pay',
                      textAlign: TextAlign.center,
                      style: text.bodySmall?.copyWith(color: AppColors.muted)),
                  const SizedBox(height: Space.xs),
                  const Divider(),
                  row('Mã hóa đơn', bill['bill_reference'].toString()),
                  row('Thời gian',
                      formatDateTime(paidAt?.toLocal() ?? displayedAt)),
                  if (operation != null) row('Mã giao dịch', operation),
                  if (note.isNotEmpty) row('Nội dung', note),
                  row('Phương thức', 'Quét mã QR ví điện tử'),
                  const Divider(),
                  if (compactItems)
                    for (final item in items) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(item['name'].toString(),
                            style: text.titleSmall),
                      ),
                      row('SL × đơn giá',
                          '${item['quantity']} × ${_money(item['unit_price'])}'),
                      row('Thành tiền', _lineTotal(item)),
                      const Divider(),
                    ]
                  else ...[
                    Table(
                      border: const TableBorder(
                          horizontalInside: BorderSide(color: AppColors.line)),
                      columnWidths: const {
                        0: FlexColumnWidth(3.2),
                        1: FlexColumnWidth(1.15),
                        2: FlexColumnWidth(2.8),
                        3: FlexColumnWidth(2.8),
                      },
                      children: [
                        itemRow(['Mặt hàng', 'SL', 'Đơn giá', 'T.Tiền'],
                            heading: true),
                        for (final item in items)
                          itemRow([
                            item['name'].toString(),
                            item['quantity'].toString(),
                            _money(item['unit_price']),
                            _lineTotal(item),
                          ]),
                      ],
                    ),
                    const Divider(),
                  ],
                  row('Tạm tính', _money(bill['amount'])),
                  row('Thuế GTGT (VAT)', 'Đã bao gồm'),
                  row('Tổng thanh toán', amount, total: true),
                  const SizedBox(height: Space.xs),
                  Chip(
                    avatar: Icon(
                        paid ? Icons.check_circle_outline : Icons.schedule,
                        size: 16,
                        color: statusColor),
                    label: Text(paid ? 'Đã thanh toán' : 'Chờ thanh toán'),
                    labelStyle: text.labelMedium?.copyWith(color: statusColor),
                    backgroundColor:
                        paid ? AppColors.successSoft : AppColors.warningSoft,
                    side: BorderSide.none,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
