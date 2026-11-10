import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/kieu_danh_muc.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import 'xu_huong_thang.dart';
import '../bao_cao/chi_tiet_danh_muc.dart';
import '../bao_cao/ky_bao_cao.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/bieu_do.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../bao_cao/bo_loc_ky.dart';

typedef _ExpensePeriodData = ({
  ReportPeriod period,
  List<_ExpenseCategory> rows
});

class ExpenseBreakdownSheet extends StatefulWidget {
  const ExpenseBreakdownSheet({
    super.key,
    required this.report,
    required this.initialWeek,
  });

  final MonthlyTrendData report;
  final bool initialWeek;

  @override
  State<ExpenseBreakdownSheet> createState() => _ExpenseBreakdownSheetState();
}

class _ExpenseBreakdownSheetState extends State<ExpenseBreakdownSheet> {
  late final ReportPeriodFilterController _filter;
  Future<_ExpensePeriodData>? _remote;
  Future<List<ReportEntry>>? _entriesRequest;
  _ExpenseCategory? _openingCategory;

  @override
  void initState() {
    super.initState();
    _filter = ReportPeriodFilterController(
      through: widget.report.through,
      mode: widget.initialWeek ? ReportPeriodMode.week : ReportPeriodMode.month,
    )..addListener(_changePeriod);
  }

  @override
  void dispose() {
    _filter.dispose();
    super.dispose();
  }

  String _periodLabel(ReportPeriod period) =>
      '${formatDate(period.start)} – ${formatDate(period.end)}';

  void _changePeriod() {
    setState(() {
      _openingCategory = null;
      _entriesRequest = null;
      final cached = _filter.isCurrent &&
          (_filter.mode == ReportPeriodMode.week ||
              _filter.mode == ReportPeriodMode.month);
      _remote = cached ? null : _loadRows(_filter.period, all: _filter.all);
    });
  }

  Future<_ExpensePeriodData> _loadRows(ReportPeriod period,
      {required bool all}) async {
    final report = await context.read<AppData>().finance.analytics(
          start: period.start,
          end: period.end,
          all: all,
        );
    final rows = report.expenseCategories.isEmpty
        ? [
            for (final category in report.byCategory)
              {'name': category.name, 'amount': category.amount},
          ]
        : [...report.expenseCategories];
    rows.sort((a, b) {
      final byAmount = asDouble(b['amount']).compareTo(asDouble(a['amount']));
      return byAmount == 0
          ? a['name'].toString().compareTo(b['name'].toString())
          : byAmount;
    });
    return (
      period: all
          ? ReportPeriod(report.start ?? period.start, report.end ?? period.end)
          : period,
      rows: _ExpenseCategory.fromRows(rows, 'amount'),
    );
  }

