import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/auto_refresh.dart';
import '../../widgets/charts.dart';
import '../../widgets/common.dart';

/// Báo cáo, thống kê và trực quan hóa tình hình tài chính theo từng tháng.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> with AutoRefresh<AnalyticsScreen> {
  late DateTime _month;
  AnalyticsData? _data;
  bool _loading = true;
  String? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month, 1);
  }

  bool get _isCurrentMonth {
    final now = DateTime.now();
    return _month.year == now.year && _month.month == now.month;
  }

  @override
  Future<void> reload() async {
    final request = ++_request;
    final appData = context.read<AppData>();
    final start = _month;
    final end = DateTime(_month.year, _month.month + 1, 0);
    try {
      final data = await appData.finance.analytics(start: start, end: end);
      if (!mounted || request != _request) return;
      setState(() {
        _data = data;
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

  void _shift(int months) {
    if (months > 0 && _isCurrentMonth) return;
    setState(() {
      _month = DateTime(_month.year, _month.month + months, 1);
      _data = null;
      _loading = true;
    });
    reload();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;

    Widget content;
    if (data == null) {
      content = ListView(
        children: [
          const SizedBox(height: 80),
          if (_loading) const LoadingView() else ErrorView(message: _error ?? 'Không tải được báo cáo.', onRetry: reload),
        ],
      );
    } else {
      content = ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          _SummaryRow(data: data),
          const SizedBox(height: 14),
          const SectionHeader('Cơ cấu chi tiêu theo danh mục'),
          _CategoryBreakdown(data: data),
          const SizedBox(height: 14),
          const SectionHeader('Xu hướng thu chi 6 tháng gần nhất'),
          AppCard(
            child: data.trend.isEmpty
                ? const Text(
                    'Chưa đủ dữ liệu để vẽ xu hướng.',
                    style: TextStyle(fontSize: 13.5, color: AppColors.muted),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          LegendDot(color: AppColors.success, label: 'Thu nhập'),
                          SizedBox(width: 16),
                          LegendDot(color: AppColors.danger, label: 'Chi tiêu'),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TrendBarChart(points: data.trend),
                    ],
                  ),
          ),
        ],
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Báo cáo tài chính'),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: AppCard(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => _shift(-1),
                    icon: const Icon(Icons.chevron_left, color: AppColors.ink),
                    tooltip: 'Tháng trước',
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          'Tháng ${_month.month}/${_month.year}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${formatDate(_month)} – ${formatDate(DateTime(_month.year, _month.month + 1, 0))}',
                          style: const TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _isCurrentMonth ? null : () => _shift(1),
                    icon: Icon(Icons.chevron_right, color: _isCurrentMonth ? AppColors.line : AppColors.ink),
                    tooltip: 'Tháng sau',
                  ),
                ],
              ),
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

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.data});

  final AnalyticsData data;

  /// Phần trăm thay đổi so với kỳ trước; `null` khi kỳ trước không có số liệu.
  static double? _change(double current, double previous) {
    if (previous <= 0) return null;
    return (current - previous) / previous * 100;
  }

  @override
  Widget build(BuildContext context) {
    final netPositive = data.net >= 0;
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: netPositive ? AppColors.successSoft : AppColors.dangerSoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                netPositive ? 'Dòng tiền ròng (thặng dư)' : 'Dòng tiền ròng (thâm hụt)',
                style: TextStyle(fontSize: 13, color: netPositive ? AppColors.success : AppColors.danger),
              ),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  '${netPositive ? '+' : '-'}${formatMoney(data.net.abs())}',
                  style: moneyStyle.copyWith(fontSize: 28, color: netPositive ? AppColors.success : AppColors.danger),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                label: 'Thu nhập',
                value: data.income,
                color: AppColors.success,
                icon: Icons.south_west,
                change: _change(data.income, data.previousIncome),
                goodWhenUp: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _MetricCard(
                label: 'Chi tiêu',
                value: data.expense,
                color: AppColors.danger,
                icon: Icons.north_east,
                change: _change(data.expense, data.previousExpense),
                goodWhenUp: false,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    required this.change,
    required this.goodWhenUp,
  });

  final String label;
  final double value;
  final Color color;
  final IconData icon;
  final double? change;
  final bool goodWhenUp;

  @override
  Widget build(BuildContext context) {
    final delta = change;
    String trendText = 'Chưa có kỳ trước để so sánh';
    Color trendColor = AppColors.muted;
    if (delta != null) {
      final up = delta >= 0;
      trendText = '${up ? '▲' : '▼'} ${delta.abs().toStringAsFixed(0)}% so với kỳ trước';
      trendColor = (up == goodWhenUp) ? AppColors.success : AppColors.danger;
      if (delta.abs() < 0.5) {
        trendText = 'Không đổi so với kỳ trước';
        trendColor = AppColors.muted;
      }
    }
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconBadge(icon: icon, color: color, size: 30),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(formatMoney(value), style: moneyStyle.copyWith(fontSize: 18, color: AppColors.ink)),
          ),
          const SizedBox(height: 4),
          Text(trendText, style: TextStyle(fontSize: 11.5, color: trendColor)),
        ],
      ),
    );
  }
}

class _CategoryBreakdown extends StatelessWidget {
  const _CategoryBreakdown({required this.data});

  final AnalyticsData data;

  @override
  Widget build(BuildContext context) {
    if (data.byCategory.isEmpty) {
      return const AppCard(
        child: Row(
          children: [
            IconBadge(icon: Icons.donut_large, color: AppColors.blue),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Chưa có khoản chi nào trong tháng này.',
                style: TextStyle(fontSize: 14, color: AppColors.muted),
              ),
            ),
          ],
        ),
      );
    }
    final slices = buildSlices(data.byCategory);
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    return AppCard(
      child: Column(
        children: [
          DonutChart(slices: slices, centerLabel: 'Tổng chi', centerValue: formatMoney(total)),
          const SizedBox(height: 16),
          for (final slice in slices)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(color: slice.color, borderRadius: BorderRadius.circular(4)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      slice.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                    ),
                  ),
                  Text(
                    '${total <= 0 ? 0 : (slice.value / total * 100).round()}%',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                  ),
                  const SizedBox(width: 12),
                  Text(formatMoney(slice.value), style: moneyStyle.copyWith(fontSize: 14, color: AppColors.ink)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
