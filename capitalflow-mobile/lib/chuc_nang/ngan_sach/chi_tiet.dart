import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

enum BudgetDetailAction { edit, delete, reuse }

String budgetScope(BudgetProgress budget, FinanceCategory? category) =>
    category?.name ??
    (budget.categoryId == null ? 'Tất cả danh mục' : 'Danh mục đã ẩn');

(String, Color) budgetStatus(BudgetProgress budget, {bool history = false}) =>
    switch (budget.periodState) {
      'UPCOMING' => ('Sắp bắt đầu', AppColors.muted),
      'PAUSED' when !history => ('Tạm dừng', AppColors.warning),
      _ when budget.isExceeded => ('Vượt hạn mức', AppColors.danger),
      _ when budget.isWarning => ('Đạt ngưỡng cảnh báo', AppColors.warning),
      _ => ('Trong hạn mức', AppColors.success),
    };

class BudgetCategoryIcon extends StatelessWidget {
  const BudgetCategoryIcon(this.category, {super.key});

  final FinanceCategory? category;

  @override
  Widget build(BuildContext context) => ClipOval(
        child: CategoryAvatar(
          icon: category?.icon ?? 'piggy-bank',
          color: category?.color ?? 'teal',
          name: category?.name,
          size: 40,
        ),
      );
}

class BudgetDialog extends StatelessWidget {
  const BudgetDialog(
      {super.key,
      required this.title,
      required this.body,
      this.leading,
      this.footer,
      this.busy = false});

  final String title;
  final Widget body;
  final Widget? leading;
  final Widget? footer;
  final bool busy;

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: !busy,
        child: Dialog(
          insetPadding: const EdgeInsets.symmetric(
              horizontal: Space.sm, vertical: Space.lg),
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md)),
          clipBehavior: Clip.antiAlias,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                        Space.md, Space.xs, Space.xs, Space.xs),
                    child: Row(children: [
                      if (leading != null) ...[
                        leading!,
                        const SizedBox(width: Space.xs)
                      ],
                      Expanded(child: Text(title, style: AppText.section)),
                      IconButton(
                        tooltip: 'Đóng',
                        onPressed:
                            busy ? null : () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded,
                            color: AppColors.muted),
                      ),
                    ]),
                  ),
                  const Divider(height: 1, color: AppColors.line),
                  Flexible(
                      child: SingleChildScrollView(
                    padding: const EdgeInsets.all(Space.md),
                    child: body,
                  )),
                  if (footer != null) ...[
                    const Divider(height: 1, color: AppColors.line),
                    Padding(
                        padding: const EdgeInsets.all(Space.sm),
                        child: footer!),
                  ],
                ]),
          ),
        ),
      );
}

class BudgetDetailDialog extends StatelessWidget {
  const BudgetDetailDialog(
      {super.key,
      required this.budget,
      required this.category,
      required this.history});

  final BudgetProgress budget;
  final FinanceCategory? category;
  final bool history;