  Future<void> _openCategory(
      _ExpenseCategory category, ReportPeriod period) async {
    if (_openingCategory != null) return;
    setState(() => _openingCategory = category);
    final request =
        _entriesRequest ??= context.read<AppData>().finance.reportEntries(
              start: period.start,
              end: period.end,
              all: _filter.all,
            );
    try {
      final entries = await request;
      if (!mounted || _openingCategory != category) return;
      await pushScreen<void>(
        context,
        CategoryReportScreen(
          categoryName: category.name,
          isIncome: false,
          month: period.start,
          periodLabel: _periodLabel(period),
          total: category.amount,
          entries: entries.where(category.matches).toList(),
        ),
      );
    } catch (error) {
      if (identical(_entriesRequest, request)) _entriesRequest = null;
      if (mounted && _openingCategory == category) {
        showSnack(errorText(error), error: true);
      }
    } finally {
      if (mounted && _openingCategory == category) {
        setState(() => _openingCategory = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final period = _filter.period;
    final remote = _remote;
    final all = _filter.all;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        primary: false,
        automaticallyImplyLeading: false,
        centerTitle: true,
        backgroundColor: AppColors.surface,
        leadingWidth: 80,
        leading: Padding(
          padding: const EdgeInsetsDirectional.only(start: Space.xs),
          child: Center(
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 40),
                padding: const EdgeInsets.symmetric(horizontal: Space.sm),
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: AppColors.ink,
              ),
              child:
                  Text('Đóng', style: Theme.of(context).textTheme.labelLarge),
            ),
          ),
        ),
        title: const Text('Chi tiết khoản chi',
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis),
        actions: [ReportPeriodFilterButton(controller: _filter)],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            ReportPeriodFilterStrip(controller: _filter),
            Expanded(
              child: remote == null
                  ? _content(
                      period,
                      _ExpenseCategory.fromRows(
                        widget.report.rankedCategories(
                            _filter.mode == ReportPeriodMode.week),
                        _filter.mode == ReportPeriodMode.week
                            ? 'week'
                            : 'month',
                      ))
                  : FutureBuilder<_ExpensePeriodData>(
                      future: remote,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState != ConnectionState.done) {
                          return const Center(child: LoadingView());
                        }
                        if (snapshot.hasError) {
                          return Center(
                              child: ErrorView(
                            message: errorText(snapshot.error!),
                            onRetry: () => setState(
                                () => _remote = _loadRows(period, all: all)),
                          ));
                        }
                        final data = snapshot.requireData;
                        return _content(data.period, data.rows);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(ReportPeriod period, List<_ExpenseCategory> categories) {
    final total =
        categories.fold<double>(0, (sum, category) => sum + category.amount);
    return ListView.builder(
      key: ValueKey((period.start, period.end)),
      padding: const EdgeInsets.fromLTRB(
          Space.screen, Space.md, Space.screen, Space.xl),
      itemCount: categories.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_periodLabel(period), style: AppText.caption),
              const SizedBox(height: Space.sm),
              Table(
                columnWidths: const {1: FixedColumnWidth(Space.md)},
                children: [
                  const TableRow(children: [
                    Text('Tổng cộng', style: AppText.caption),
                    SizedBox.shrink(),
                    Text('Trung bình mỗi ngày', style: AppText.caption),
                  ]),
                  TableRow(children: [
                    _amount(total),
                    const SizedBox.shrink(),
                    _amount(total / period.days),
                  ]),
                ],
              ),
              const SizedBox(height: Space.md),
              if (categories.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: Space.xl),
                  child: Center(
                      child: Text('Kỳ này chưa có khoản chi.',
                          style: AppText.caption)),
                )
              else ...[
                _ExpenseDonut(categories: categories, total: total),
                const SizedBox(height: Space.xs),
              ],
            ],
          );
        }
        final category = categories[index - 1];
        final opening = _openingCategory?.id == category.id &&
            _openingCategory?.name == category.name;
        return Column(children: [
          InkWell(
            onTap: _openingCategory == null
                ? () => _openCategory(category, period)
                : null,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 60),
              child: Row(children: [
                category.avatar(38),
                const SizedBox(width: Space.sm),
                Expanded(
                    flex: 5,
                    child: Text(category.name, style: AppText.cardTitle)),
                const SizedBox(width: Space.xs),
                Expanded(
                  flex: 4,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerEnd,
                    child: Text(
                      formatMoney(category.amount),
                      style: moneyStyle.copyWith(
                          fontSize: 15, color: AppColors.danger),
                    ),
                  ),
                ),
                const SizedBox(width: Space.xs),
                if (opening)
                  const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                else
                  const Icon(Icons.chevron_right_rounded,
                      size: 20, color: AppColors.muted),
              ]),
            ),
          ),
          const Divider(
              indent: 38 + Space.sm, height: 1, color: AppColors.line),
        ]);
      },
    );
  }

  Widget _amount(double value) => Padding(
        padding: const EdgeInsets.only(top: Space.xxs),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: Text(formatMoney(value),
              style:
                  moneyStyle.copyWith(fontSize: 21, color: AppColors.danger)),
        ),
      );
}

class _ExpenseCategory {
  const _ExpenseCategory(this.name, this.amount, this.colorKey,
      {this.id, this.icon});

  final String name;
  final double amount;
  final String colorKey;
  final String? id;
  final String? icon;

  Color get color => categoryColor(colorKey);

  Widget avatar(double size) => ClipOval(
          child: CategoryAvatar(
        icon: icon,
        color: colorKey,
        name: name,
        size: size,
      ));

  bool matches(ReportEntry entry) {
    if (entry.type != 'EXPENSE') return false;
    if (id != null && entry.categoryId != null) return id == entry.categoryId;
    return entry.categoryName ==
        (id == ReportEntry.uncategorizedId ? ReportEntry.uncategorized : name);
  }

