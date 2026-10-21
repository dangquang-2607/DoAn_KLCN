import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

/// Chuyển tiền giữa hai ví của cùng một người dùng (không tính vào thu/chi).
class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _note = TextEditingController();

  String? _fromId;
  String? _toId;
  late DateTime _date;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _date = DateTime(now.year, now.month, now.day);
    final wallets = context.read<AppData>().wallets;
    if (wallets.isNotEmpty) _fromId = wallets.first.id;
    if (wallets.length > 1) _toId = wallets[1].id;
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _choose({required bool source}) async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(
      context,
      wallets: appData.wallets,
      selectedId: source ? _fromId : _toId,
      excludeId: source ? _toId : _fromId,
      title: source ? 'Chuyển từ ví' : 'Chuyển đến ví',
    );
    if (wallet == null || !mounted) return;
    setState(() {
      if (source) {
        _fromId = wallet.id;
      } else {
        _toId = wallet.id;
      }
    });
  }

  void _swap() {
    setState(() {
      final previous = _fromId;
      _fromId = _toId;
      _toId = previous;
    });
  }

  Future<void> _submit() async {
    final amount = parseAmountInput(_amount.text);
    final fromId = _fromId;
    final toId = _toId;
    if (fromId == null || toId == null) {
      showSnack('Vui lòng chọn ví nguồn và ví đích.', error: true);
      return;
    }
    if (fromId == toId) {
      showSnack('Ví nguồn và ví đích không được trùng nhau.', error: true);
      return;
    }
    if (amount <= 0) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.transfer(
        fromAccountId: fromId,
        toAccountId: toId,
        amount: amount,
        date: _date,
        note: _note.text.trim(),
      );
      await appData.markChanged();
      showSnack('Đã chuyển ${formatMoney(amount)} giữa hai ví.');
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _walletField(String label, Wallet? wallet, VoidCallback onTap) {
    return PickerField(
      label: label,
      value: wallet == null ? null : '${wallet.name} · ${formatMoney(wallet.balance, keepSign: true)}',
      placeholder: 'Chọn ví',
      leading: wallet == null
          ? null
          : IconBadge(icon: walletIcon(wallet.accountType), color: walletColor(wallet.accountType), size: 36),
      icon: Icons.account_balance_wallet_outlined,
      onTap: onTap,
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final from = appData.walletById(_fromId);
    final to = appData.walletById(_toId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Chuyển tiền giữa ví'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  if (appData.wallets.length < 2) ...[
                    const InfoBanner(
                      message: 'Cần ít nhất hai ví để chuyển tiền. Hãy tạo thêm ví trong mục "Ví & tài khoản".',
                      icon: Icons.info_outline,
                      color: AppColors.warning,
                    ),
                    const SizedBox(height: 12),
                  ],
                  _walletField('Từ ví', from, () => _choose(source: true)),
                  Center(
                    child: IconButton(
                      onPressed: _swap,
                      icon: const Icon(Icons.swap_vert, color: AppColors.blue),
                      tooltip: 'Đổi chiều chuyển',
                    ),
                  ),
                  _walletField('Đến ví', to, () => _choose(source: false)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [ThousandsInputFormatter()],
                    style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                    decoration: fieldDecoration('Số tiền chuyển (₫)', icon: Icons.payments_outlined),
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Ngày chuyển',
                    value: formatDate(_date),
                    icon: Icons.event_outlined,
                    onTap: () async {
                      final picked = await pickDate(context, initial: _date, last: DateTime.now());
                      if (picked != null && mounted) setState(() => _date = picked);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _note,
                    maxLength: 1000,
                    minLines: 2,
                    maxLines: 3,
                    decoration: fieldDecoration('Ghi chú (không bắt buộc)', icon: Icons.notes),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: 'Chuyển tiền',
                loading: _saving,
                onPressed: _submit,
                icon: Icons.swap_horiz,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
