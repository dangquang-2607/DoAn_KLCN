import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/kieu_danh_muc.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import 'lien_ket_ngan_hang.dart';

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
  static const _presets = [50000, 100000, 200000, 500000];
  static const _topupLimit = 50000000;
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
    _walletId =
        widget.walletId ?? (wallets.isNotEmpty ? wallets.first.id : null);
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
    final wallet = await pickWallet(context,
        wallets: appData.wallets, selectedId: _walletId);
    if (wallet != null && mounted) setState(() => _walletId = wallet.id);
  }

  Future<void> _chooseBank() async {
    final picked = await pickOption<String>(
      context,
      title: 'Ngân hàng liên kết',
      options: [
        for (final link in _links)
          MapEntry(link.id, '${link.provider} · ${link.maskedNumber}')
      ],
      selected: _linkId,
    );
    if (picked != null && mounted) setState(() => _linkId = picked);
  }

  Future<void> _openLinks() async {
    await pushScreen<bool>(context, const BankLinksScreen());
    if (mounted) await _loadLinks();
  }

  void _fillAmount(String text) {
    _amount.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  Widget _amountChoices(Wallet? wallet) {
    final balance = _topup ? null : (wallet?.balanceDecimal ?? '0');
    final available = balance == null ? null : moneyCents(balance);
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: _amount,
      builder: (context, value, _) {
        final current = editMoney(moneyInput(value.text));
        return Wrap(
          spacing: Space.xs,
          runSpacing: Space.xs,
          children: [
            for (final preset in _presets)
              ChoiceChip(
                label: Text(formatMoney(preset)),
                showCheckmark: false,
                selected: current == editMoney(preset),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                onSelected: !_saving &&
                        (available == null ||
                            BigInt.from(preset * 100) <= available)
                    ? (_) => _fillAmount(editMoney(preset))
                    : null,
              ),
            if (available != null && available > BigInt.zero)
              ActionChip(
                label: const Text('Tất cả số dư'),
                backgroundColor: AppColors.soft,
                labelStyle: const TextStyle(color: AppColors.blue),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                onPressed:
                    _saving ? null : () => _fillAmount(editMoney(balance)),
              ),
          ],
        );
      },
    );
  }

  Future<void> _submit() async {
    final appData = context.read<AppData>();
    final wallet = appData.walletById(_walletId);
    final amount = moneyInput(_amount.text);
    final linkId = _linkId;
    final topup = _topup;
    if (wallet == null) {
      showSnack('Vui lòng chọn ví.', error: true);
      return;
    }
    if (linkId == null) {
      showSnack('Cần liên kết ngân hàng còn hiệu lực.', error: true);
      return;
    }
    final cents = moneyCents(amount ?? '0');
    if (amount == null || cents <= BigInt.zero) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    if (topup && cents > BigInt.from(_topupLimit * 100)) {
      showSnack('Mỗi lần nạp tối đa ${formatMoney(_topupLimit)}.', error: true);
      return;
    }
    if (!topup && cents > moneyCents(wallet.balanceDecimal)) {
      showSnack('Số dư ví không đủ để rút.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.bankMoney(
          walletId: wallet.id, topup: topup, linkId: linkId, amount: amount);
      await appData.markChanged();
      final formatted = '${editMoney(amount)} ₫';
      showSnack(topup
          ? 'Đã nạp $formatted vào "${wallet.name}".'
          : 'Đã rút $formatted từ "${wallet.name}".');
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
    final hintStyle = Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.muted,
        );
    BankLink? link;
    for (final item in _links) {
      if (item.id == _linkId) link = item;
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar:
          appBar(context, _topup ? 'Nạp tiền vào ví' : 'Rút tiền về ngân hàng'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  SegmentedChoice<bool>(
                    options: const [
                      MapEntry(true, 'Nạp tiền'),
                      MapEntry(false, 'Rút tiền')
                    ],
                    value: _topup,
                    onChanged: (value) => setState(() => _topup = value),
                    colorOf: (value) =>
                        value ? AppColors.success : AppColors.blue,
                  ),
                  const SizedBox(height: 14),
                  PickerField(
                    label: _topup ? 'Nạp vào ví' : 'Rút từ ví',
                    value: wallet == null
                        ? null
                        : '${wallet.name} · ${formatMoney(wallet.balance)}',
                    placeholder: 'Chọn ví',
                    leading: wallet == null
                        ? null
                        : IconBadge(
                            icon: walletIcon(wallet.accountType),
                            color: walletColor(wallet.accountType),
                            size: 36),
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
                      message:
                          'Bạn chưa liên kết ngân hàng nào. Liên kết một lần để nạp/rút cho tất cả ví.',
                      color: AppColors.warning,
                      icon: Icons.account_balance_outlined,
                    )
                  else
                    PickerField(
                      label: _topup ? 'Từ ngân hàng' : 'Về ngân hàng',
                      value: link == null
                          ? null
                          : '${link.provider} · ${link.maskedNumber}',
                      placeholder: 'Chọn ngân hàng',
                      icon: Icons.account_balance_outlined,
                      onTap: _chooseBank,
                    ),
                  if (_links.isNotEmpty) ...[
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: _openLinks,
                        icon: const Icon(Icons.link, size: 18),
                        label: const Text('Quản lý ngân hàng liên kết'),
                      ),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _amount,
                      enabled: !_saving,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [ThousandsInputFormatter()],
                      style: moneyStyle.copyWith(
                          fontSize: 20, color: AppColors.ink),
                      decoration: fieldDecoration(
                        _topup ? 'Số tiền nạp (₫)' : 'Số tiền rút (₫)',
                        icon: Icons.payments_outlined,
                        helper: !_topup && wallet != null
                            ? 'Số dư khả dụng: ${editMoney(wallet.balanceDecimal)} ₫'
                            : null,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _amountChoices(wallet),
                    const SizedBox(height: Space.xs),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.check,
                            size: 16, color: AppColors.muted),
                        const SizedBox(width: Space.xxs),
                        Expanded(
                          child: Text(
                            _topup
                                ? 'Miễn phí nạp tiền · Tối đa ${formatMoney(_topupLimit)}/lần'
                                : 'Tiền được ghi nhận vào tài khoản ngân hàng sau khi rút thành công.',
                            style: hintStyle,
                          ),
                        ),
                      ],
                    ),
                  ],
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
                label: _links.isEmpty
                    ? 'Liên kết ngân hàng'
                    : (_topup ? 'Nạp tiền' : 'Rút tiền'),
                loading: _saving || _loadingLinks,
                onPressed: _links.isEmpty ? _openLinks : _submit,
                icon: _links.isEmpty
                    ? Icons.add_link
                    : (_topup ? Icons.south_west : Icons.north_east),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
