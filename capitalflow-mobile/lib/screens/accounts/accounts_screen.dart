import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';
import '../transactions/transfer_screen.dart';

/// Quản lý ví, tài khoản ngân hàng, ví điện tử... và số dư của từng ví.
class AccountsScreen extends StatefulWidget {
  const AccountsScreen({super.key});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  bool _loading = false;
  String? _error;

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
      if (mounted) setState(() => _loading = false);
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = errorText(error);
        });
      }
    }
  }

  Future<void> _openForm([Wallet? wallet]) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => _WalletForm(existing: wallet),
    );
  }

  Future<void> _delete(Wallet wallet) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Ngừng sử dụng ví?',
      message: 'Ví "${wallet.name}" sẽ được ẩn khỏi danh sách. Lịch sử giao dịch cũ vẫn được giữ nguyên.',
      confirmLabel: 'Ngừng sử dụng',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    try {
      await appData.finance.deleteWallet(wallet.id);
    } on ApiException catch (error) {
      // 409: ví còn số dư — backend yêu cầu xác nhận lần hai trước khi xóa.
      if (error.statusCode != 409 || !mounted) {
        showSnack(error.message, error: true);
        return;
      }
      final force = await confirmDialog(
        context,
        title: 'Ví vẫn còn số dư',
        message: 'Ví "${wallet.name}" còn ${formatMoney(wallet.balance, keepSign: true)}. '
            'Bạn vẫn muốn ngừng sử dụng ví này?',
        confirmLabel: 'Vẫn ngừng sử dụng',
        danger: true,
      );
      if (!force) return;
      try {
        await appData.finance.deleteWallet(wallet.id, force: true);
      } catch (retryError) {
        showSnack(errorText(retryError), error: true);
        return;
      }
    } catch (error) {
      showSnack(errorText(error), error: true);
      return;
    }
    await appData.markChanged();
    showSnack('Đã ngừng sử dụng ví "${wallet.name}".');
  }

  void _showActions(Wallet wallet) {
    showPickerSheet<void>(
      context,
      title: wallet.name,
      children: (sheetContext) => [
        SheetOption(
          title: 'Chỉnh sửa ví / điều chỉnh số dư',
          leading: const Icon(Icons.edit_outlined, color: AppColors.ink),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _openForm(wallet);
          },
        ),
        SheetOption(
          title: 'Chuyển tiền giữa ví',
          leading: const Icon(Icons.swap_horiz, color: AppColors.ink),
          onTap: () {
            Navigator.of(sheetContext).pop();
            pushScreen<bool>(context, const TransferScreen());
          },
        ),
        SheetOption(
          title: 'Ngừng sử dụng ví',
          leading: const Icon(Icons.delete_outline, color: AppColors.danger),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _delete(wallet);
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final wallets = appData.wallets;
    final total = wallets.fold<double>(0, (sum, wallet) => sum + wallet.balance);

    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_error != null && wallets.isEmpty) {
      body = ErrorView(message: _error!, onRetry: _refresh);
    } else if (wallets.isEmpty) {
      body = EmptyView(
        icon: Icons.account_balance_wallet_outlined,
        title: 'Chưa có ví nào',
        message: 'Tạo ví tiền mặt, tài khoản ngân hàng hoặc ví điện tử để bắt đầu ghi chép thu chi.',
        actionLabel: 'Thêm ví',
        onAction: _openForm,
      );
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
                        Text('Tổng số dư ${wallets.length} ví', style: const TextStyle(fontSize: 13, color: AppColors.muted)),
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
            for (final wallet in wallets)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  onTap: () => _showActions(wallet),
                  child: Row(
                    children: [
                      IconBadge(icon: walletIcon(wallet.accountType), color: walletColor(wallet.accountType), size: 46),
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
                                walletTypeLabel(wallet.accountType),
                                if ((wallet.institutionName ?? '').isNotEmpty) wallet.institutionName!,
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
                        style: moneyStyle.copyWith(
                          fontSize: 15.5,
                          color: wallet.balance < 0 ? AppColors.danger : AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Ví & tài khoản'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openForm,
        icon: const Icon(Icons.add),
        label: const Text('Thêm ví'),
      ),
      body: body,
    );
  }
}

/// Biểu mẫu tạo/sửa ví hiển thị trong bảng trượt.
class _WalletForm extends StatefulWidget {
  const _WalletForm({this.existing});

  final Wallet? existing;

  @override
  State<_WalletForm> createState() => _WalletFormState();
}

class _WalletFormState extends State<_WalletForm> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _institution = TextEditingController();
  final TextEditingController _balance = TextEditingController();

  String _type = 'CASH';
  bool _negative = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _name.text = existing.name;
      _institution.text = existing.institutionName ?? '';
      _type = existing.accountType;
      _negative = existing.balance < 0;
      _balance.text = groupThousands(existing.balance.abs().round().toString());
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _institution.dispose();
    _balance.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showSnack('Vui lòng nhập tên ví.', error: true);
      return;
    }
    final amount = parseAmountInput(_balance.text);
    final balance = _negative ? -amount : amount;
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final existing = widget.existing;
      if (existing == null) {
        await appData.finance.createWallet(
          name: name,
          accountType: _type,
          balance: balance,
          institutionName: _institution.text.trim(),
        );
        showSnack('Đã thêm ví "$name".');
      } else {
        final balanceChanged = balance != existing.balance.round();
        await appData.finance.updateWallet(
          existing.id,
          name: name,
          accountType: _type,
          institutionName: _institution.text.trim(),
          balance: balanceChanged ? balance : null,
        );
        showSnack(balanceChanged ? 'Đã cập nhật ví và ghi nhận điều chỉnh số dư.' : 'Đã cập nhật ví.');
      }
      await appData.markChanged();
      navigator.pop();
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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                editing ? 'Chỉnh sửa ví' : 'Thêm ví mới',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _name,
                maxLength: 150,
                textCapitalization: TextCapitalization.sentences,
                decoration: fieldDecoration('Tên ví', icon: Icons.badge_outlined, hint: 'Ví dụ: Tiền mặt, Vietcombank'),
              ),
              const SizedBox(height: 10),
              PickerField(
                label: 'Loại tài khoản',
                value: walletTypeLabel(_type),
                leading: IconBadge(icon: walletIcon(_type), color: walletColor(_type), size: 36),
                onTap: () async {
                  final picked = await pickOption<String>(
                    context,
                    title: 'Loại tài khoản',
                    options: walletTypeLabels.entries.toList(),
                    selected: _type,
                  );
                  if (picked != null && mounted) setState(() => _type = picked);
                },
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _institution,
                maxLength: 150,
                decoration: fieldDecoration(
                  'Ngân hàng / tổ chức (không bắt buộc)',
                  icon: Icons.account_balance_outlined,
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _balance,
                keyboardType: TextInputType.number,
                inputFormatters: [ThousandsInputFormatter()],
                style: moneyStyle.copyWith(fontSize: 18, color: AppColors.ink),
                decoration: fieldDecoration(
                  editing ? 'Số dư hiện tại (₫)' : 'Số dư ban đầu (₫)',
                  icon: Icons.payments_outlined,
                  helper: editing
                      ? 'Đổi số dư sẽ tạo một giao dịch "Điều chỉnh số dư" để đối soát.'
                      : null,
                ),
              ),
              SwitchListTile(
                value: _negative,
                onChanged: (value) => setState(() => _negative = value),
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('Số dư âm (đang nợ)', style: TextStyle(fontSize: 14)),
              ),
              const SizedBox(height: 8),
              PrimaryButton(label: editing ? 'Lưu thay đổi' : 'Thêm ví', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