  static List<_ExpenseCategory> fromRows(List<Json> rows, String amountKey) => [
        for (final (index, row) in rows.indexed)
          if (asDouble(row[amountKey]) > 0)
            _ExpenseCategory(
              asText(row['name']) ?? ReportEntry.uncategorized,
              asDouble(row[amountKey]),
              asText(row['color']) ??
                  categoryColors[index % categoryColors.length].key,
              id: row.containsKey('id')
                  ? asText(row['id']) ?? ReportEntry.uncategorizedId
                  : null,
              icon: asText(row['icon']),
            ),
      ];
}

class _ExpenseDonut extends StatelessWidget {
  const _ExpenseDonut({required this.categories, required this.total});

  final List<_ExpenseCategory> categories;
  final double total;

  @override
  Widget build(BuildContext context) {
    const height = 224.0;
    const badgeSize = 28.0;
    final segments = categories.length <= 6
        ? categories
        : [
            ...categories.take(5),
            _ExpenseCategory(
                'Các danh mục khác',
                categories
                    .skip(5)
                    .fold<double>(0, (sum, category) => sum + category.amount),
                categoryColors
                    .firstWhere((option) => categories
                        .take(5)
                        .every((category) => category.colorKey != option.key))
                    .key,
                icon: 'package'),
          ];
    return Center(
        child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 400),
      child: SizedBox(
          height: height,
          child: LayoutBuilder(builder: (context, constraints) {
            final width = constraints.maxWidth;
            final diameter = math.min(width * 0.49, 170.0);
            final sideWidth = (width - diameter) / 2;
            final center = Offset(width / 2, height / 2);
            final callouts = <Widget>[];
            final connectors = <(Offset, Offset, Color)>[];
            final sides = [
              <(_ExpenseCategory, Offset)>[],
              <(_ExpenseCategory, Offset)>[]
            ];
            var angle = -math.pi / 2;
            for (final category in segments) {
              final sweep = category.amount / total * math.pi * 2;
              final middle = angle + sweep / 2;
              final direction = Offset(math.cos(middle), math.sin(middle));
              sides[direction.dx < 0 ? 0 : 1].add((category, direction));
              angle += sweep;
            }
            for (final (side, items) in sides.indexed) {
              items.sort((a, b) => a.$2.dy.compareTo(b.$2.dy));
              final left = side == 0;
              final edge = left ? sideWidth - 9 : width - sideWidth + 9;
              for (final (index, (category, direction)) in items.indexed) {
                final y = items.length == 1
                    ? center.dy + direction.dy * diameter * 0.4
                    : center.dy + (index - (items.length - 1) / 2) * 37;
                connectors.add((
                  center + direction * (diameter / 2),
                  Offset(edge, y),
                  category.color
                ));
                final percent = category.amount / total * 100;
                final label = percent < 0.5 ? '<1%' : '${percent.round()}%';
                final text = Flexible(
                    child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label,
                      style: AppText.caption.copyWith(color: AppColors.ink)),
                ));
                callouts.add(Positioned(
                  left: left ? 0 : edge,
                  top: y - badgeSize / 2,
                  width: sideWidth - 9,
                  height: badgeSize,
                  child: Semantics(
                    label: '${category.name}, $label',
                    child: ExcludeSemantics(
                        child: Row(
                      mainAxisAlignment: left
                          ? MainAxisAlignment.end
                          : MainAxisAlignment.start,
                      children: [
                        if (left) ...[text, const SizedBox(width: Space.xxs)],
                        category.avatar(badgeSize),
                        if (!left) ...[const SizedBox(width: Space.xxs), text],
                      ],
                    )),
                  ),
                ));
              }
            }
            return SizedBox(
                width: width,
                child: Stack(alignment: Alignment.center, children: [
                  Positioned.fill(
                      child:
                          CustomPaint(painter: _ExpenseConnectors(connectors))),
                  DonutChart(size: diameter, ringWidth: 0.22, slices: [
                    for (final category in segments)
                      ChartSlice(
                          label: category.name,
                          value: category.amount,
                          color: category.color),
                  ]),
                  ...callouts,
                ]));
          })),
    ));
  }
}

class _ExpenseConnectors extends CustomPainter {
  const _ExpenseConnectors(this.connectors);

  final List<(Offset, Offset, Color)> connectors;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..strokeWidth = 1;
    for (final (start, end, color) in connectors) {
      canvas.drawLine(start, end, paint..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _ExpenseConnectors oldDelegate) =>
      oldDelegate.connectors != connectors;
}
