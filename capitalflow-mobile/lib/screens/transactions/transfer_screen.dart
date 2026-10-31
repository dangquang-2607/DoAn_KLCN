import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';
import '../accounts/qr_scan_screen.dart';

/// Chuyển tiền từ một ví của bạn tới ví khác — giống bản web.
///
/// Người nhận là email (vào ví mặc định), mã ví `CF-…` (vào ví phụ), nội dung
/// QR CapitalFlow hoặc một ví khác của chính bạn. Hệ thống xác minh người nhận
/// trước, người dùng kiểm tra tên rồi mới xác nhận. Chuyển tiền không tính vào
/// thu nhập/chi tiêu trong sổ thu chi.
class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key, this.fromWalletId, this.initialTarget});

  /// Ví gửi được chọn sẵn (ví dụ khi mở từ màn hình Ví).
  final String? fromWalletId;

  /// Người nhận điền sẵn, ví dụ nội dung QR vừa quét.
  final String? initialTarget;

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _target = TextEditingController();

  String? _fromId;
  Recipient? _recipient;

  /// Nội dung người nhận đã được xác minh — đổi nội dung thì phải xác minh lại.
  String _resolvedTarget = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final wallets = context.read<AppData>().wallets;
    _fromId = widget.fromWalletId ??
        (wallets.isNotEmpty ? wallets.first.id : null);
    _target.text = widget.initialTarget ?? '';
  }

  Future<void> _scanQr() async {
    final value = await pushScreen<String>(context, const QrScanScreen(pickOnly: true));
    if (value == null || !mounted) return;
    setState(() {
      _target.text = value;
      _recipient = null;
    });
  }

  @override
  void dispose() {
    _amount.dispose();
    _target.dispose();
    super.dispose();
  }

  void _resetRecipient() {
    if (_recipient != null) setState(() => _recipient = null);
  }

  Future<void> _chooseSource() async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(
      context,
      wallets: appData.wallets,
      selectedId: _fromId,
      title: 'Chuyển từ ví',
    );
    if (wallet == null || !mounted) return;
    setState(() {
      _fromId = wallet.id;
      _recipient = null;
    });
  }

  Future<void> _chooseOwnWallet() async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(
      context,
      wallets: appData.wallets,
      excludeId: _fromId,
      title: 'Chuyển đến ví của bạn',
    );
    if (wallet == null || !mounted) return;
    setState(() {
      _target.text = wallet.id;
      _recipient = null;
    });
  }

  Future<void> _submit() async {
    final appData = context.read<AppData>();
    final from = appData.walletById(_fromId);
    final amount = parseAmountInput(_amount.text);
    final target = _target.text.trim();
    if (from == null) {
      showSnack('Vui lòng chọn ví gửi.', error: true);
      return;
    }
    if (target.isEmpty) {
      showSnack('Nhập email, mã ví hoặc chọn ví nhận.', error: true);
      return;
    }
    if (amount <= 0) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    if (amount > from.balance) {
      showSnack('Số dư ví không đủ để chuyển.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      // Bước 1: xác minh người nhận để người dùng kiểm tra tên trước khi chuyển.
      final recipient = _recipient;
      if (recipient == null || _resolvedTarget != target) {
        final resolved = await appData.finance.resolveRecipient(target);
        if (!mounted) return;
        if (resolved.walletId == from.id) {
          showSnack('Chọn ví nhận khác ví gửi.', error: true);
          setState(() => _saving = false);
          return;
        }
        setState(() {
          _recipient = resolved;
          _resolvedTarget = target;
          _saving = false;
        });
        return;
      }
      // Bước 2: người dùng đã thấy thông tin người nhận và bấm xác nhận.
      await appData.finance.transferBetweenWallets(
        fromWalletId: from.id,
        toWalletId: recipient.walletId,
        amount: amount,
      );
      await appData.markChanged();
      showSnack('Đã chuyển ${formatMoney(amount)} tới ${recipient.recipientName}.');
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final from = appData.walletById(_fromId);
    final recipient = _recipient;
    final hasOtherWallets = appData.wallets.any((w) => w.id != _fromId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Chuyển tiền'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  PickerField(
                    label: 'Từ ví',
                    value: from == null
                        ? null
                        : '${from.name} · ${formatMoney(from.balance, keepSign: true)}',
                    placeholder: 'Chọn ví',
                    leading: from == null
                        ? null
                        : IconBadge(
                            icon: walletIcon(from.accountType),
                            color: walletColor(from.accountType),
                            size: 36),
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: _chooseSource,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _target,
                    maxLength: 512,
                    keyboardType: TextInputType.emailAddress,
                    onChanged: (_) => _resetRecipient(),
                    decoration: fieldDecoration(
                      'Email, mã ví hoặc nội dung QR người nhận',
                      icon: Icons.person_search_outlined,
                      hint: 'Email hoặc CF-7K9M2P4R',
                      helper:
                          'Email nhận vào ví mặc định; mã CF- nhận vào ví phụ tương ứng.',
                      suffix: IconButton(
                        tooltip: 'Quét mã QR',
                        onPressed: _scanQr,
                        icon: const Icon(Icons.qr_code_scanner_rounded, color: AppColors.blue),
                      ),
                    ),
                  ),
                  if (hasOtherWallets)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: _chooseOwnWallet,
                        icon: const Icon(Icons.swap_horiz, size: 18),
                        label: const Text('Hoặc chọn một ví khác của bạn'),
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [ThousandsInputFormatter()],
                    onChanged: (_) => _resetRecipient(),
                    style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                    decoration: fieldDecoration(
                      'Số tiền chuyển (₫)',
                      icon: Icons.payments_outlined,
                      helper: from == null
                          ? null
                          : 'Số dư khả dụng: ${formatMoney(from.balance)}',
                    ),
                  ),
                  if (recipient != null) ...[
                    const SizedBox(height: 14),
                    InfoBanner(
                      icon: Icons.verified_user_outlined,
                      message: 'Người nhận: ${recipient.recipientName}\n'
                          'Ví: ${recipient.walletName}${recipient.isOwn ? ' (ví của bạn)' : ''}\n'
                          'Số tiền: ${formatMoney(parseAmountInput(_amount.text))}. Kiểm tra trước khi xác nhận.',
                    ),
                  ],
                  const SizedBox(height: 14),
                  const Text(
                    'Chuyển tiền chỉ thay đổi số dư ví, không tính vào thu nhập/chi tiêu.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: recipient == null ? 'Kiểm tra người nhận' : 'Xác nhận chuyển tiền',
                loading: _saving,
                onPressed: _submit,
                icon: recipient == null ? Icons.person_search : Icons.swap_horiz,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
