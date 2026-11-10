import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../du_lieu/trang_thai.dart';
import '../giao_dich/thao_tac.dart';

/// Các khoản của một danh mục trong tháng báo cáo, gom theo ngày, mới nhất trước.
class CategoryReportScreen extends StatelessWidget {
  const CategoryReportScreen({
    super.key,
    required this.categoryName,
    required this.isIncome,
    required this.month,
    this.periodLabel,
    required this.total,
    required this.entries,
  });

  final String categoryName;
  final bool isIncome;
  final DateTime month;
  final String? periodLabel;
  final double total;
  final List<ReportEntry> entries;

  @override
  Widget build(BuildContext context) {
    final sorted = [...entries]..sort((a, b) {
        final left = a.date, right = b.date;
        if (left == null || right == null) return 0;
        return right.compareTo(left);
      });
    final color = isIncome ? AppColors.success : AppColors.danger;

    final children = <Widget>[
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${isIncome ? 'Tổng thu' : 'Tổng chi'} · ${periodLabel ?? 'tháng ${month.month}/${month.year}'}',
              style: AppText.caption,
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(formatMoney(total),
                  style: moneyStyle.copyWith(fontSize: 28, color: color)),
            ),
            const SizedBox(height: 2),
            Text('${entries.length} khoản', style: AppText.caption),
          ],
        ),
      ),
      const SizedBox(height: Space.md),
    ];

    String? lastDay;
    for (final entry in sorted) {
      final day = formatDate(entry.date);
      if (day != lastDay) {
        lastDay = day;
        children.add(Padding(
          padding: const EdgeInsets.fromLTRB(4, Space.sm, 4, Space.xs),
          child: Text(day,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.muted)),
        ));
      }
      children.add(Padding(
        padding: const EdgeInsets.only(bottom: Space.xs),
        child: AppCard(
          onTap: asText(entry.raw['id']) == null
              ? null
              : () async {
                  final data = context.read<AppData>();
                  final revision = data.revision;
                  await openTransaction(context, Txn.fromJson(entry.raw));
                  if (context.mounted && revision != data.revision) {
                    Navigator.of(context).pop();
                  }
                },
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.description.isEmpty
                          ? categoryName
                          : entry.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14.5, fontWeight: FontWeight.w600),
                    ),
                    if (entry.sourceLabel != null) ...[
                      const SizedBox(height: 2),
                      Text(entry.sourceLabel!, style: AppText.caption),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: Space.sm),
              Text(
                '${isIncome ? '+' : '−'}${formatMoney(entry.amount)}',
                style: moneyStyle.copyWith(fontSize: 14.5, color: color),
              ),
              if (asText(entry.raw['id']) != null)
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.subtle),
            ],
          ),
        ),
      ));
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(context, categoryName),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            Space.screen, Space.xxs, Space.screen, Space.xxl),
        children: children,
      ),
    );
  }
}
