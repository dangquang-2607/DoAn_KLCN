import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

/// Thanh toán hóa đơn mô phỏng bằng ví — giống bản web.
///
/// Trừ tiền trong ví và tự tạo khoản chi trong sổ thu chi. Nếu khoản chi đã được
/// nhập tay/OCR trước đó, người dùng chọn khoản đó để gắn vào thay vì ghi chi
/// hai lần. Mỗi mã hóa đơn chỉ thanh toán được một lần cho cùng nhà cung cấp.
class BillPaymentScreen extends StatefulWidget {
  const BillPaymentScreen({super.key, this.walletId});

  final String? walletId;

  @override
  State<BillPaymentScreen> createState() => _BillPaymentScreenState();
}

class _BillPaymentScreenState extends State<BillPaymentScreen> {
  final TextEditingController _merchant = TextEditingController();
  final TextEditingController _reference = TextEditingController();
  final TextEditingController _amount = TextEditingController();

  String? _walletId;
  Txn? _record;
  List<Txn> _records = <Txn>[];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final wallets = context.read<AppData>().wallets;
    _walletId = widget.walletId ?? (wallets.isNotEmpty ? wallets.first.id : null);
    _loadRecords();
  }

  @override
  void dispose() {
    _merchant.dispose();
    _reference.dispose();
    _amount.dispose();
    super.dispose();
  }

  /// Các khoản chi chưa gắn thanh toán — ứng viên để liên kết.
  Future<void> _loadRecords() async {
    try {
      final page = await context.read<AppData>().finance.transactions(type: 'EXPENSE', pageSize: 100);
      if (!mounted) return;
      setState(() => _records = page.items.where((txn) => !txn.fromWalletPayment).toList());
    } catch (_) {
      // Không tải được danh sách vẫn thanh toán được với khoản ghi nhận mới.
    }
  }

  Future<void> _chooseWallet() async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(context, wallets: appData.wallets, selectedId: _walletId);
    if (wallet != null && mounted) setState(() => _walletId = wallet.id);
  }

  Future<void> _chooseRecord() async {
    final picked = await showPickerSheet<Object>(
      context,
      title: 'Khoản chi đã ghi trước đó',
      children: (sheetContext) => [
        SheetOption(
          title: 'Tạo khoản ghi nhận mới',
          selected: _record == null,
          leading: const IconBadge(icon: Icons.add, color: AppColors.blue, size: 40),
          onTap: () => Navigator.of(sheetContext).pop(false),
        ),
        for (final txn in _records)
          SheetOption(
            title: txn.title,
            subtitle: '${formatDate(txn.date)} · ${formatMoney(txn.absAmount)}',
            selected: _record?.id == txn.id,
            onTap: () => Navigator.of(sheetContext).pop(txn),
          ),
      ],
    );
    if (!mounted || picked == null) return;
    setState(() {
      if (picked is Txn) {
        _record = picked;
        _amount.text = groupThousands(picked.absAmount.round().toString());
      } else {
        _record = null;
      }
    });
  }

  Future<void> _submit() async {
    final appData = context.read<AppData>();
    final wallet = appData.walletById(_walletId);
    final merchant = _merchant.text.trim();
    final reference = _reference.text.trim();
    final amount = parseAmountInput(_amount.text);
    if (wallet == null) {
      showSnack('Vui lòng chọn ví thanh toán.', error: true);
      return;
    }
    if (merchant.isEmpty || reference.isEmpty) {
      showSnack('Nhập nhà cung cấp và mã hóa đơn.', error: true);
      return;
    }
    if (amount <= 0) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    if (amount > wallet.balance) {
      showSnack('Số dư ví không đủ để thanh toán.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final confirmed = await confirmDialog(
      context,
      title: 'Xác nhận thanh toán',
      message: 'Trả ${formatMoney(amount)} từ ví "${wallet.name}" cho $merchant, mã $reference. '
          'Số tiền này sẽ được trừ khỏi ví.',
      confirmLabel: 'Thanh toán',
    );
    if (!confirmed || !mounted) return;
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.payBill(
        walletId: wallet.id,
        merchantName: merchant,
        billReference: reference,
        amount: amount,
        bookkeepingId: _record?.id,
      );
      await appData.markChanged();
      showSnack(_record == null
          ? 'Đã thanh toán ${formatMoney(amount)} và ghi khoản chi vào sổ.'
          : 'Đã thanh toán và gắn vào khoản chi có sẵn, không ghi chi lần hai.');
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final wallet = appData.walletById(_walletId);
    final record = _record;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Thanh toán hóa đơn'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  const InfoBanner(
                    message: 'Thanh toán mô phỏng sẽ trừ tiền trong ví. Mỗi mã hóa đơn chỉ thanh toán một lần cho cùng nhà cung cấp.',
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Thanh toán từ ví',
                    value: wallet == null ? null : '${wallet.name} · ${formatMoney(wallet.balance)}',
                    placeholder: 'Chọn ví',
                    leading: wallet == null
                        ? null
                        : IconBadge(icon: walletIcon(wallet.accountType), color: walletColor(wallet.accountType), size: 36),
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: _chooseWallet,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _merchant,
                    maxLength: 150,
                    textCapitalization: TextCapitalization.words,
                    decoration: fieldDecoration('Nhà cung cấp', icon: Icons.storefront_outlined, hint: 'Ví dụ: EVN HCMC'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _reference,
                    maxLength: 100,
                    decoration: fieldDecoration(
                      'Mã hóa đơn / kỳ thanh toán',
                      icon: Icons.tag,
                      helper: 'Dùng mã riêng cho từng hóa đơn/kỳ, ví dụ DIEN-2026-10-001.',
                    ),
                  ),
                  const SizedBox(height: 10),
                  PickerField(
                    label: 'Khoản chi đã ghi trước đó (nếu có)',
                    value: record == null ? 'Tạo khoản ghi nhận mới' : '${record.title} · ${formatMoney(record.absAmount)}',
                    icon: Icons.link,
                    onTap: _chooseRecord,
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(4, 6, 4, 0),
                    child: Text(
                      'Chọn khoản đã nhập tay/OCR để tránh ghi chi hai lần.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [ThousandsInputFormatter()],
                    style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                    decoration: fieldDecoration(
                      'Số tiền thanh toán (₫)',
                      icon: Icons.payments_outlined,
                      helper: wallet == null ? null : 'Số dư khả dụng: ${formatMoney(wallet.balance)}',
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: 'Kiểm tra và thanh toán',
                loading: _saving,
                onPressed: _submit,
                icon: Icons.receipt_long,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
