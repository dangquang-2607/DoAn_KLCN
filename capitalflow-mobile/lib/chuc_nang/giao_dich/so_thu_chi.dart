import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../du_lieu/xuat_excel.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import 'dong_giao_dich.dart';
import 'thao_tac.dart';
import 'bieu_mau.dart';

/// Sổ thu chi: nhóm theo ngày, tải thêm khi cuộn, lọc theo loại/nguồn/danh mục/khoảng ngày
/// và tìm theo diễn giải trên máy chủ — giống trang Giao dịch của bản web.

/// Nguồn ghi sổ dùng cho bộ lọc (khớp tham số `origin` của API).
const Map<String, String> _originLabels = {
  'WALLET': 'Thanh toán ví',
  'OCR': 'Hóa đơn AI',
  'MANUAL': 'Nhập tay',
};

enum _SelectionMode { export, delete }

class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key, this.onSelectionModeChanged});

  final ValueChanged<bool>? onSelectionModeChanged;

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen>
    with AutoRefresh<TransactionsScreen> {
  static const int _pageSize = 30;
  static const int _deleteLimit = 100;

  final ScrollController _scroll = ScrollController();
  final TextEditingController _search = TextEditingController();

  final List<Txn> _items = <Txn>[];
  int _total = 0;
  int _page = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _request = 0;
  final Set<String> _selected = {};
  final Map<String, Txn> _selectionRows = {};
  bool _selectingAll = false;
  _SelectionMode? _selectionMode;
  bool get _selecting => _selectionMode != null;
  bool get _selectingForExport => _selectionMode == _SelectionMode.export;
  bool _deleting = false;
  bool _exporting = false;
  bool get _selectionBusy => _deleting || _exporting || _selectingAll;
  bool _refreshAfterSelection = false;

  String? _type;
  String? _origin;
  String? _categoryId;
  List<FinanceCategory>? _filterCategories;
  bool _loadingFilters = false;
  Timer? _searchTimer;
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
    _searchTimer?.cancel();
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  bool get _hasMore => _items.length < _total;

  int get _activeFilters {
    var count = 0;
    if (_origin != null) count++;
    if (_categoryId != null) count++;
    if (_from != null || _to != null) count++;
    return count;
  }

  void _onScroll() {
    if (!_scroll.hasClients || _loadingMore || _loading || !_hasMore) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 320) {
      _loadMore();
    }
  }

  Future<TxnPage> _fetch(int page) {
    return context.read<AppData>().finance.transactions(
          page: page,
          pageSize: _pageSize,
          type: _type,
          origin: _origin,
          categoryId: _categoryId,
          search: _query,
          startDate: _from,
          endDate: _to,
        );
  }

  @override
  Future<void> reload() async {
    if (_selecting) {
      _refreshAfterSelection = true;
      return;
    }
    final request = ++_request;
    setState(() {
      _loadingMore = false;
      if (_items.isEmpty) _loading = true;
    });
    try {
      final result = await _fetch(1);
      if (!mounted || request != _request) return;
      if (_selecting && _items.isNotEmpty) {
        _refreshAfterSelection = true;
        return;
      }
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
      if (mounted && request == _request) setState(() => _loadingMore = false);
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
    if (_loadingFilters) return;
    final appData = context.read<AppData>();
    setState(() => _loadingFilters = true);
    try {
      _filterCategories = await appData.finance.categories(status: 'all');
    } catch (e) {
      if (mounted) showSnack(errorText(e), error: true);
      return;
    } finally {
      if (mounted) setState(() => _loadingFilters = false);
    }
    if (!mounted) return;
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

            final category = _filterCategories
                ?.where((c) => c.id == _categoryId)
                .firstOrNull;
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20,
                    16 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Bộ lọc giao dịch',
                        style: TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 14),
                    PickerField(
                      label: 'Nguồn ghi sổ',
                      value: _originLabels[_origin],
                      placeholder: 'Tất cả nguồn',
                      icon: Icons.source_outlined,
                      onTap: () async {
                        final picked = await pickOption<String>(
                          sheetContext,
                          title: 'Nguồn ghi sổ',
                          options: _originLabels.entries.toList(),
                          selected: _origin,
                        );
                        if (picked != null) update(() => _origin = picked);
                      },
                      onClear: () => update(() => _origin = null),
                    ),
                    const SizedBox(height: 10),
                    PickerField(
                      label: 'Danh mục',
                      value: _categoryId == ReportEntry.uncategorizedId
                          ? 'Không phân loại'
                          : category == null
                              ? null
                              : '${category.name}${category.isActive ? '' : ' (đã ẩn)'}',
                      placeholder: 'Tất cả danh mục',
                      icon: Icons.sell_outlined,
                      onTap: () async {
                        final categories =
                            (_filterCategories ?? appData.categories)
                                .where((c) => _type == null || c.type == _type)
                                .toList();
                        final choice = await pickCategory(
                          sheetContext,
                          categories: categories,
                          selectedId: _categoryId,
                          noneSelected:
                              _categoryId == ReportEntry.uncategorizedId,
                          noneHint: 'Chỉ hiển thị giao dịch chưa gán danh mục',
                        );
                        if (choice != null) {
                          update(() => _categoryId = choice.category?.id ??
                              ReportEntry.uncategorizedId);
                        }
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
                              final picked = await pickDate(sheetContext,
                                  initial: _from ?? DateTime.now(), last: _to);
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
                              final picked = await pickDate(sheetContext,
                                  initial: _to ?? DateTime.now(), first: _from);
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
                              _origin = null;
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

  Future<void> _open(Txn txn) => openTransaction(context, txn);

  bool _canDelete(Txn txn) => txn.editable && !txn.fromWalletPayment;
  bool _canSelect(Txn txn) => _selectingForExport || _canDelete(txn);

  void _startSelection(_SelectionMode mode) {
    FocusScope.of(context).unfocus();
    if (_searchTimer?.isActive == true) {
      _searchTimer!.cancel();
      _applyFilters(() {});
    }
    setState(() => _selectionMode = mode);
    widget.onSelectionModeChanged?.call(true);
  }

  void _endSelection() {
    setState(() {
      _selectionMode = null;
      _selected.clear();
      _selectionRows.clear();
    });
    widget.onSelectionModeChanged?.call(false);
    if (_refreshAfterSelection) {
      _refreshAfterSelection = false;
      unawaited(reload());
    }
  }

  void _toggleSelection(Txn txn) {
    if (_selectionBusy || !_canSelect(txn)) return;
    if (!_selectingForExport &&
        !_selected.contains(txn.id) &&
        _selected.length >= _deleteLimit) {
      showSnack('Chỉ có thể chọn tối đa $_deleteLimit giao dịch.', error: true);
      return;
    }
    setState(() {
      if (_selected.remove(txn.id)) {
        _selectionRows.remove(txn.id);
      } else {
        _selected.add(txn.id);
        _selectionRows[txn.id] = txn;
      }
    });
  }

  Map<String, dynamic> get _exportFilters => {
        'type': _type,
        'origin': _origin,
        'category_id': _categoryId,
        'search': _query,
        'start_date': _from == null ? null : isoDate(_from!),
        'end_date': _to == null ? null : isoDate(_to!),
      };

  Future<void> _selectAllResults() async {
    if (_selectionBusy || !_selectingForExport) return;
    setState(() => _selectingAll = true);
    try {
      final rows = asJsonList(await context
          .read<AppData>()
          .finance
          .api
          .get('/bookkeeping/export-data', query: _exportFilters));
      if (!mounted || !_selectingForExport) return;
      final selected = {
        for (final row in rows) row['id'].toString(): Txn.fromJson(row)
      };
      setState(() {
        _selectionRows
          ..clear()
          ..addAll(selected);
        _selected
          ..clear()
          ..addAll(selected.keys);
      });
    } catch (e) {
      if (mounted) showSnack(errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _selectingAll = false);
    }
  }

  Future<void> _deleteSelected() async {
    if (_deleting || _selected.isEmpty) return;
    final ids = _selected.toList();
    final confirmed = await confirmDialog(
      context,
      title: 'Xóa ${ids.length} giao dịch?',
      message:
          'Thao tác này xóa các khoản đã chọn khỏi sổ thu chi. Hóa đơn liên kết sẽ được mở lại để kiểm tra.',
      confirmLabel: 'Xóa',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final data = context.read<AppData>();
    setState(() => _deleting = true);
    try {
      await data.finance.api.post('/bookkeeping/batch-delete',
          money: true, body: {'transaction_ids': ids});
      if (!mounted) return;
      setState(() {
        _items.removeWhere((txn) => _selected.contains(txn.id));
        _total -= ids.length;
        _deleting = false;
      });
      _refreshAfterSelection = false;
      _endSelection();
      showSnack('Đã xóa ${ids.length} giao dịch.');
      await data.markChanged();
    } catch (e) {
      if (!mounted) return;
      setState(() => _deleting = false);
      showSnack(errorText(e), error: true);
    }
  }

  Future<void> _exportExcel({required bool selectedOnly}) async {
    if (_exporting || (selectedOnly && _selected.isEmpty)) return;
    final data = context.read<AppData>();
    setState(() => _exporting = true);
    try {
      final rows = selectedOnly
          ? {
              for (final txn in _selectionRows.values)
                if (_selected.contains(txn.id)) txn.id: txn.raw,
            }.values.toList()
          : asJsonList(await data.finance.api
              .get('/bookkeeping/export-data', query: _exportFilters));
      if (!mounted) return;
      final categories = {
        for (final category in data.categories) category.id: category.name,
      };
      if (rows.any((row) =>
          row['category_name'] == null &&
          row['category_id'] != null &&
          !categories.containsKey(row['category_id']))) {
        categories.addEntries((await data.finance.categories(status: 'all'))
            .map((category) => MapEntry(category.id, category.name)));
      }
      if (!mounted) return;
      await shareExcel(
        [
          for (final row in rows)
            {
              ...row,
              'category_name':
                  row['category_name'] ?? categories[row['category_id']],
            },
        ],
        name: selectedOnly
            ? 'capitalflow-giao-dich-da-chon'
            : 'capitalflow-so-thu-chi',
        title: 'CapitalFlow · Sổ thu chi',
        scope: selectedOnly
            ? 'Giao dịch đã chọn'
            : 'Toàn bộ giao dịch theo bộ lọc hiện tại',
      );
    } catch (e) {
      if (mounted) showSnack(errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  /// Lọc ngay trên dữ liệu đã tải, rồi hỏi lại máy chủ sau khi người dùng ngừng gõ
  /// để tìm cả các trang chưa tải.
  void _onSearch(String value) {
    setState(() => _query = value);
    _searchTimer?.cancel();
    _searchTimer = Timer(const Duration(milliseconds: 400), () {
      if (mounted) _applyFilters(() {});
    });
  }

  /// Dựng danh sách hiển thị: xen tiêu đề ngày giữa các giao dịch.
  List<Object> _rows() {
    final query = _query.trim().toLowerCase();
    final visible = query.isEmpty
        ? _items
        : _items.where((txn) {
            return txn.title.toLowerCase().contains(query) ||
                (txn.note ?? '').toLowerCase().contains(query);
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

    return PopScope(
      canPop: !_selecting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selecting && !_selectionBusy) _endSelection();
      },
      child: SafeArea(
        bottom: _selecting,
        child: Column(
          children: [
            if (_selecting)
              _selectionHeader()
            else ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(
                  children: [
                    const Expanded(
                      flex: 2,
                      child: Text(
                        'Giao dịch',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5),
                      ),
                    ),
                    IconButton(
                      onPressed: () => _startSelection(_SelectionMode.export),
                      tooltip: 'Xuất Excel',
                      icon: const Icon(Icons.save_alt_rounded),
                    ),
                    Flexible(
                      flex: 3,
                      child: Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: PillAddButton(
                          onPressed: () => pushScreen<bool>(
                              context, const TransactionFormScreen()),
                          label: 'Thêm giao dịch',
                          tooltip: 'Thêm giao dịch thủ công',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 8, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        onChanged: _onSearch,
                        decoration: fieldDecoration(
                          'Tìm theo diễn giải',
                          icon: Icons.search,
                          suffix: _query.isEmpty
                              ? null
                              : IconButton(
                                  onPressed: () {
                                    _search.clear();
                                    _onSearch('');
                                  },
                                  icon: const Icon(Icons.close,
                                      size: 18, color: AppColors.muted),
                                ),
                        ),
                      ),
                    ),
                    PopupMenuButton<String>(
                      enabled: !_exporting,
                      onSelected: (_) => _startSelection(_SelectionMode.delete),
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                            value: 'delete', child: Text('Xóa nhiều khoản')),
                      ],
                    ),
                    IconButton(
                      onPressed: _loadingFilters ? null : _openFilters,
                      tooltip: 'Bộ lọc',
                      icon: Badge(
                        isLabelVisible: _activeFilters > 0,
                        label: Text('$_activeFilters'),
                        backgroundColor: AppColors.blue,
                        child:
                            const Icon(Icons.filter_list, color: AppColors.ink),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SegmentedChoice<String>(
                  options: const [
                    MapEntry('ALL', 'Tất cả'),
                    MapEntry('EXPENSE', 'Khoản chi'),
                    MapEntry('INCOME', 'Khoản thu')
                  ],
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
            ],
            Expanded(
              child: RefreshIndicator(
                onRefresh: reload,
                notificationPredicate: (notification) =>
                    !_selecting &&
                    defaultScrollNotificationPredicate(notification),
                color: AppColors.blue,
                child: _buildList(appData, rows),
              ),
            ),
            if (_selecting)
              _selectingForExport ? _exportFooter() : _selectionFooter(),
          ],
        ),
      ),
    );
  }

  Widget _selectionHeader() => Material(
        color: AppColors.surface,
        child: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: Space.xs, vertical: Space.xs),
          child: Row(children: [
            Expanded(
                child: TextButton(
              onPressed: _selectionBusy ? null : _endSelection,
              child: const Text('Hủy'),
            )),
            Expanded(
                flex: 2,
                child: Semantics(
                  liveRegion: true,
                  child: Text('Đã chọn ${_selected.length}',
                      textAlign: TextAlign.center, style: AppText.section),
                )),
            Expanded(
                child: _selectingForExport
                    ? PopupMenuButton<String>(
                        tooltip: 'Lựa chọn giao dịch',
                        enabled: !_selectionBusy,
                        onSelected: (value) {
                          if (value == 'all') {
                            _selectAllResults();
                          } else {
                            setState(() {
                              _selected.clear();
                              _selectionRows.clear();
                            });
                          }
                        },
                        itemBuilder: (_) => [
                          const PopupMenuItem(
                              value: 'all', child: Text('Chọn tất cả kết quả')),
                          if (_selected.isNotEmpty)
                            const PopupMenuItem(
                                value: 'clear', child: Text('Bỏ chọn tất cả')),
                        ],
                        child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Flexible(
                                      child: Text(
                                          _selectingAll ? 'Đang chọn…' : 'Chọn',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis)),
                                  if (!_selectingAll)
                                    const Icon(Icons.arrow_drop_down_rounded,
                                        size: 18),
                                ])),
                      )
                    : TextButton(
                        style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: Space.xxs)),
                        onPressed: _selectionBusy || _selected.isEmpty
                            ? null
                            : () => setState(() {
                                  _selected.clear();
                                  _selectionRows.clear();
                                }),
                        child:
                            const Text('Bỏ chọn', textAlign: TextAlign.center),
                      )),
          ]),
        ),
      );

  Widget _exportFooter() => Material(
        color: AppColors.surface,
        child: Column(children: [
          const Divider(height: 1, color: AppColors.line),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                Space.md, Space.xs, Space.md, Space.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton(
                  onPressed: _selectionBusy || _selected.isEmpty
                      ? null
                      : () => _exportExcel(selectedOnly: true),
                  child: Text(_exporting
                      ? 'Đang xuất Excel…'
                      : 'Xuất đã chọn (${_selected.length})'),
                ),
                TextButton(
                  onPressed: _selectionBusy || _loading || _total == 0
                      ? null
                      : () => _exportExcel(selectedOnly: false),
                  child: const Text('Xuất tất cả theo bộ lọc'),
                ),
              ],
            ),
          ),
        ]),
      );

  Widget _selectionFooter() => Material(
        color: AppColors.surface,
        child: Column(children: [
          const Divider(height: 1, color: AppColors.line),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                Space.md, Space.xs, Space.md, Space.sm),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed:
                    _selected.isEmpty || _deleting ? null : _deleteSelected,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.danger,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 52),
                  shape: const StadiumBorder(),
                ),
                child:
                    Text(_deleting ? 'Đang xóa…' : 'Xóa (${_selected.length})'),
              ),
            ),
          ),
        ]),
      );

  Widget _buildList(AppData appData, List<Object> rows) {
    if (_loading && _items.isEmpty) {
      return ListView(children: const [SizedBox(height: 120), LoadingView()]);
    }
    if (_error != null && _items.isEmpty) {
      return ListView(children: [
        const SizedBox(height: 60),
        ErrorView(message: _error!, onRetry: reload)
      ]);
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
                : 'Nhấn nút + để ghi khoản thu chi đầu tiên. Ghi sổ không làm thay đổi số dư ví.',
          ),
        ],
      );
    }
    return ListView.builder(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: _selecting
          ? const EdgeInsets.symmetric(horizontal: Space.md)
          : const EdgeInsets.only(bottom: 96),
      itemCount: rows.length + 1,
      itemBuilder: (context, index) {
        if (index == rows.length) {
          if (_loadingMore) return const LoadingView();
          if (_selecting && !_hasMore) return const SizedBox(height: Space.md);
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Center(
              child: Text(
                _hasMore
                    ? 'Cuộn để tải thêm'
                    : 'Đã hiển thị ${_items.length} / $_total giao dịch',
                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
              ),
            ),
          );
        }
        final row = rows[index];
        if (row is DateTime) {
          if (_selecting) {
            final heading = dayHeading(row);
            final date = formatDate(row);
            return Padding(
              padding: const EdgeInsets.only(top: Space.md),
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(Radii.md)),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      Space.md, Space.md, Space.md, Space.xs),
                  child: Text(
                      heading.contains(date) ? heading : '$heading · $date',
                      style: AppText.cardTitle),
                ),
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
            child: Text(
              dayHeading(row),
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.muted),
            ),
          );
        }
        final txn = row as Txn;
        final endOfDay =
            index == rows.length - 1 || rows[index + 1] is DateTime;
        return Material(
          color: AppColors.surface,
          borderRadius: _selecting && endOfDay
              ? const BorderRadius.vertical(bottom: Radius.circular(Radii.md))
              : null,
          clipBehavior: _selecting && endOfDay ? Clip.antiAlias : Clip.none,
          child: TxnTile(
            txn: txn,
            category: appData.categoryById(txn.categoryId) ??
                _filterCategories
                    ?.where((c) => c.id == txn.categoryId)
                    .firstOrNull,
            showSelection: _selecting,
            selected: _selecting && _canSelect(txn)
                ? _selected.contains(txn.id)
                : null,
            onTap: _selecting
                ? (_canSelect(txn) && !_selectionBusy
                    ? () => _toggleSelection(txn)
                    : null)
                : () => _open(txn),
          ),
        );
      },
    );
  }
}
