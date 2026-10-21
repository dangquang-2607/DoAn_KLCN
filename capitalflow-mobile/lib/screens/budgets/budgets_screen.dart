import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/common.dart';
import 'budget_form_screen.dart';

/// Theo dõi ngân sách: tiến độ chi tiêu so với hạn mức, cảnh báo khi gần chạm hoặc vượt.
class BudgetsScreen extends StatefulWidget {
  const BudgetsScreen({super.key});

  @override
  State<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends State<BudgetsScreen> with AutoRefresh<BudgetsScreen> {
  List<BudgetProgress> _budgets = <BudgetProgress>[];
  bool _loading = true;
  String? _error;

  @override
  Future<void> reload() async {
    final appData = context.read<AppData>();
    try {
      final budgets = await appData.finance.budgets();
      if (!mounted) return;
      setState(() {
        _budgets = budgets;
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

  Future<void> _openForm([BudgetProgress? budget]) async {
    await pushScreen<bool>(context, BudgetFormScreen(existing: budget));
  }

  Future<void> _delete(BudgetProgress budget) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Xóa ngân sách?',
      message: 'Ngân sách "${budget.name}" sẽ không còn được theo dõi. Các giao dịch không bị ảnh hưởng.',
      confirmLabel: 'Xóa',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    try {
      await appData.finance.deleteBudget(budget.id);
      await appData.markChanged();
      showSnack('Đã xóa ngân sách.');
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  void _showActions(BudgetProgress budget) {
    showPickerSheet<void>(
      context,
      title: budget.name,
      children: (sheetContext) => [
        SheetOption(
          title: 'Chỉnh sửa ngân sách',
          leading: const Icon(Icons.edit_outlined, color: AppColors.ink),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _openForm(budget);
          },
        ),
        SheetOption(
          title: 'Xóa ngân sách',
          leading: const Icon(Icons.delete_outline, color: AppColors.danger),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _delete(budget);
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final current = _budgets.where((budget) => budget.isCurrent).toList();
    final others = _budgets.where((budget) => !budget.isCurrent).toList();
    final totalLimit = current.fold<double>(0, (sum, budget) => sum + budget.amountLimit);
    final totalSpent = current.fold<double>(0, (sum, budget) => sum + budget.spent);
    final alerts = current.where((budget) => budget.isWarning || budget.isExceeded).length;

    Widget content;
    if (_loading && _budgets.isEmpty) {
      content = ListView(children: const [SizedBox(height: 120), LoadingView()]);
    } else if (_error != null && _budgets.isEmpty) {
      content = ListView(children: [const SizedBox(height: 60), ErrorView(message: _error!, onRetry: reload)]);
    } else if (_budgets.isEmpty) {
      content = ListView(
        children: [
          const SizedBox(height: 40),
          EmptyView(
            icon: Icons.pie_chart_outline,
            title: 'Chưa có ngân sách nào',
            message: 'Đặt hạn mức chi tiêu theo tháng hoặc theo danh mục để nhận cảnh báo trước khi vượt ngưỡng.',
            actionLabel: 'Tạo ngân sách',
            onAction: _openForm,
          ),
        ],
      );
    } else {
      content = ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        children: [
          if (current.isNotEmpty) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text('Kỳ hiện tại', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                      ),
                      if (alerts > 0)
                        StatusChip('$alerts ngân sách cần chú ý', color: AppColors.warning)
                      else
                        const StatusChip('Trong tầm kiểm soát', color: AppColors.success),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${formatMoney(totalSpent)} / ${formatMoney(totalLimit)}',
                    style: moneyStyle.copyWith(fontSize: 20, color: AppColors.ink),
                  ),
                  const SizedBox(height: 10),
                  ProgressBar(
                    value: totalLimit <= 0 ? 0 : totalSpent / totalLimit,
                    color: totalSpent > totalLimit ? AppColors.danger : AppColors.blue,
                    height: 10,
                  ),
                ],
              ),
            ),
            const SectionHeader('Đang áp dụng'),
            for (final budget in current)
              _BudgetCard(
                budget: budget,
                category: appData.categoryById(budget.categoryId),
                onTap: () => _showActions(budget),
              ),
          ],
          if (others.isNotEmpty) ...[
            const SectionHeader('Kỳ khác'),
            for (final budget in others)
              _BudgetCard(
                budget: budget,
                category: appData.categoryById(budget.categoryId),
                onTap: () => _showActions(budget),
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
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Ngân sách',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.5),
                  ),
                ),
                TextButton.icon(
                  onPressed: _openForm,
                  icon: const Icon(Icons.add, size: 20),
                  label: const Text('Thêm'),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(onRefresh: reload, color: AppColors.blue, child: content),
          ),
        ],
      ),
    );
  }
}

class _BudgetCard extends StatelessWidget {
  const _BudgetCard({required this.budget, required this.category, required this.onTap});

  final BudgetProgress budget;
  final FinanceCategory? category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = budget.isExceeded
        ? AppColors.danger
        : budget.isWarning
            ? AppColors.amber
            : AppColors.success;
    final statusLabel = budget.isExceeded
        ? 'Vượt hạn mức'
        : budget.isWarning
            ? 'Sắp chạm ngưỡng'
            : 'An toàn';
    final current = category;
    final scope = budget.categoryId == null ? 'Tất cả chi tiêu' : (current?.name ?? 'Danh mục đã ẩn');

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (current != null)
                  CategoryAvatar(icon: current.icon, color: current.color, name: current.name, size: 40)
                else
                  const IconBadge(icon: Icons.all_inclusive, color: AppColors.blue, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        budget.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$scope · ${formatDate(budget.startDate)} – ${formatDate(budget.endDate)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusChip(statusLabel, color: color == AppColors.amber ? AppColors.warning : color),
              ],
            ),
            const SizedBox(height: 14),
            ProgressBar(value: budget.usagePercent / 100, color: color, height: 9),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Đã chi ${formatMoney(budget.spent)} (${budget.usagePercent.round()}%)',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
                Text(
                  budget.remaining >= 0
                      ? 'Còn ${formatMoney(budget.remaining)}'
                      : 'Vượt ${formatMoney(budget.remaining.abs())}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: budget.remaining >= 0 ? AppColors.muted : AppColors.danger,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Hạn mức ${formatMoney(budget.amountLimit)} · cảnh báo từ ${budget.warningPercent.round()}%',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}
