import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

/// Lịch sử tiền vào/ra của một ví (kể cả ví đã đóng) — giống bản web.
///
/// Với khoản thanh toán hóa đơn, người dùng bật/tắt "Tính vào chi tiêu" và sửa
/// phần chi tiêu cá nhân (số tiền ghi nhận, danh mục). Việc này không hoàn tiền
/// và không xóa lịch sử thanh toán.
class WalletHistoryScreen extends StatefulWidget {
  const WalletHistoryScreen({super.key, required this.wallet});

  final Wallet wallet;

  @override
  State<WalletHistoryScreen> createState() => _WalletHistoryScreenState();
}

class _WalletHistoryScreenState extends State<WalletHistoryScreen> {
  static const int _pageSize = 20;

  final List<WalletEntry> _items = <WalletEntry>[];
  int _total = 0;
  int _page = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  bool _changed = false;
  String? _busyEntry;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    final appData = context.read<AppData>();
    try {
      final result = await appData.finance.walletHistory(widget.wallet.id, page: 1, pageSize: _pageSize);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _total = result.total;
        _page = 1;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _items.length >= _total) return;
    setState(() => _loadingMore = true);
    try {
      final result = await context
          .read<AppData>()
          .finance
          .walletHistory(widget.wallet.id, page: _page + 1, pageSize: _pageSize);
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _total = result.total;
        _page += 1;
      });
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _toggleSpending(WalletEntry entry, bool included) async {
    final id = entry.bookkeepingId;
    if (id == null) return;
    final appData = context.read<AppData>();
    setState(() => _busyEntry = entry.id);
    try {
      await appData.finance.updatePaymentRecord(id, includeInReports: included);
      _changed = true;
      await appData.markChanged();
      await _reload();
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busyEntry = null);
    }
  }

  Future<void> _manageSpending(WalletEntry entry) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => _SpendingForm(entry: entry),
    );
    if (saved == true) {
      _changed = true;
      await _reload();
    }
  }

  Widget _entryCard(WalletEntry entry) {
    final incoming = entry.isIncoming;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                IconBadge(
                  icon: switch (entry.kind) {
                    'TOPUP' => Icons.south_west_rounded,
                    'WITHDRAW' => Icons.north_east_rounded,
                    'TRANSFER_IN' => Icons.call_received_rounded,
                    'TRANSFER_OUT' => Icons.call_made_rounded,
                    _ => Icons.receipt_long,
                  },
                  color: incoming ? AppColors.success : AppColors.blue,
                  size: 40,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.label, style: AppText.cardTitle),
                      const SizedBox(height: 2),
                      Text(
                        '${formatDateTime(entry.createdAt)} · Số dư sau: ${formatMoney(entry.balanceAfter)}',
                        style: AppText.caption,
                      ),
                    ],
                  ),
                ),
                Text(
                  '${incoming ? '+' : '-'}${formatMoney(entry.amount.abs())}',
                  style: moneyStyle.copyWith(
                      fontSize: 15, color: incoming ? AppColors.success : AppColors.ink),
                ),
              ],
            ),
            if (entry.isPayment) ...[
              const Divider(height: 20),
              Text(
                '${entry.merchantName ?? ''} · ${entry.billReference ?? ''}',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                'Danh mục: ${entry.categoryName ?? 'Chưa phân loại'} · Ghi nhận cá nhân: ${formatMoney(entry.recordedAmount ?? 0)}',
                style: AppText.caption,
              ),
              if (entry.bookkeepingId != null)
                Row(
                  children: [
                    Expanded(
                      child: SwitchListTile(
                        value: entry.includeInReports ?? false,
                        onChanged: _busyEntry == entry.id || !widget.wallet.isActive
                            ? null
                            : (value) => _toggleSpending(entry, value),
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: const Text('Tính vào chi tiêu', style: TextStyle(fontSize: 13.5)),
                      ),
                    ),
                    TextButton(
                      onPressed: () => _manageSpending(entry),
                      child: const Text('Quản lý chi tiêu'),
                    ),
                  ],
                ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_error != null && _items.isEmpty) {
      body = ErrorView(message: _error!, onRetry: _reload);
    } else {
      body = RefreshIndicator(
        onRefresh: _reload,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            AppCard(
              child: Row(
                children: [
                  const IconBadge(icon: Icons.account_balance_wallet, color: AppColors.blue),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.wallet.name, style: AppText.cardTitle),
                        Text(
                          widget.wallet.isActive ? 'Số dư hiện tại' : 'Ví đã đóng · chỉ xem lịch sử',
                          style: AppText.caption,
                        ),
                      ],
                    ),
                  ),
                  Text(formatMoney(widget.wallet.balance),
                      style: moneyStyle.copyWith(fontSize: 18, color: AppColors.ink)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_items.isEmpty)
              const EmptyView(
                icon: Icons.history,
                title: 'Chưa có giao dịch tiền trong ví',
                message: 'Nạp tiền từ ngân hàng liên kết hoặc nhận tiền từ ví khác để bắt đầu.',
              ),
            for (final entry in _items) _entryCard(entry),
            if (_items.length < _total)
              Center(
                child: _loadingMore
                    ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())
                    : TextButton(onPressed: _loadMore, child: Text('Xem thêm (${_items.length}/$_total)')),
              ),
          ],
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: appBar('Lịch sử ví'),
        body: body,
      ),
    );
  }
}

