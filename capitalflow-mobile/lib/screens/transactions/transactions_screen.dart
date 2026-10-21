import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';
import '../../widgets/txn_tile.dart';
import 'transaction_form_screen.dart';
import 'transfer_screen.dart';

/// Lịch sử giao dịch: nhóm theo ngày, tải thêm khi cuộn, lọc theo loại/ví/danh mục/khoảng ngày.
class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> with AutoRefresh<TransactionsScreen> {
  static const int _pageSize = 30;

  final ScrollController _scroll = ScrollController();
  final TextEditingController _search = TextEditingController();

  final List<Txn> _items = <Txn>[];
  int _total = 0;
  int _page = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _request = 0;

  String? _type;
  String? _walletId;
  String? _categoryId;
  DateTime? _from;
  DateTime? _to;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  bool get _hasMore => _items.length < _total;

  int get _activeFilters {
    var count = 0;
    if (_walletId != null) count++;
    if (_categoryId != null) count++;
    if (_from != null || _to != null) count++;
    return count;
  }

  void _onScroll() {
    if (!_scroll.hasClients || _loadingMore || _loading || !_hasMore) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 320) _loadMore();
  }

  Future<TxnPage> _fetch(int page) {
    return context.read<AppData>().finance.transactions(
          page: page,
          pageSize: _pageSize,
          type: _type,
          accountId: _walletId,
          categoryId: _categoryId,
          startDate: _from,
          endDate: _to,
        );
  }

  @override
  Future<void> reload() async {
    final request = ++_request;
    if (_items.isEmpty) setState(() => _loading = true);
    try {
      final result = await _fetch(1);
      if (!mounted || request != _request) return;
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
      if (!mounted || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    final request = _request;
    setState(() => _loadingMore = true);
    try {
      final result = await _fetch(_page + 1);
      if (!mounted || request != _request) return;
      setState(() {
        _items.addAll(result.items);
        _total = result.total;
        _page += 1;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _applyFilters(void Function() change) {
    setState(() {
      change();
      _items.clear();
      _total = 0;
      _loading = true;
    });
    reload();
  }

  Future<void> _openFilters() async {
    final appData = context.read<AppData>();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            void update(void Function() change) {
              _applyFilters(change);
              setSheetState(() {});
            }

            final wallet = appData.walletById(_walletId);
            final category = appData.categoryById(_categoryId);
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Bộ lọc giao dịch', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 14),
                    PickerField(
                      label: 'Ví',
                      value: wallet?.name,
                      placeholder: 'Tất cả ví',
                      icon: Icons.account_balance_wallet_outlined,
                      onTap: () async {
                        final picked = await pickWallet(sheetContext, wallets: appData.wallets, selectedId: _walletId);
                        if (picked != null) update(() => _walletId = picked.id);
                      },
                      onClear: () => update(() => _walletId = null),
                    ),
                    const SizedBox(height: 10),
                    PickerField(
                      label: 'Danh mục',
                      value: category?.name,
                      placeholder: 'Tất cả danh mục',
                      icon: Icons.sell_outlined,
                      onTap: () async {
                        final categories = _type == null ? appData.categories : appData.categoriesOf(_type!);
                        final choice = await pickCategory(
                          sheetContext,
                          categories: categories,
                          selectedId: _categoryId,
                          allowNone: false,
                        );
                        if (choice != null) update(() => _categoryId = choice.category?.id);
                      },
                      onClear: () => update(() => _categoryId = null),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: PickerField(
                            label: 'Từ ngày',
                            value: _from == null ? null : formatDate(_from),
                            placeholder: 'Bất kỳ',
                            onTap: () async {
                              final picked = await pickDate(sheetContext, initial: _from ?? DateTime.now(), last: _to);
                              if (picked != null) update(() => _from = picked);
                            },
                            onClear: () => update(() => _from = null),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: PickerField(
                            label: 'Đến ngày',
                            value: _to == null ? null : formatDate(_to),
                            placeholder: 'Bất kỳ',
                            onTap: () async {
                              final picked = await pickDate(sheetContext, initial: _to ?? DateTime.now(), first: _from);
                              if (picked != null) update(() => _to = picked);
                            },
                            onClear: () => update(() => _to = null),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => update(() {
                              _walletId = null;
                              _categoryId = null;
                              _from = null;
                              _to = null;
                            }),
                            child: const Text('Xóa bộ lọc'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: () => Navigator.of(sheetContext).pop(),
                            child: const Text('Xong'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _open(Txn txn) async {
    if (txn.editable) {
      await pushScreen<bool>(context, TransactionFormScreen(existing: txn));
      return;
    }
    final appData = context.read<AppData>();
    await showPickerSheet<void>(
      context,
      title: txn.title,
      children: (sheetContext) => [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                formatSigned(txn.absAmount, income: txn.isIncome),
                style: moneyStyle.copyWith(fontSize: 24, color: txn.isIncome ? AppColors.success : AppColors.ink),
              ),
              const SizedBox(height: 8),
              Text(
                'Ví: ${appData.walletById(txn.accountId)?.name ?? '—'} · Ngày ${formatDate(txn.date)}',
                style: const TextStyle(fontSize: 14, color: AppColors.muted),
              ),
              if ((txn.note ?? '').isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(txn.note!, style: const TextStyle(fontSize: 14, color: AppColors.muted)),
              ],
              const SizedBox(height: 14),
              InfoBanner(
                message: txn.kind == 'TRANSFER'
                    ? 'Đây là một vế của lệnh chuyển tiền giữa hai ví nên không thể sửa hoặc xóa riêng.'
                    : 'Giao dịch điều chỉnh số dư do hệ thống ghi nhận nên không thể sửa hoặc xóa.',
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Dựng danh sách hiển thị: xen tiêu đề ngày giữa các giao dịch.
  List<Object> _rows() {
    final query = _query.trim().toLowerCase();
    final visible = query.isEmpty
        ? _items
        : _items.where((txn) {
            return txn.title.toLowerCase().contains(query) || (txn.note ?? '').toLowerCase().contains(query);
          }).toList();
    final rows = <Object>[];
    DateTime? currentDay;
    for (final txn in visible) {
      final day = DateTime(txn.date.year, txn.date.month, txn.date.day);
      if (currentDay == null || day != currentDay) {
        currentDay = day;
        rows.add(day);
      }
      rows.add(txn);
    }
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final rows = _rows();

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Giao dịch',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.5),
                  ),
                ),
                IconButton(
                  onPressed: () => pushScreen<bool>(context, const TransferScreen()),
                  icon: const Icon(Icons.swap_horiz, color: AppColors.ink),
                  tooltip: 'Chuyển tiền giữa ví',
                ),
                IconButton(
                  onPressed: _openFilters,
                  tooltip: 'Bộ lọc',
                  icon: Badge(
                    isLabelVisible: _activeFilters > 0,
                    label: Text('$_activeFilters'),
                    backgroundColor: AppColors.blue,
                    child: const Icon(Icons.filter_list, color: AppColors.ink),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onChanged: (value) => setState(() => _query = value),
              decoration: fieldDecoration(
                'Tìm theo diễn giải',
                icon: Icons.search,
                suffix: _query.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _search.clear();
                          setState(() => _query = '');
                        },
                        icon: const Icon(Icons.close, size: 18, color: AppColors.muted),
                      ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SegmentedChoice<String>(
              options: const [MapEntry('ALL', 'Tất cả'), MapEntry('EXPENSE', 'Khoản chi'), MapEntry('INCOME', 'Khoản thu')],
              value: _type ?? 'ALL',
              onChanged: (value) => _applyFilters(() {
                _type = value == 'ALL' ? null : value;
                _categoryId = null;
              }),
              colorOf: (value) => value == 'INCOME'
                  ? AppColors.success
                  : value == 'EXPENSE'
                      ? AppColors.danger
                      : AppColors.blue,
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: reload,
              color: AppColors.blue,
              child: _buildList(appData, rows),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(AppData appData, List<Object> rows) {
    if (_loading && _items.isEmpty) {
      return ListView(children: const [SizedBox(height: 120), LoadingView()]);
    }
    if (_error != null && _items.isEmpty) {
      return ListView(children: [const SizedBox(height: 60), ErrorView(message: _error!, onRetry: reload)]);
    }
    if (rows.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 40),
          EmptyView(
            icon: Icons.receipt_long,
            title: _query.isNotEmpty || _activeFilters > 0 || _type != null
                ? 'Không có giao dịch phù hợp'
                : 'Chưa có giao dịch nào',
            message: _query.isNotEmpty || _activeFilters > 0 || _type != null
                ? 'Hãy thử đổi từ khóa hoặc bộ lọc.'
                : 'Nhấn nút + để ghi khoản thu chi đầu tiên.',
          ),
        ],
      );
    }
    return ListView.builder(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: rows.length + 1,
      itemBuilder: (context, index) {
        if (index == rows.length) {
          if (_loadingMore) return const LoadingView();
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Center(
              child: Text(
                _hasMore ? 'Cuộn để tải thêm' : 'Đã hiển thị ${_items.length} / $_total giao dịch',
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ),
          );
        }
        final row = rows[index];
        if (row is DateTime) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
            child: Text(
              dayHeading(row),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.muted),
            ),
          );
        }
        final txn = row as Txn;
        return Container(
          color: AppColors.surface,
          child: TxnTile(
            txn: txn,
            category: appData.categoryById(txn.categoryId),
            wallet: appData.walletById(txn.accountId),
            onTap: () => _open(txn),
          ),
        );
      },
    );
  }
}
