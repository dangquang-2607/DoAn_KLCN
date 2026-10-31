import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../transactions/transfer_screen.dart';
import 'bank_links_screen.dart';
import 'bank_money_screen.dart';
import 'bill_payment_screen.dart';
import 'receive_sheet.dart';
import 'wallet_history_screen.dart';

/// Ví của bạn — đồng bộ với trang Ví của bản web.
///
/// Ví có số dư riêng, chỉ thay đổi khi nạp/rút qua ngân hàng liên kết, chuyển
/// tiền giữa các ví hoặc thanh toán hóa đơn mô phỏng. Ví mới luôn bắt đầu từ 0đ;
/// ví mặc định nhận tiền qua email và không thể đóng.
class AccountsScreen extends StatefulWidget {
  const AccountsScreen({super.key});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  bool _loading = false;
  String? _error;
  bool _showClosed = false;
  List<Wallet> _closed = <Wallet>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    final appData = context.read<AppData>();
    setState(() {
      _loading = !appData.loaded;
      _error = null;
    });
    try {
      await appData.refreshLookups();
      final all = await appData.finance.wallets(includeClosed: true);
      if (!mounted) return;
      setState(() {
        _closed = all.where((wallet) => !wallet.isActive).toList();
        _loading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = errorText(error);
        });
      }
    }
  }

  Future<void> _afterChange(Future<bool?> action) async {
    final changed = await action;
    if (changed == true) await _refresh();
  }

  Future<void> _openNameForm([Wallet? wallet]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => _WalletNameForm(existing: wallet),
    );
    if (changed == true) await _refresh();
  }

  Future<void> _close(Wallet wallet) async {
    if (wallet.balance != 0) {
      showSnack('Rút hoặc chuyển hết tiền trước khi đóng ví.', error: true);
      return;
    }
    final confirmed = await confirmDialog(
      context,
      title: 'Đóng ví "${wallet.name}"?',
      message:
          'Ví đã đóng không thể khôi phục và không thể nạp, rút, nhận hay chuyển tiền. '
          'Lịch sử vẫn xem được trong mục Ví đã đóng.',
      confirmLabel: 'Đóng ví',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    try {
      await appData.finance.closeWallet(wallet.id);
      await appData.markChanged();
      await _refresh();
      showSnack('Đã đóng ví "${wallet.name}".');
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  Future<void> _showReceive(Wallet wallet) => showReceiveMoney(context, wallet);

  void _showActions(Wallet wallet) {
    if (!wallet.isActive) {
      _afterChange(pushScreen<bool>(context, WalletHistoryScreen(wallet: wallet)));
      return;
    }
    showPickerSheet<void>(
      context,
      title: wallet.name,
      children: (sheetContext) {
        void go(VoidCallback action) {
          Navigator.of(sheetContext).pop();
          action();
        }

        return [
          SheetOption(
            title: 'Lịch sử tiền trong ví',
            leading: const Icon(Icons.history, color: AppColors.ink),
            onTap: () => go(() => _afterChange(
                pushScreen<bool>(context, WalletHistoryScreen(wallet: wallet)))),
          ),
          SheetOption(
            title: 'Nạp / rút tiền',
            leading: const Icon(Icons.swap_vert, color: AppColors.ink),
            onTap: () => go(() => _afterChange(
                pushScreen<bool>(context, BankMoneyScreen(walletId: wallet.id)))),
          ),
          SheetOption(
            title: 'Chuyển tiền',
            leading: const Icon(Icons.swap_horiz, color: AppColors.ink),
            onTap: () => go(() => _afterChange(pushScreen<bool>(
                context, TransferScreen(fromWalletId: wallet.id)))),
          ),
          SheetOption(
            title: 'Thanh toán hóa đơn',
            leading: const Icon(Icons.receipt_long_outlined, color: AppColors.ink),
            onTap: () => go(() => _afterChange(pushScreen<bool>(
                context, BillPaymentScreen(walletId: wallet.id)))),
          ),
          SheetOption(
            title: 'Mã nhận tiền',
            subtitle: wallet.receiveCode,
            leading: const Icon(Icons.qr_code_2, color: AppColors.ink),
            onTap: () => go(() => _showReceive(wallet)),
          ),
          SheetOption(
            title: 'Đổi tên ví',
            leading: const Icon(Icons.edit_outlined, color: AppColors.ink),
            onTap: () => go(() => _openNameForm(wallet)),
          ),
          if (!wallet.isDefault)
            SheetOption(
              title: 'Đóng ví',
              leading: const Icon(Icons.delete_outline, color: AppColors.danger),
              onTap: () => go(() => _close(wallet)),
            ),
        ];
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final active = appData.wallets;
    final wallets = _showClosed ? _closed : active;
    final total = active.fold<double>(0, (sum, wallet) => sum + wallet.balance);

    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_error != null && active.isEmpty) {
      body = ErrorView(message: _error!, onRetry: _refresh);
    } else {
      body = RefreshIndicator(
        onRefresh: _refresh,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          children: [
            AppCard(
              child: Row(
                children: [
                  const IconBadge(icon: Icons.savings, color: AppColors.blue),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Tổng số dư ${active.length} ví đang dùng',
                            style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                        const SizedBox(height: 2),
                        Text(
                          formatMoney(total, keepSign: true),
                          style: moneyStyle.copyWith(fontSize: 22, color: AppColors.ink),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _WalletAction(
                  icon: Icons.swap_vert,
                  label: 'Nạp / Rút',
                  color: AppColors.blue,
                  onTap: () => _afterChange(pushScreen<bool>(
                      context, BankMoneyScreen(walletId: active.isEmpty ? null : active.first.id))),
                ),
                _WalletAction(
                  icon: Icons.swap_horiz,
                  label: 'Chuyển tiền',
                  color: AppColors.success,
                  onTap: () => _afterChange(pushScreen<bool>(context, const TransferScreen())),
                ),
                _WalletAction(
                  icon: Icons.receipt_long_outlined,
                  label: 'Thanh toán',
                  color: AppColors.amber,
                  onTap: () => _afterChange(pushScreen<bool>(context, const BillPaymentScreen())),
                ),
                _WalletAction(
                  icon: Icons.account_balance_outlined,
                  label: 'Ngân hàng',
                  color: AppPalette.violet,
                  onTap: () => _afterChange(pushScreen<bool>(context, const BankLinksScreen())),
                ),
              ],
            ),
            const SizedBox(height: 14),
            SegmentedChoice<bool>(
              options: const [MapEntry(false, 'Ví đang dùng'), MapEntry(true, 'Ví đã đóng')],
              value: _showClosed,
              onChanged: (value) => setState(() => _showClosed = value),
            ),
            const SizedBox(height: 12),
            if (wallets.isEmpty)
              EmptyView(
                icon: Icons.account_balance_wallet_outlined,
                title: _showClosed ? 'Chưa có ví đã đóng' : 'Chưa có ví nào',
                message: _showClosed
                    ? 'Lịch sử của ví đã đóng vẫn được lưu để tra cứu.'
                    : 'Tạo ví bằng tên bạn muốn. Số dư ban đầu luôn là 0đ.',
                actionLabel: _showClosed ? null : 'Tạo ví',
                onAction: _showClosed ? null : _openNameForm,
              ),
            for (final wallet in wallets)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => _showActions(wallet),
                  child: Row(
                    children: [
                      IconBadge(
                          icon: walletIcon(wallet.accountType),
                          color: wallet.isActive ? walletColor(wallet.accountType) : AppColors.subtle,
                          size: 46),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              wallet.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              [
                                wallet.isDefault
                                    ? 'Ví mặc định'
                                    : wallet.isActive
                                        ? 'Ví cá nhân'
                                        : 'Đã đóng',
                                if ((wallet.receiveCode ?? '').isNotEmpty) wallet.receiveCode!,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatMoney(wallet.balance, keepSign: true),
                        style: moneyStyle.copyWith(fontSize: 15.5, color: AppColors.ink),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 4),
            const Text(
              'Số dư ví tách biệt với sổ thu chi. Nạp, rút và chuyển tiền không tính vào thu nhập/chi tiêu.',
              style: TextStyle(fontSize: 12.5, color: AppColors.muted),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Ví của bạn'),
      floatingActionButton: _showClosed
          ? null
          : FloatingActionButton.extended(
              onPressed: _openNameForm,
              icon: const Icon(Icons.add),
              label: const Text('Tạo ví'),
            ),
      body: body,
    );
  }
}

/// Ô thao tác nhanh trên đầu màn hình Ví.
class _WalletAction extends StatelessWidget {
  const _WalletAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: Space.xxs),
          child: Column(
            children: [
              IconBadge(icon: icon, color: color, size: 46),
              const SizedBox(height: Space.xs),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tạo ví mới (chỉ cần tên, số dư ban đầu 0đ) hoặc đổi tên ví.
class _WalletNameForm extends StatefulWidget {
  const _WalletNameForm({this.existing});

  final Wallet? existing;

  @override
  State<_WalletNameForm> createState() => _WalletNameFormState();
}

class _WalletNameFormState extends State<_WalletNameForm> {
  final TextEditingController _name = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name.text = widget.existing?.name ?? '';
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showSnack('Vui lòng nhập tên ví.', error: true);
      return;
    }
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final existing = widget.existing;
      if (existing == null) {
        await appData.finance.createWallet(name);
        showSnack('Đã tạo ví "$name".');
      } else {
        await appData.finance.renameWallet(existing.id, name);
        showSnack('Đã đổi tên ví.');
      }
      await appData.markChanged();
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              editing ? 'Đổi tên ví' : 'Tạo ví mới',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _name,
              autofocus: true,
              maxLength: 150,
              textCapitalization: TextCapitalization.sentences,
              decoration: fieldDecoration('Tên ví', icon: Icons.badge_outlined, hint: 'Ví dụ: Ví chi tiêu, Quỹ du lịch'),
            ),
            if (!editing) ...[
              const SizedBox(height: 8),
              const Text(
                'Ví bắt đầu với 0đ. Nạp tiền từ ngân hàng liên kết hoặc nhận tiền từ ví khác để sử dụng.',
                style: TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 14),
            PrimaryButton(label: editing ? 'Lưu tên ví' : 'Tạo ví', loading: _saving, onPressed: _save),
          ],
        ),
      ),
    );
  }
}