/// Sửa phần chi tiêu cá nhân của một khoản thanh toán ví.
class _SpendingForm extends StatefulWidget {
  const _SpendingForm({required this.entry});

  final WalletEntry entry;

  @override
  State<_SpendingForm> createState() => _SpendingFormState();
}

class _SpendingFormState extends State<_SpendingForm> {
  final TextEditingController _amount = TextEditingController();
  late bool _include;
  String? _categoryId;
  bool _saving = false;

  double get _paid => widget.entry.amount.abs();

  @override
  void initState() {
    super.initState();
    _include = widget.entry.includeInReports ?? true;
    _categoryId = widget.entry.categoryId;
    _amount.text = groupThousands((widget.entry.recordedAmount ?? _paid).round().toString());
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final id = widget.entry.bookkeepingId;
    if (id == null) return;
    final amount = parseAmountInput(_amount.text);
    if (amount <= 0 || amount > _paid) {
      showSnack('Số tiền ghi nhận phải lớn hơn 0 và không vượt ${formatMoney(_paid)}.', error: true);
      return;
    }
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.updatePaymentRecord(
        id,
        amount: amount,
        includeInReports: _include,
        categoryId: _categoryId,
        setCategory: true,
      );
      await appData.markChanged();
      showSnack('Đã cập nhật phần chi tiêu cá nhân.');
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final category = appData.categoryById(_categoryId);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ghi nhận chi tiêu cá nhân',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                'Đã thanh toán ${formatMoney(_paid)} cho ${widget.entry.merchantName ?? ''}. '
                'Đây là số tiền cố định trong lịch sử ví.',
                style: const TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              SwitchListTile(
                value: _include,
                onChanged: (value) => setState(() => _include = value),
                contentPadding: EdgeInsets.zero,
                title: const Text('Tính vào chi tiêu'),
                subtitle: const Text(
                  'Tắt chỉ loại khỏi báo cáo và ngân sách. Không hoàn tiền, không xóa lịch sử thanh toán.',
                  style: TextStyle(fontSize: 12.5),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _amount,
                keyboardType: TextInputType.number,
                inputFormatters: [ThousandsInputFormatter()],
                style: moneyStyle.copyWith(fontSize: 18, color: AppColors.ink),
                decoration: fieldDecoration(
                  'Số tiền ghi nhận cá nhân (₫)',
                  icon: Icons.payments_outlined,
                  helper: 'Không vượt quá ${formatMoney(_paid)}.',
                ),
              ),
              const SizedBox(height: 10),
              PickerField(
                label: 'Danh mục chi tiêu',
                value: category?.name,
                placeholder: 'Chưa phân loại',
                icon: Icons.sell_outlined,
                leading: category == null
                    ? null
                    : CategoryAvatar(icon: category.icon, color: category.color, name: category.name, size: 36),
                onTap: () async {
                  final choice = await pickCategory(
                    context,
                    categories: appData.categoriesOf('EXPENSE'),
                    selectedId: _categoryId,
                  );
                  if (choice != null && mounted) setState(() => _categoryId = choice.category?.id);
                },
                onClear: () => setState(() => _categoryId = null),
              ),
              const SizedBox(height: 14),
              PrimaryButton(label: 'Lưu', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
