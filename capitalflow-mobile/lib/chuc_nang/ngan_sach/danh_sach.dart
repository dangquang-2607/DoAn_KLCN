import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import 'chu_ky.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'chi_tiet.dart';
import 'bieu_mau.dart';

/// Theo dõi ngân sách: tiến độ chi tiêu so với hạn mức, cảnh báo khi gần chạm hoặc vượt.
class BudgetsScreen extends StatefulWidget {
  const BudgetsScreen({super.key});

  @override
  State<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends State<BudgetsScreen>
    with AutoRefresh<BudgetsScreen> {
  List<BudgetProgress> _budgets = <BudgetProgress>[];
  bool _history = false;
  int _year = budgetToday().year;
  int _month = 0;
  int _request = 0;
  bool _busy = false;
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted && TickerMode.valuesOf(context).enabled) reload();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  bool _loading = true;
  String? _error;

  @override
  Future<void> reload() async {
    final appData = context.read<AppData>();
    final request = ++_request;
    try {
      final budgets = _history
          ? await BudgetLifecycleRepository(appData.finance.api).history(_year)
          : await appData.finance.budgets();
      if (!mounted || request != _request) return;
      setState(() {
        _budgets = budgets;
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

  Future<void> _openForm([BudgetProgress? budget]) async {
    final changed = budget == null
        ? await pushScreen<bool>(context, const BudgetFormScreen())
        : await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (_) => BudgetFormScreen(existing: budget),
          );
    if (changed == true && mounted) await reload();
  }

  Future<void> _delete(BudgetProgress budget) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Xóa ngân sách?',
      message:
          'Ngân sách "${budget.name}" và toàn bộ lịch sử các kỳ của ngân sách này sẽ bị xóa. Các giao dịch chi tiêu được giữ nguyên.',
      confirmLabel: 'Xóa',
      danger: true,
    );
    if (!confirmed || !mounted || _busy) return;
    setState(() => _busy = true);
    final appData = context.read<AppData>();
    try {
      await appData.finance.deleteBudget(budget.id);
      await appData.markChanged();
      if (mounted) await reload();
      showSnack('Đã xóa ngân sách.');
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showDetails(
      BudgetProgress budget, FinanceCategory? category) async {
    if (_busy) return;
    final action = await showDialog<BudgetDetailAction>(
      context: context,
      builder: (_) => BudgetDetailDialog(
        budget: budget,
        category: category,
        history: _history || budget.isCompleted,
      ),
    );
    if (!mounted) return;
    switch (action) {
      case BudgetDetailAction.edit:
        await _openForm(budget);
      case BudgetDetailAction.delete:
        await _delete(budget);
      case BudgetDetailAction.reuse:
        final changed =
            await pushScreen<bool>(context, BudgetFormScreen(reuse: budget));
        if (changed == true && mounted) await reload();
      case null:
        break;
    }
  }

  void _selectView({bool? history, int? year}) {
    setState(() {
      _history = history ?? _history;
      _year = year ?? _year;
      _budgets = [];
      _error = null;
      _loading = true;
    });
    reload();
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final visible = _budgets
        .where((b) => !_history || _month == 0 || b.endDate.month == _month)
        .toList();
    final groups = _history
        ? [('Các kỳ đã kết thúc', visible)]
        : [
            (
              'Kỳ hiện tại',
              visible.where((b) => b.periodState != 'UPCOMING').toList()
            ),
            (
              'Sắp tới',
              visible.where((b) => b.periodState == 'UPCOMING').toList()
            ),
          ];

    Widget content;
    if (_loading) {
      content =
          ListView(children: const [SizedBox(height: 120), LoadingView()]);
    } else if (_error != null) {
      content = ListView(children: [
        const SizedBox(height: 60),
        ErrorView(message: _error!, onRetry: reload)
      ]);
    } else if (visible.isEmpty) {
      content = ListView(
        children: [
          const SizedBox(height: 40),
          EmptyView(
            icon: Icons.pie_chart_outline,
            title:
                _history ? 'Chưa có kỳ đã kết thúc' : 'Chưa có ngân sách nào',
            message:
                'Đặt hạn mức chi tiêu theo tháng hoặc theo danh mục để nhận cảnh báo trước khi vượt ngưỡng.',
          ),
        ],
      );
    } else {
      content = ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, Space.xl),
        children: [
          Row(children: [
            Expanded(
              child: Text(
                  _history ? 'Lịch sử ngân sách' : 'Danh sách ngân sách',
                  style: AppText.section),
            ),
            const SizedBox(width: Space.xs),
            StatusChip('${visible.length} mục', color: AppColors.muted),
          ]),
          const SizedBox(height: Space.xxs),
          const Text('Chọn một dòng để xem chi tiết.', style: AppText.caption),
          for (final (title, budgets) in groups)
            if (budgets.isNotEmpty) ...[
              const SizedBox(height: Space.lg),
              Row(children: [
                Flexible(
                    child: Text(title.toUpperCase(),
                        style: AppText.caption
                            .copyWith(fontWeight: FontWeight.w700))),
                const SizedBox(width: Space.xs),
                StatusChip('${budgets.length}', color: AppColors.muted),
              ]),
              const SizedBox(height: Space.xs),
              for (final budget in budgets)
                _BudgetCard(
                  key: ValueKey(budget.recordKey),
                  budget: budget,
                  category: appData.categoryById(budget.categoryId),
                  history: _history,
                  onTap: () => _showDetails(
                      budget, appData.categoryById(budget.categoryId)),
                ),
            ],
        ],
      );
    }
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Expanded(
                  flex: 2,
                  child: Text(
                    'Ngân sách',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5),
                  ),
                ),
                const SizedBox(width: Space.xs),
                Flexible(
                  flex: 3,
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: PillAddButton(
                      onPressed: _openForm,
                      label: 'Tạo ngân sách',
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.sm),
            child: SegmentedChoice<bool>(
              options: const [
                MapEntry(false, 'Kỳ hiện tại'),
                MapEntry(true, 'Lịch sử')
              ],
              value: _history,
              onChanged: (value) {
                if (value != _history) _selectView(history: value);
              },
            ),
          ),
          if (_history)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Wrap(
                spacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(
                        onPressed: _year > 1900
                            ? () => _selectView(year: _year - 1)
                            : null,
                        icon: const Icon(Icons.chevron_left)),
                    Text('$_year'),
                    IconButton(
                        onPressed: _year < budgetToday().year
                            ? () => _selectView(year: _year + 1)
                            : null,
                        icon: const Icon(Icons.chevron_right)),
                  ]),
                  DropdownButton<int>(
                      value: _month,
                      items: [
                        const DropdownMenuItem(
                            value: 0, child: Text('Tất cả tháng')),
                        for (var month = 1; month <= 12; month++)
                          DropdownMenuItem(
                              value: month, child: Text('Tháng $month')),
                      ],
                      onChanged: (value) {
                        if (value != null) setState(() => _month = value);
                      }),
                ],
              ),
            ),
          Expanded(
            child: RefreshIndicator(
                onRefresh: reload, color: AppColors.blue, child: content),
          ),
        ],
      ),
    );
  }
}

