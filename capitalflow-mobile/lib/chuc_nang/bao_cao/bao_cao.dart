import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../du_lieu/xuat_excel.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import '../../dung_chung/giao_dien/bieu_do.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'bo_loc_ky.dart';
import 'chi_tiet_danh_muc.dart';
import 'ky_bao_cao.dart';

/// Báo cáo chi tiêu theo kỳ: chênh lệch thu chi, cơ cấu theo danh mục (bấm để xem
/// từng khoản) và nhận xét nhanh.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen(
      {super.key,
      this.initialMode = ReportPeriodMode.month,
      this.initialAnchor});

  final ReportPeriodMode initialMode;
  final DateTime? initialAnchor;

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen>
    with AutoRefresh<AnalyticsScreen> {
  late final ReportPeriodFilterController _filter;
  ReportPeriod get _period =>
      _filter.periodWithBounds(_data?.start, _data?.end);
  String get _periodLabel =>
      '${formatDate(_period.start)} – ${formatDate(_period.end)}';
  AnalyticsData? _data;
  List<ReportEntry> _entries = <ReportEntry>[];
  bool _loading = true;
  bool _detailsReady = false;
  Future<List<ReportEntry>>? _detailRequest;
  String? _error;
  int _request = 0;
  String _type = 'EXPENSE';

  @override
  void initState() {
    super.initState();
    _filter = ReportPeriodFilterController(
      through: widget.initialAnchor ?? DateTime.now(),
      mode: widget.initialMode,
    )..addListener(_changePeriod);
  }

  @override
  void dispose() {
    _filter.dispose();
    super.dispose();
  }

  @override
  Future<void> reload() async {
    final request = ++_request;
    _detailRequest = null;
    final finance = context.read<AppData>().finance;
    final start = _period.start;
    final end = _period.end;
    try {
      final result = await finance.analytics(
        start: start,
        end: end,
        all: _filter.all,
        comparePreviousMonth: _filter.mode == ReportPeriodMode.month,
      );
      if (!mounted || request != _request) return;
      setState(() {
        _data = result;
        _entries = [];
        _detailRequest = null;
        _detailsReady = false;
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

  bool _exporting = false;
  Future<void> _exportExcel() async {
    if (_exporting) return;
    final period = _period;
    final all = _filter.all;
    setState(() => _exporting = true);
    try {
      final result = await context
          .read<AppData>()
          .finance
          .api
          .get('/analytics/export-data', query: {
        if (all)
          'scope': 'all'
        else ...{
          'start_date': isoDate(period.start),
          'end_date': isoDate(period.end),
        },
      });
      if (!mounted) return;
      await shareExcel(asJsonList((result as Map)['transactions']),
          name: 'capitalflow-bao-cao-${all ? 'tat-ca' : isoDate(period.start)}',
          title: 'CapitalFlow · Báo cáo thu chi',
          scope: all
              ? 'Toàn bộ lịch sử'
              : '${formatDate(period.start)} – ${formatDate(period.end)}');
    } catch (e) {
      showSnack(errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _changePeriod() {
    setState(() {
      _data = null;
      _entries = <ReportEntry>[];
      _detailsReady = false;
      _loading = true;
      _error = null;
    });
    reload();
  }

  /// Vuốt sang trái tới tháng sau, sang phải về tháng trước.
  void _onSwipe(DragEndDetails details) {
    if (_filter.mode != ReportPeriodMode.month) return;
    final velocity = details.primaryVelocity ?? 0;
    if (velocity.abs() < 250) return;
    _filter.shift(velocity < 0 ? -1 : 1);
  }

  Future<List<ReportEntry>> _loadDetails() async {
    final request = _request;
    final period = _period;
    if (_detailsReady) return _entries;
    try {
      final entries = await (_detailRequest ??= context
          .read<AppData>()
          .finance
          .reportEntries(
              start: period.start, end: period.end, all: _filter.all));
      if (mounted && request == _request) {
        setState(() {
          _entries = entries;
          _detailsReady = true;
        });
      }
      return entries;
    } finally {
      if (request == _request) _detailRequest = null;
    }
  }

  Future<void> _openCategory(_CategoryRow row) async {
    final request = _request, type = _type;
    try {
      final entries = await _loadDetails();
      if (!mounted || request != _request || type != _type) return;
      await pushScreen<void>(
          context,
          CategoryReportScreen(
              categoryName: row.name,
              isIncome: type == 'INCOME',
              month: _period.start,
              periodLabel: _periodLabel,
              total: row.amount,
              entries: entries
                  .where((e) => e.type == type && e.categoryName == row.name)
                  .toList()));
    } catch (e) {
      showSnack(errorText(e), error: true);
    }
  }

  Widget _content() {
    final data = _data;
    if (data == null) {
      return ListView(
        key: const ValueKey('report-state'),
        children: [
          const SizedBox(height: 80),
          if (_loading)
            const LoadingView()
          else
            ErrorView(
                message: _error ?? 'Không tải được báo cáo.', onRetry: reload),
        ],
      );
    }
    final totals = _type == 'INCOME'
        ? data.incomeCategories
        : {for (final c in data.byCategory) c.name: c.amount};
    final previous = !_filter.all && data.previousPeriodAvailable
        ? data.previousByCategory
        : const <String, double>{};
    final rows = _detailsReady
        ? _CategoryRow.build(_entries, _type, previous)
        : [
            for (final e in totals.entries)
              _CategoryRow(e.key == 'Khác' ? ReportEntry.uncategorized : e.key,
                  e.value, previous[e.key] ?? 0, [])
          ];
    rows.sort((a, b) => b.amount.compareTo(a.amount));
    final isExpense = _type == 'EXPENSE';
    return ListView(
      key: ValueKey((_filter.mode, _period.start, _period.end)),
      padding: const EdgeInsets.fromLTRB(
          Space.screen, Space.xxs, Space.screen, Space.xxl),
      children: [
        _NetCard(
            data: data, compare: !_filter.all && data.previousPeriodAvailable),
        const SizedBox(height: Space.md),
        SegmentedChoice<String>(
          options: const [
            MapEntry('EXPENSE', 'Khoản chi'),
            MapEntry('INCOME', 'Khoản thu')
          ],
          value: _type,
          onChanged: (value) => setState(() => _type = value),
          colorOf: (value) =>
              value == 'INCOME' ? AppColors.success : AppColors.danger,
        ),
        const SizedBox(height: Space.md),
        _CategoryCard(
          rows: rows,
          isExpense: isExpense,
          onOpen: _openCategory,
        ),
        if (!_detailsReady)
          TextButton(
              onPressed: () async {
                try {
                  await _loadDetails();
                } catch (e) {
                  showSnack(errorText(e), error: true);
                }
              },
              child: const Text('Tải số khoản và chi tiết từng ngày')),
        if (isExpense && rows.isNotEmpty) ...[
          const SizedBox(height: Space.xl),
          const SectionHeader('Nhận xét nhanh'),
          _InsightCard(
            total: data.expense,
            period: _period,
            rows: rows,
            entries: _entries,
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(context, 'Báo cáo chi tiêu', titleMaxLines: 2, actions: [
        ReportPeriodFilterButton(controller: _filter),
      ]),
      body: Column(
        children: [
          ReportPeriodFilterStrip(controller: _filter),
          Padding(
            padding: const EdgeInsetsDirectional.only(
                start: Space.screen, end: Space.xs),
            child: Row(children: [
              Expanded(
                  child: Text(
                _filter.all && _data == null ? 'Toàn bộ lịch sử' : _periodLabel,
                style: AppText.caption,
              )),
              IconButton(
                onPressed: _exporting ? null : _exportExcel,
                tooltip: 'Xuất Excel',
                icon: const Icon(Icons.save_alt_rounded),
              ),
            ]),
          ),
          Expanded(
            child: GestureDetector(
              onHorizontalDragEnd: _onSwipe,
              child: RefreshIndicator(
                onRefresh: reload,
                color: AppColors.blue,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: _content(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Thẻ đầu trang: số chênh lệch thu chi nổi bật, thu và chi kèm so sánh với kỳ trước.
class _NetCard extends StatelessWidget {
  const _NetCard({required this.data, required this.compare});

  final AnalyticsData data;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    final positive = data.net >= 0;
    final color = positive ? AppColors.success : AppColors.danger;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Chênh lệch thu chi', style: AppText.caption),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              '${positive ? '+' : '−'}${formatMoney(data.net.abs())}',
              style: moneyStyle.copyWith(fontSize: 30, color: color),
            ),
          ),
          const SizedBox(height: Space.md),
          Row(
            children: [
              Expanded(
                child: _FlowColumn(
                  compare: compare,
                  label: 'Thu nhập',
                  value: data.income,
                  previous: data.previousIncome,
                  color: AppColors.success,
                  goodWhenUp: true,
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: _FlowColumn(
                  compare: compare,
                  label: 'Chi tiêu',
                  value: data.expense,
                  previous: data.previousExpense,
                  color: AppColors.danger,
                  goodWhenUp: false,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FlowColumn extends StatelessWidget {
  const _FlowColumn({
    required this.compare,
    required this.label,
    required this.value,
    required this.previous,
    required this.color,
    required this.goodWhenUp,
  });

  final String label;
  final double value;
  final double previous;
  final Color color;
  final bool goodWhenUp;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LegendDot(color: color, label: label),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(formatMoney(value),
              style: moneyStyle.copyWith(fontSize: 17, color: AppColors.ink)),
        ),
        if (compare) ...[
          const SizedBox(height: 2),
          _ChangeLabel(
              current: value, previous: previous, goodWhenUp: goodWhenUp),
        ],
      ],
    );
  }
}

/// So sánh với kỳ trước; tăng hay giảm là tốt tùy theo [goodWhenUp].
class _ChangeLabel extends StatelessWidget {
  const _ChangeLabel(
      {required this.current,
      required this.previous,
      required this.goodWhenUp});

  final double current;
  final double previous;
  final bool goodWhenUp;

  @override
  Widget build(BuildContext context) {
    var text = 'Kỳ trước chưa có số liệu';
    var color = AppColors.muted;
    if (previous > 0) {
      final delta = (current - previous) / previous * 100;
      if (delta.abs() < 0.5) {
        text = 'Không đổi so với kỳ trước';
      } else {
        final up = delta > 0;
        text =
            '${up ? '▲' : '▼'} ${delta.abs().toStringAsFixed(0)}% so với kỳ trước';
        color = up == goodWhenUp ? AppColors.success : AppColors.danger;
      }
    }
    return Text(text,
        maxLines: 2, style: TextStyle(fontSize: 11.5, color: color));
  }
}

/// Một danh mục trong báo cáo, kèm các khoản thuộc danh mục đó.
class _CategoryRow {
  _CategoryRow(this.name, this.amount, this.previous, this.entries);

  final String name;
  final double amount;
  final double previous;
  final List<ReportEntry> entries;

  static List<_CategoryRow> build(
      List<ReportEntry> entries, String type, Map<String, double> previous) {
    final groups = <String, List<ReportEntry>>{};
    for (final entry in entries) {
      if (entry.type == type) {
        groups.putIfAbsent(entry.categoryName, () => []).add(entry);
      }
    }
    final rows = [
      for (final group in groups.entries)
        _CategoryRow(
          group.key,
          group.value.fold<double>(0, (sum, entry) => sum + entry.amount),
          // API tổng hợp ghi khoản không danh mục là "Khác".
          previous[group.key] ??
              (group.key == ReportEntry.uncategorized
                  ? previous['Khác'] ?? 0
                  : 0),
          group.value,
        ),
    ];
    rows.sort((a, b) => b.amount.compareTo(a.amount));
    return rows;
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard(
      {required this.rows, required this.isExpense, required this.onOpen});

  final List<_CategoryRow> rows;
  final bool isExpense;
  final ValueChanged<_CategoryRow> onOpen;

  /// Trùng cách tô màu của [buildSlices]: danh mục bị gom vào "Khác" có màu xám.
  Color _colorOf(int index) {
    if (rows.length <= 6 || index < 5) {
      return chartPalette[index % chartPalette.length];
    }
    return const Color(0xFF9AA5B8);
  }

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return AppCard(
        child: Row(
          children: [
            const IconBadge(icon: Icons.donut_large, color: AppColors.blue),
            const SizedBox(width: Space.sm),
            Expanded(
              child: Text(
                isExpense
                    ? 'Chưa có khoản chi nào trong kỳ này.'
                    : 'Chưa có khoản thu nào trong kỳ này.',
                style: const TextStyle(fontSize: 14, color: AppColors.muted),
              ),
            ),
          ],
        ),
      );
    }
    final total = rows.fold<double>(0, (sum, row) => sum + row.amount);
    return AppCard(
      padding:
          const EdgeInsets.fromLTRB(Space.md, Space.md, Space.xs, Space.xs),
      child: Column(
        children: [
          DonutChart(
            slices: buildSlices(
                [for (final row in rows) CategoryAmount(row.name, row.amount)]),
            centerLabel: isExpense ? 'Tổng chi' : 'Tổng thu',
            centerValue: formatMoney(total),
          ),
          const SizedBox(height: Space.sm),
          for (var i = 0; i < rows.length; i++)
            _CategoryTile(
              row: rows[i],
              share: total <= 0 ? 0 : rows[i].amount / total,
              color: _colorOf(i),
              isExpense: isExpense,
              onTap: () => onOpen(rows[i]),
            ),
        ],
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.row,
    required this.share,
    required this.color,
    required this.isExpense,
    required this.onTap,
  });

  final _CategoryRow row;
  final double share;
  final Color color;
  final bool isExpense;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          row.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 14.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: Space.xs),
                      Text(formatMoney(row.amount),
                          style: moneyStyle.copyWith(
                              fontSize: 14.5, color: AppColors.ink)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.pill),
                    child: LinearProgressIndicator(
                      value: share,
                      minHeight: 6,
                      color: color,
                      backgroundColor: const Color(0xFFE9EDF3),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${(share * 100).round()}%${row.entries.isEmpty ? '' : ' · ${row.entries.length} khoản'}'
                    '${isExpense ? _changeText() : ''}',
                    style: AppText.caption,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.subtle),
          ],
        ),
      ),
    );
  }

  String _changeText() {
    if (row.previous <= 0) return '';
    final delta = (row.amount - row.previous) / row.previous * 100;
    if (delta.abs() < 0.5) return '';
    return ' · ${delta > 0 ? 'tăng' : 'giảm'} ${delta.abs().toStringAsFixed(0)}%';
  }
}

class _InsightCard extends StatelessWidget {
  const _InsightCard({
    required this.total,
    required this.period,
    required this.rows,
    required this.entries,
  });

  final double total;
  final ReportPeriod period;
  final List<_CategoryRow> rows;
  final List<ReportEntry> entries;

  @override
  Widget build(BuildContext context) {
    final days = period.days;
    final top = rows.first;
    final daily = <DateTime, double>{};
    for (final entry in entries) {
      final date = entry.date;
      if (entry.isIncome || date == null) continue;
      final day = DateTime(date.year, date.month, date.day);
      daily[day] = (daily[day] ?? 0) + entry.amount;
    }
    MapEntry<DateTime, double>? peak;
    for (final day in daily.entries) {
      if (peak == null || day.value > peak.value) peak = day;
    }
    return AppCard(
      child: Column(
        children: [
          _InsightRow(
            icon: Icons.calendar_today_outlined,
            color: AppColors.blue,
            label: 'Trung bình mỗi ngày',
            value: formatMoney(total / days),
          ),
          _InsightRow(
            icon: Icons.local_fire_department_outlined,
            color: AppColors.danger,
            label: 'Chi nhiều nhất: ${top.name}',
            value: formatMoney(top.amount),
          ),
          if (peak != null)
            _InsightRow(
              icon: Icons.event_outlined,
              color: AppColors.amber,
              label: 'Ngày chi nhiều nhất: '
                  '${formatDate(peak.key)}',
              value: formatMoney(peak.value),
            ),
        ],
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          IconBadge(icon: icon, color: color, size: 36),
          const SizedBox(width: Space.sm),
          Expanded(
            child: Text(label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13.5, color: AppColors.ink)),
          ),
          const SizedBox(width: Space.xs),
          Text(value,
              style: moneyStyle.copyWith(fontSize: 14, color: AppColors.ink)),
        ],
      ),
    );
  }
}
