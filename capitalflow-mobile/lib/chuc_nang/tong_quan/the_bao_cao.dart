import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import 'xu_huong_thang.dart';
import '../../dung_chung/giao_dien/bieu_do.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'chi_tieu_danh_muc.dart';

class DashboardReports extends StatefulWidget {
  const DashboardReports(
      {super.key,
      required this.report,
      required this.loading,
      required this.error,
      required this.onRetry,
      required this.onOpenReport,
      this.promotion});

  final MonthlyTrendData? report;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final VoidCallback onOpenReport;
  final Widget? promotion;

  @override
  State<DashboardReports> createState() => _DashboardReportsState();
}

class _DashboardReportsState extends State<DashboardReports> {
  String _metric = 'expense';
  int? _day;
  bool _rankingWeek = true;

  @override
  void didUpdateWidget(covariant DashboardReports oldWidget) {
    super.didUpdateWidget(oldWidget);
    final previous = oldWidget.report?.through;
    final current = widget.report?.through;
    if (previous?.year != current?.year || previous?.month != current?.month) {
      _day = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    if (report == null) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _ReportPanel(title: 'Báo cáo tổng quan', children: [
          if (widget.loading)
            const LoadingView()
          else
            ErrorView(
                message: widget.error ?? 'Chưa tải được báo cáo.',
                onRetry: widget.onRetry),
        ]),
        if (widget.promotion != null) ...[
          const SizedBox(height: Space.md),
          widget.promotion!,
        ],
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.error != null) ...[
        InfoBanner(message: widget.error!, color: AppColors.warning),
        Align(
            alignment: Alignment.centerRight,
            child: TextButton(
                onPressed: widget.onRetry,
                child: const Text('Thử tải lại báo cáo'))),
      ],
      _trend(report),
      const SizedBox(height: Space.md),
      if (widget.promotion != null) ...[
        widget.promotion!,
        const SizedBox(height: Space.md),
      ],
      _ranking(report),
    ]);
  }

  Widget _trend(MonthlyTrendData report) {
    final points = report.comparison(_metric);
    final day = (_day ?? report.through.day).clamp(1, points.length);
    final selected = points[day - 1];
    final color = _metric == 'income' ? AppPalette.sky : AppColors.danger;
    return _reportSection(
        title: 'Báo cáo xu hướng',
        action: 'Xem báo cáo',
        onAction: widget.onOpenReport,
        children: [
          Row(children: [
            for (final metric in const ['expense', 'income'])
              Expanded(
                  child: TextButton(
                style: TextButton.styleFrom(
                  foregroundColor:
                      metric == 'income' ? AppPalette.sky : AppColors.danger,
                  backgroundColor:
                      _metric == metric ? AppColors.surfaceMuted : null,
                  padding: const EdgeInsets.symmetric(
                      horizontal: Space.xs, vertical: Space.sm),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(Radii.sm)),
                ),
                onPressed: () => setState(() {
                  _metric = metric;
                  _day = null;
                }),
                child: Semantics(
                    selected: metric == _metric,
                    child: Column(children: [
                      Text(metric == 'income' ? 'Tổng thu' : 'Tổng đã chi',
                          textAlign: TextAlign.center),
                      const SizedBox(height: Space.xxs),
                      Text(formatMoney(report.total(metric)),
                          style: moneyStyle.copyWith(
                              fontSize: 18,
                              color: metric == 'income'
                                  ? AppPalette.sky
                                  : AppColors.danger),
                          textAlign: TextAlign.center),
                    ])),
              )),
          ]),
          const SizedBox(height: Space.md),
          Text(
              '${day.toString().padLeft(2, '0')}/${report.through.month.toString().padLeft(2, '0')}/${report.through.year}',
              style: AppText.caption),
          Text(
              selected.actual == null
                  ? 'Chưa đến ngày này'
                  : formatMoney(selected.actual!),
              style: moneyStyle.copyWith(fontSize: 20, color: color)),
          const SizedBox(height: Space.xxs),
          Text(
              'Trung bình 3 tháng trước · ${formatMoney(selected.average.round())}',
              style: AppText.caption),
          const SizedBox(height: Space.md),
          _MonthlyPlot(
              points: points,
              day: day,
              month: report.through.month,
              color: color,
              onSelect: (value) => setState(() => _day = value)),
          const SizedBox(height: Space.sm),
          Wrap(spacing: Space.md, runSpacing: Space.xs, children: [
            LegendDot(color: color, label: 'Tháng này'),
            const LegendDot(
                color: AppColors.muted, label: 'Trung bình 3 tháng trước'),
          ]),
        ]);
  }

  Widget _ranking(MonthlyTrendData report) {
    final categories = report.rankedCategories(_rankingWeek);
    final metric = _rankingWeek ? 'week' : 'month';
    final total = categories.fold<double>(
        0, (sum, category) => sum + asDouble(category[metric]));
    return _reportSection(
        title: 'Chi tiêu nhiều nhất',
        action: categories.isEmpty ? null : 'Xem chi tiết',
        onAction: () => showModalBottomSheet<void>(
              context: context,
              useSafeArea: true,
              isScrollControlled: true,
              showDragHandle: false,
              clipBehavior: Clip.antiAlias,
              builder: (_) => FractionallySizedBox(
                heightFactor: 0.96,
                child: ExpenseBreakdownSheet(
                    report: report, initialWeek: _rankingWeek),
              ),
            ),
        children: [
          _periodSwitch(_rankingWeek, 'Kỳ xếp hạng danh mục',
              (value) => setState(() => _rankingWeek = value)),
          if (categories.isEmpty) ...[
            const SizedBox(height: Space.md),
            Text('${_rankingWeek ? 'Tuần' : 'Tháng'} này chưa có khoản chi.',
                style: AppText.caption),
          ],
          for (final category in categories.take(3))
            _CategoryRank(category: category, metric: metric, total: total),
        ]);
  }

  Widget _reportSection({
    required String title,
    required String? action,
    required VoidCallback onAction,
    required List<Widget> children,
  }) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionHeader(
            title,
            actionLabel: action,
            onAction: onAction,
            showActionChevron: false,
            maxTitleLines: 2,
          ),
          _ReportPanel(children: children),
        ],
      );

  Widget _periodSwitch(bool week, String label, ValueChanged<bool> onChanged) =>
      Semantics(
        label: label,
        child: SegmentedChoice<bool>(
          options: const [MapEntry(true, 'Tuần'), MapEntry(false, 'Tháng')],
          value: week,
          onChanged: onChanged,
        ),
      );
}