class _BudgetCard extends StatelessWidget {
  const _BudgetCard({
    super.key,
    required this.budget,
    required this.category,
    required this.history,
    required this.onTap,
  });

  final BudgetProgress budget;
  final FinanceCategory? category;
  final bool history;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (label, color) = budgetStatus(budget, history: history);
    final statusColor = label == 'Trong hạn mức' ? AppColors.muted : color;
    final radius = BorderRadius.circular(Radii.sm);
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.xs),
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: const BorderSide(color: AppColors.line),
        ),
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Space.sm),
            child: Row(children: [
              BudgetCategoryIcon(category),
              const SizedBox(width: Space.sm),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(budget.name, style: AppText.cardTitle),
                    const SizedBox(height: Space.xxs),
                    Text(budgetScope(budget, category), style: AppText.caption),
                    Text(
                        '${formatDate(budget.startDate)} – ${formatDate(budget.endDate)}',
                        style: AppText.caption),
                    const SizedBox(height: Space.xs),
                    Text(formatMoney(budget.spent),
                        style: moneyStyle.copyWith(fontSize: 16)),
                    const SizedBox(height: Space.xxs),
                    Text('${budget.usagePercent.round()}% · $label',
                        style: AppText.caption.copyWith(color: statusColor)),
                  ])),
              const SizedBox(width: Space.xxs),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.muted, size: 20),
            ]),
          ),
        ),
      ),
    );
  }
}
