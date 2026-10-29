import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';
import 'bank_links_screen.dart';

/// Nạp tiền vào ví hoặc rút về ngân hàng đã liên kết — giống bản web.
///
/// Liên kết ngân hàng dùng chung cho mọi ví; nạp/rút chỉ đổi số dư ví và số
/// dư ngân hàng mô phỏng, không tính vào thu nhập/chi tiêu.
class BankMoneyScreen extends StatefulWidget {
  const BankMoneyScreen({super.key, this.walletId, this.topup = true});

  final String? walletId;
  final bool topup;

  @override
  State<BankMoneyScreen> createState() => _BankMoneyScreenState();
}

class _BankMoneyScreenState extends State<BankMoneyScreen> {
  final TextEditingController _amount = TextEditingController();

  late bool _topup;
  String? _walletId;
  String? _linkId;
  List<BankLink> _links = <BankLink>[];
  bool _loadingLinks = true;
  String? _linksError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _topup = widget.topup;
    final wallets = context.read<AppData>().wallets;
    _walletId = widget.walletId ?? (wallets.isNotEmpty ? wallets.first.id : null);
    _loadLinks();
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _loadLinks() async {
    setState(() {
      _loadingLinks = true;
      _linksError = null;
    });
    try {
      final links = await context.read<AppData>().finance.bankLinks();
      if (!mounted) return;
      final connected = links.where((link) => link.connected).toList();
      setState(() {
        _links = connected;
        if (_linkId == null || !connected.any((l) => l.id == _linkId)) {
          _linkId = connected.isEmpty ? null : connected.first.id;
        }
        _loadingLinks = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _linksError = errorText(error);
        _loadingLinks = false;
      });
    }
  }

  Future<void> _chooseWallet() async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(context, wallets: appData.wallets, selectedId: _walletId);
    if (wallet != null && mounted) setState(() => _walletId = wallet.id);
  }

  Future<void> _chooseBank() async {
    final picked = await pickOption<String>(
      context,
      title: 'Ngân hàng liên kết',
      options: [for (final link in _links) MapEntry(link.id, '${link.provider} · ${link.maskedNumber}')],
      selected: _linkId,
    );
    if (picked != null && mounted) setState(() => _linkId = picked);
  }

  Future<void> _openLinks() async {
    await pushScreen<bool>(context, const BankLinksScreen());
    if (mounted) await _loadLinks();
  }

  Future<void> _submit() async {
    final appData = context.read<AppData>();
    final wallet = appData.walletById(_walletId);
    final amount = parseAmountInput(_amount.text);
    final linkId = _linkId;
    if (wallet == null) {
      showSnack('Vui lòng chọn ví.', error: true);
      return;
    }
    if (linkId == null) {
      showSnack('Cần liên kết ngân hàng còn hiệu lực.', error: true);
      return;
    }
    if (amount <= 0) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    if (!_topup && amount > wallet.balance) {
      showSnack('Số dư ví không đủ để rút.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.bankMoney(walletId: wallet.id, topup: _topup, linkId: linkId, amount: amount);
      await appData.markChanged();
      showSnack(_topup
          ? 'Đã nạp ${formatMoney(amount)} vào "${wallet.name}".'
          : 'Đã rút ${formatMoney(amount)} từ "${wallet.name}".');
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
    BankLink? link;
    for (final item in _links) {
      if (item.id == _linkId) link = item;
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(_topup ? 'Nạp tiền vào ví' : 'Rút tiền về ngân hàng'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  SegmentedChoice<bool>(
                    options: const [MapEntry(true, 'Nạp tiền'), MapEntry(false, 'Rút tiền')],
                    value: _topup,
                    onChanged: (value) => setState(() => _topup = value),
                    colorOf: (value) => value ? AppColors.success : AppColors.blue,
                  ),
                  const SizedBox(height: 14),
                  PickerField(
                    label: _topup ? 'Nạp vào ví' : 'Rút từ ví',
                    value: wallet == null ? null : '${wallet.name} · ${formatMoney(wallet.balance)}',
                    placeholder: 'Chọn ví',
                    leading: wallet == null
                        ? null
                        : IconBadge(icon: walletIcon(wallet.accountType), color: walletColor(wallet.accountType), size: 36),
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: _chooseWallet,
                  ),
                  const SizedBox(height: 12),
                  if (_loadingLinks)
                    const LoadingView()
                  else if (_linksError != null)
                    ErrorView(message: _linksError!, onRetry: _loadLinks)
                  else if (_links.isEmpty)
                    InfoBanner(
                      message: 'Bạn chưa liên kết ngân hàng nào. Liên kết một lần để nạp/rút cho tất cả ví.',
                      color: AppColors.warning,
                      icon: Icons.account_balance_outlined,
                    )
                  else
                    PickerField(
                      label: _topup ? 'Từ ngân hàng' : 'Về ngân hàng',
                      value: link == null ? null : '${link.provider} · ${link.maskedNumber}',
                      placeholder: 'Chọn ngân hàng',
                      icon: Icons.account_balance_outlined,
                      onTap: _chooseBank,
                    ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _openLinks,
                      icon: const Icon(Icons.link, size: 18),
                      label: Text(_links.isEmpty ? 'Liên kết ngân hàng' : 'Quản lý ngân hàng liên kết'),
                    ),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [ThousandsInputFormatter()],
                    style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                    decoration: fieldDecoration(
                      _topup ? 'Số tiền nạp (₫)' : 'Số tiền rút (₫)',
                      icon: Icons.payments_outlined,
                      helper: !_topup && wallet != null ? 'Số dư khả dụng: ${formatMoney(wallet.balance)}' : null,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Nạp và rút chỉ thay đổi số dư ví, không tính vào thu nhập/chi tiêu.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: _topup ? 'Nạp tiền' : 'Rút tiền',
                loading: _saving,
                onPressed: _links.isEmpty ? _openLinks : _submit,
                icon: _topup ? Icons.south_west : Icons.north_east,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