  @override
  Widget build(BuildContext context) {
    final (label, color) = budgetStatus(budget, history: history);
    final raw = budget.raw;
    final hasMetrics = raw['period_days'] != null;
    final activeDays = asInt(raw['active_elapsed_days']);
    final elapsed = asInt(raw['elapsed_days']);
    String metricMoney(String key) =>
        raw[key] == null ? '—' : formatMoney(asDouble(raw[key]));
    final allowanceHint = switch (budget.periodState) {
      'UPCOMING' => 'Hiển thị khi kỳ ngân sách bắt đầu.',
      'PAUSED' => 'Ngân sách đang tạm dừng.',
      'COMPLETED' => 'Kỳ ngân sách đã kết thúc.',
      _ when budget.remaining < 0 => 'Ngân sách đã vượt hạn mức.',
      _ => 'Số tiền còn lại chia cho số ngày còn lại, gồm hôm nay.',
    };
    return BudgetDialog(
      title: budget.name,
      leading: BudgetCategoryIcon(category),
      body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        StatusChip(label, color: color),
        const SizedBox(height: Space.xs),
        Text(
            '${budgetScope(budget, category)} · ${formatDate(budget.startDate)} – ${formatDate(budget.endDate)}',
            style: AppText.caption),
        const SizedBox(height: Space.md),
        Row(children: [
          Expanded(
            flex: 3,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(formatMoney(budget.spent),
                  style: moneyStyle.copyWith(fontSize: 25)),
            ),
          ),
          const SizedBox(width: Space.xs),
          Expanded(
            flex: 2,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerEnd,
              child: Text('/ ${formatMoney(budget.amountLimit)}',
                  style: AppText.caption),
            ),
          ),
        ]),
        const SizedBox(height: Space.xs),
        ProgressBar(
            value: budget.usagePercent / 100,
            color: budget.isExceeded
                ? AppColors.danger
                : budget.isWarning
                    ? AppColors.warning
                    : AppColors.blue),
        const SizedBox(height: Space.xs),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
              child: Text('Đã dùng ${budget.usagePercent.round()}%',
                  style: AppText.caption)),
          const SizedBox(width: Space.xs),
          Flexible(
              child: Text(
            '${budget.remaining < 0 ? 'Vượt hạn mức' : 'Còn lại'} ${formatMoney(budget.remaining.abs())}',
            textAlign: TextAlign.end,
            style: AppText.caption.copyWith(
                color: budget.remaining < 0 ? AppColors.danger : AppColors.ink),
          )),
        ]),
        if (hasMetrics) ...[
          const Divider(height: Space.xxl, color: AppColors.line),
          Table(columnWidths: const {
            1: FixedColumnWidth(Space.md)
          }, children: [
            TableRow(children: [
              _BudgetMetric(
                  'Đã qua', '$elapsed / ${asInt(raw['period_days'])} ngày'),
              const SizedBox.shrink(),
              _BudgetMetric('Còn lại (gồm hôm nay)',
                  '${asInt(raw['remaining_days'])} ngày'),
            ]),
            TableRow(children: [
              _BudgetMetric('Có thể chi/ngày', metricMoney('daily_allowance')),
              const SizedBox.shrink(),
              _BudgetMetric(
                  'Chi trung bình/ngày', metricMoney('average_daily_spent')),
            ]),
          ]),
          const Divider(height: Space.md, color: AppColors.line),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(bottom: Space.sm),
            title: const Text('Cách tính', style: AppText.caption),
            expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
            shape: const Border(),
            children: [
              Text(allowanceHint, style: AppText.caption),
              const SizedBox(height: Space.xxs),
              Text(
                  activeDays > 0
                      ? 'Tổng đã chi chia cho $activeDays ngày${activeDays == elapsed ? ', gồm cả ngày không phát sinh chi' : ' hoạt động, bỏ qua ngày tạm dừng'}.'
                      : 'Chưa có ngày hoạt động để tính trung bình.',
                  style: AppText.caption),
              const Text('Số ngày đã qua tính đến hôm nay.',
                  style: AppText.caption),
            ],
          ),
        ],
        const SizedBox(height: Space.sm),
        if (!history && budget.nextEffectiveDate != null)
          Text(
              'Từ ${formatDate(budget.nextEffectiveDate)}: hạn mức ${formatMoney(budget.configuredAmountLimit ?? budget.amountLimit)} · Cảnh báo tại ${budget.configuredWarningPercent ?? budget.warningPercent}%',
              style: AppText.caption),
        if (!history && budget.nextStateDate != null)
          Text(
              '${budget.configuredIsActive == true ? 'Tiếp tục' : 'Tạm dừng'} từ ${formatDate(budget.nextStateDate)}',
              style: AppText.caption),
        if (!history && budget.recurrenceEndDate != null)
          Text('Kết thúc sau ngày ${formatDate(budget.recurrenceEndDate)}',
              style: AppText.caption),
        Text(
            '${history ? 'Kỳ đã kết thúc' : !budget.isRecurring ? 'Một lần' : budget.autoRenews ? 'Tự chuyển kỳ' : 'Dừng sau kỳ này'} · Cảnh báo tại ${budget.warningPercent.toStringAsFixed(budget.warningPercent % 1 == 0 ? 0 : 2).replaceAll('.', ',')}%',
            style: AppText.caption),
        const SizedBox(height: Space.sm),
        Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
          if (history)
            OutlinedButton.icon(
                onPressed: () =>
                    Navigator.of(context).pop(BudgetDetailAction.reuse),
                icon: const Icon(Icons.copy_outlined, size: 18),
                label: const Text('Dùng lại ngân sách'))
          else ...[
            OutlinedButton.icon(
                onPressed: () =>
                    Navigator.of(context).pop(BudgetDetailAction.edit),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Chỉnh sửa')),
            OutlinedButton.icon(
              onPressed: () =>
                  Navigator.of(context).pop(BudgetDetailAction.delete),
              style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: BorderSide(
                      color: AppColors.danger.withValues(alpha: 0.3))),
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('Xóa ngân sách'),
            ),
          ],
        ]),
      ]),
    );
  }
}

class _BudgetMetric extends StatelessWidget {
  const _BudgetMetric(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: Space.sm),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: AppText.caption),
          const SizedBox(height: Space.xxs),
          Text(value, style: AppText.cardTitle),
        ]),
      );
}
