import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import 'ky_tuy_chinh.dart';
import 'ky_bao_cao.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

final _firstReportDate = DateTime(1900);

class ReportPeriodFilterController extends ChangeNotifier {
  ReportPeriodFilterController({
    required DateTime through,
    required ReportPeriodMode mode,
  })  : through = DateUtils.dateOnly(through),
        _mode = mode,
        _lastCalendarMode = mode.isCalendar ? mode : ReportPeriodMode.month;

  final DateTime through;
  final _history = ScrollController(keepScrollOffset: false);
  GlobalKey _selectedTab = GlobalKey();
  ReportPeriodMode _mode;
  ReportPeriodMode _lastCalendarMode;
  ReportPeriod? _customPeriod;
  int _offset = 0;

  ReportPeriodMode get mode => _mode;
  bool get all => mode == ReportPeriodMode.all;
  bool get isCurrent => _offset == 0;

  ReportPeriod get period {
    if (mode.isCalendar) return _calendarPeriod(_offset);
    return (all ? null : _customPeriod) ?? ReportPeriod(through, through);
  }

  ReportPeriod periodWithBounds(DateTime? start, DateTime? end) =>
      all && start != null && end != null ? ReportPeriod(start, end) : period;

  ReportPeriod _calendarPeriod(int offset) {
    final anchor = shiftReportAnchor(mode, through, -offset);
    final bounds = resolveReportPeriod(mode, anchor);
    return ReportPeriod(bounds.start, offset == 0 ? through : bounds.end);
  }

  void shift(int delta) {
    if (!mode.isCalendar) return;
    final offset = _offset + delta;
    if (offset >= 0 && offset < _historyLength) _select(mode, offset: offset);
  }

  void _select(ReportPeriodMode next, {int offset = 0, ReportPeriod? custom}) {
    if (mode == next && _offset == offset && custom == null) return;
    if ((mode != next || offset == 0) && _history.hasClients) {
      _history.jumpTo(0);
    }
    _mode = next;
    _offset = offset;
    _selectedTab = GlobalKey();
    if (custom != null) _customPeriod = custom;
    if (mode.isCalendar) _lastCalendarMode = mode;
    notifyListeners();
    if (offset > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final context = _selectedTab.currentContext;
        if (context != null && context.mounted) {
          Scrollable.ensureVisible(context, alignment: 0.5);
        }
      });
    }
  }

  int get _historyLength {
    final days = ReportPeriod(_firstReportDate, through).days;
    final years = through.year - _firstReportDate.year;
    return switch (mode) {
      ReportPeriodMode.day => days,
      ReportPeriodMode.week => (days - 1) ~/ 7 + 1,
      ReportPeriodMode.month => years * 12 + through.month,
      ReportPeriodMode.quarter => years * 4 + (through.month - 1) ~/ 3 + 1,
      ReportPeriodMode.year => years + 1,
      _ => 1,
    };
  }

  String _historyLabel(int offset) {
    final period = _calendarPeriod(offset);
    final start = period.start;
    return switch (mode) {
      ReportPeriodMode.day => switch (offset) {
          0 => 'HÔM NAY',
          1 => 'HÔM QUA',
          _ => formatDate(start),
        },
      ReportPeriodMode.week => switch (offset) {
          0 => 'TUẦN NÀY',
          1 => 'TUẦN TRƯỚC',
          _ => _periodLabel(period),
        },
      ReportPeriodMode.month => switch (offset) {
          0 => 'THÁNG NÀY',
          1 => 'THÁNG TRƯỚC',
          _ => '${start.month.toString().padLeft(2, '0')}/${start.year}',
        },
      ReportPeriodMode.quarter =>
        'Q${(start.month - 1) ~/ 3 + 1}/${start.year}',
      ReportPeriodMode.year => switch (offset) {
          0 => 'NĂM NAY',
          1 => 'NĂM TRƯỚC',
          _ => '${start.year}',
        },
      _ => throw StateError('Calendar mode required'),
    };
  }

  @override
  void dispose() {
    _history.dispose();
    super.dispose();
  }
}

String _periodLabel(ReportPeriod period) =>
    '${formatDate(period.start)} – ${formatDate(period.end)}';