class _ReportPanel extends StatelessWidget {
  const _ReportPanel({required this.children, this.title});
  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(Radii.md)),
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (title != null) ...[
              Text(title!, style: AppText.section),
              const SizedBox(height: Space.sm),
            ],
            ...children,
          ]),
        ),
      );
}

class _CategoryRank extends StatelessWidget {
  const _CategoryRank(
      {required this.category, required this.metric, required this.total});
  final Json category;
  final String metric;
  final double total;

  @override
  Widget build(BuildContext context) {
    final amount = asDouble(category[metric]);
    return Padding(
      padding: const EdgeInsets.only(top: Space.md),
      child: Row(children: [
        CategoryAvatar(
            icon: asText(category['icon']),
            color: asText(category['color']),
            name: asText(category['name']),
            size: 36),
        const SizedBox(width: Space.sm),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(asText(category['name']) ?? 'Khác', style: AppText.cardTitle),
          Text(formatMoney(amount), style: AppText.caption),
        ])),
        const SizedBox(width: Space.xs),
        Text(
            '${(total > 0 ? amount / total * 100 : 0).toStringAsFixed(1).replaceAll('.', ',').replaceFirst(',0', '')}%',
            style: moneyStyle.copyWith(color: AppColors.danger, fontSize: 17)),
      ]),
    );
  }
}

class _MonthlyPlot extends StatelessWidget {
  const _MonthlyPlot(
      {required this.points,
      required this.day,
      required this.month,
      required this.color,
      required this.onSelect});
  final List<MonthlyTrendPoint> points;
  final int day;
  final int month;
  final Color color;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) =>
      LayoutBuilder(builder: (context, constraints) {
        void select(Offset position) => onSelect(
            (1 + position.dx / constraints.maxWidth * (points.length - 1))
                .round()
                .clamp(1, points.length));
        return Column(children: [
          Semantics(
            label: 'Xu hướng lũy kế theo ngày',
            value: 'Ngày $day tháng $month',
            increasedValue:
                day < points.length ? 'Ngày ${day + 1} tháng $month' : null,
            decreasedValue: day > 1 ? 'Ngày ${day - 1} tháng $month' : null,
            onIncrease: day < points.length ? () => onSelect(day + 1) : null,
            onDecrease: day > 1 ? () => onSelect(day - 1) : null,
            child: GestureDetector(
              onTapDown: (details) => select(details.localPosition),
              onHorizontalDragUpdate: (details) =>
                  select(details.localPosition),
              child: SizedBox(
                  height: 160,
                  width: double.infinity,
                  child: CustomPaint(
                      painter: _MonthlyPlotPainter(points, day, color))),
            ),
          ),
          const SizedBox(height: Space.xs),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (final tick in [1, (points.length / 2).ceil(), points.length])
              Text('$tick/$month',
                  style: AppText.caption.copyWith(fontSize: 11)),
          ]),
        ]);
      });
}

class _MonthlyPlotPainter extends CustomPainter {
  _MonthlyPlotPainter(this.points, this.day, this.color);
  final List<MonthlyTrendPoint> points;
  final int day;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final maximum = points.fold<double>(
            1,
            (highest, point) =>
                math.max(highest, math.max(point.actual ?? 0, point.average))) *
        1.08;
    final grid = Paint()
      ..color = AppColors.line
      ..strokeWidth = 1;
    for (var line = 0; line <= 3; line++) {
      final y = size.height * line / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    Offset point(int index, double amount) => Offset(
        index / (points.length - 1) * size.width,
        size.height * (1 - amount / maximum));
    void drawSeries(bool average) {
      final path = Path();
      var started = false;
      for (var index = 0; index < points.length; index++) {
        final amount = average ? points[index].average : points[index].actual;
        if (amount == null) break;
        final position = point(index, amount);
        if (!started) {
          path.moveTo(position.dx, position.dy);
          started = true;
        } else {
          path.lineTo(position.dx, position.dy);
        }
      }
      canvas.drawPath(
          path,
          Paint()
            ..color = average ? AppColors.muted : color
            ..strokeWidth = average ? 2 : 3
            ..style = PaintingStyle.stroke
            ..strokeJoin = StrokeJoin.round);
    }

    drawSeries(true);
    drawSeries(false);
    final selected = points[day - 1];
    final x = (day - 1) / (points.length - 1) * size.width;
    canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    if (selected.actual != null) {
      final position = point(day - 1, selected.actual!);
      canvas.drawCircle(position, 4, Paint()..color = AppColors.surface);
      canvas.drawCircle(
          position,
          4,
          Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2);
    }
  }

  @override
  bool shouldRepaint(covariant _MonthlyPlotPainter oldDelegate) =>
      oldDelegate.points != points ||
      oldDelegate.day != day ||
      oldDelegate.color != color;
}
