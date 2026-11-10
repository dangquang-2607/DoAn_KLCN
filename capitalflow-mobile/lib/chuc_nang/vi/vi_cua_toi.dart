import '../goi_dich_vu/goi_dich_vu.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/kieu_danh_muc.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'nhan_tien.dart';
import 'lich_su_vi.dart';

/// Ví của tôi — đồng bộ với trang Ví của bản web.
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
      _afterChange(
          pushScreen<bool>(context, WalletHistoryScreen(wallet: wallet)));
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
            onTap: () => go(() => _afterChange(pushScreen<bool>(
                context, WalletHistoryScreen(wallet: wallet)))),
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
              leading:
                  const Icon(Icons.delete_outline, color: AppColors.danger),
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
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, Space.xl),
          children: [
            SegmentedChoice<bool>(
              options: const [
                MapEntry(false, 'Ví đang dùng'),
                MapEntry(true, 'Ví đã đóng')
              ],
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
                          color: wallet.isActive
                              ? walletColor(wallet.accountType)
                              : AppColors.subtle,
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
                              style: const TextStyle(
                                  fontSize: 15.5, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              [
                                wallet.isDefault
                                    ? 'Ví mặc định'
                                    : wallet.isActive
                                        ? 'Ví của tôi'
                                        : 'Đã đóng',
                                if ((wallet.receiveCode ?? '').isNotEmpty)
                                  wallet.receiveCode!,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12.5, color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatMoney(wallet.balance, keepSign: true),
                        style: moneyStyle.copyWith(
                            fontSize: 15.5, color: AppColors.ink),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: AppColors.subtle),
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
      appBar: appBar(
        context,
        'Ví của tôi',
        addAction: _showClosed
            ? null
            : PillAddButton(label: 'Thêm ví', onPressed: _openNameForm),
      ),
      body: body,
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
      if (mounted && !await showQuotaLimit(context, error)) {
        showSnack(errorText(error), error: true);
      }
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
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
              decoration: fieldDecoration('Tên ví',
                  icon: Icons.badge_outlined,
                  hint: 'Ví dụ: Ví chi tiêu, Quỹ du lịch'),
            ),
            if (!editing) ...[
              const SizedBox(height: 8),
              const Text(
                'Ví bắt đầu với 0đ. Nạp tiền từ ngân hàng liên kết hoặc nhận tiền từ ví khác để sử dụng.',
                style: TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 14),
            PrimaryButton(
                label: editing ? 'Lưu tên ví' : 'Tạo ví',
                loading: _saving,
                onPressed: _save),
          ],
        ),
      ),
    );
  }
}