Future<void> _chooseDates(
    BuildContext context, ReportPeriodFilterController controller) async {
  final range = await pushScreen<ReportPeriod>(
      context,
      CustomReportPeriodScreen(
        firstDate: _firstReportDate,
        lastDate: controller.through,
        initialPeriod: controller._customPeriod,
      ));
  if (range != null && context.mounted) {
    controller._select(ReportPeriodMode.custom, custom: range);
  }
}

class ReportPeriodFilterButton extends StatelessWidget {
  const ReportPeriodFilterButton({super.key, required this.controller});

  final ReportPeriodFilterController controller;

  Future<void> _chooseMode(BuildContext context) async {
    final mode = await showModalBottomSheet<ReportPeriodMode>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: false,
      backgroundColor: AppColors.surface,
      constraints: BoxConstraints(
          maxWidth: 420, maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      builder: (context) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Space.md),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Khoảng thời gian',
                style: AppText.section, textAlign: TextAlign.center),
            const SizedBox(height: Space.md),
            for (final item in ReportPeriodMode.values) ...[
              Semantics(
                selected: item == controller.mode,
                child: TextButton(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(48, 52),
                    backgroundColor: item == controller.mode
                        ? AppColors.line
                        : AppColors.surfaceMuted,
                    foregroundColor: AppColors.ink,
                    shape: const StadiumBorder(),
                  ),
                  onPressed: () => Navigator.of(context).pop(item),
                  child: Text(item.label,
                      style: Theme.of(context).textTheme.labelLarge),
                ),
              ),
              if (item != ReportPeriodMode.custom)
                const SizedBox(height: Space.xs),
            ],
          ]),
        ),
      ),
    );
    if (mode == null || !context.mounted) return;
    if (mode == ReportPeriodMode.custom) {
      await _chooseDates(context, controller);
    } else {
      controller._select(mode);
    }
  }

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: 'Khoảng thời gian',
        onPressed: () => _chooseMode(context),
        icon: const Icon(Icons.calendar_month_outlined),
      );
}

class ReportPeriodFilterStrip extends StatelessWidget {
  const ReportPeriodFilterStrip({super.key, required this.controller});

  final ReportPeriodFilterController controller;

  @override
  Widget build(BuildContext context) {
    final mode = controller.mode;
    final height =
        math.max(52.0, MediaQuery.textScalerOf(context).scale(15) + 26);
    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(children: [
        Expanded(
          child: mode.isCalendar
              ? ListView.builder(
                  key: ValueKey(mode),
                  controller: controller._history,
                  reverse: true,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: Space.xs),
                  itemCount: controller._historyLength,
                  itemBuilder: (_, index) => _PeriodTab(
                    key: index == controller._offset
                        ? controller._selectedTab
                        : null,
                    label: controller._historyLabel(index),
                    selected: index == controller._offset,
                    onTap: () => controller._select(mode, offset: index),
                  ),
                )
              : Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: _PeriodTab(
                    label: controller.all
                        ? 'TẤT CẢ CÁC GIAO DỊCH'
                        : _periodLabel(controller.period),
                    selected: true,
                    onTap: controller.all
                        ? null
                        : () => _chooseDates(context, controller),
                  ),
                ),
        ),
        if (!mode.isCalendar || !controller.isCurrent)
          Padding(
            padding: const EdgeInsetsDirectional.only(end: Space.xs),
            child: IconButton.outlined(
              tooltip: 'Về kỳ hiện tại',
              onPressed: () => controller._select(controller._lastCalendarMode),
              icon: const Icon(Icons.skip_next_rounded),
            ),
          ),
      ]),
    );
  }
}

class _PeriodTab extends StatelessWidget {
  const _PeriodTab(
      {super.key, required this.label, required this.selected, this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        button: onTap != null,
        child: InkWell(
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minWidth: 76),
            padding: const EdgeInsets.symmetric(horizontal: Space.sm),
            decoration: BoxDecoration(
                border: Border(
                    bottom: BorderSide(
              width: 2,
              color: selected ? AppColors.ink : Colors.transparent,
            ))),
            child: Align(
              widthFactor: 1,
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.cardTitle.copyWith(
                      color: selected ? AppColors.ink : AppColors.muted)),
            ),
          ),
        ),
      );
}
