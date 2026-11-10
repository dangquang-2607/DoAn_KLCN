import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import 'ky_bao_cao.dart';

class CustomReportPeriodScreen extends StatefulWidget {
  const CustomReportPeriodScreen({
    super.key,
    required this.firstDate,
    required this.lastDate,
    this.initialPeriod,
  });

  final DateTime firstDate;
  final DateTime lastDate;
  final ReportPeriod? initialPeriod;

  @override
  State<CustomReportPeriodScreen> createState() =>
      _CustomReportPeriodScreenState();
}

class _CustomReportPeriodScreenState extends State<CustomReportPeriodScreen> {
  late DateTime? _start = widget.initialPeriod?.start;
  late DateTime? _end = widget.initialPeriod?.end;

  Future<void> _pickDate({required bool start}) async {
    final initial =
        (start ? _start ?? _end : _end ?? _start) ?? widget.lastDate;
    var selected = initial;
    final picked = await showDialog<DateTime>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
              horizontal: Space.md, vertical: Space.xl),
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md)),
          child: SizedBox(
            width: 360,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        Space.lg, Space.md, Space.lg, 0),
                    child: Text(
                        start ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc',
                        style: AppText.caption),
                  ),
                  DatePickerTheme(
                    data: theme.datePickerTheme.copyWith(
                        toggleButtonTextStyle: theme.textTheme.labelLarge),
                    child: CalendarDatePicker(
                      calendarDelegate: const _CompactCalendar(),
                      firstDate: widget.firstDate,
                      lastDate: widget.lastDate,
                      currentDate: widget.lastDate,
                      initialDate: initial,
                      onDateChanged: (date) => selected = date,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        Space.xs, 0, Space.xs, Space.xs),
                    child: OverflowBar(
                      alignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                            onPressed: () => Navigator.of(dialogContext).pop(),
                            child: const Text('Hủy')),
                        TextButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(selected),
                            child: const Text('Chọn')),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (start) {
        _start = picked;
      } else {
        _end = picked;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final start = _start;
    final end = _end;
    final period =
        start == null || end == null ? null : ReportPeriod(start, end);
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        centerTitle: true,
        title: const Text('Tùy chỉnh'),
        leading: Center(
          child: IconButton.filledTonal(
            tooltip: 'Quay lại',
            onPressed: () => Navigator.of(context).pop(),
            style:
                IconButton.styleFrom(backgroundColor: AppColors.surfaceMuted),
            icon: const Icon(Icons.chevron_left_rounded),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: Space.xs),
            child: TextButton(
              onPressed: period?.valid == true
                  ? () => Navigator.of(context).pop(period)
                  : null,
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 40),
                backgroundColor: AppColors.surfaceMuted,
                disabledBackgroundColor: AppColors.surfaceMuted,
                shape: const StadiumBorder(),
              ),
              child: const Text('Xong'),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(Space.screen),
          children: [
            _DateField(
                label: 'Ngày bắt đầu',
                date: start,
                onTap: () => _pickDate(start: true)),
            const SizedBox(height: Space.lg),
            _DateField(
                label: 'Ngày kết thúc',
                date: end,
                onTap: () => _pickDate(start: false)),
            if (period != null && !period.valid) ...[
              const SizedBox(height: Space.sm),
              Text(
                period.start.isAfter(period.end)
                    ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'
                    : 'Chọn khoảng thời gian tối đa 367 ngày.',
                style: AppText.caption.copyWith(color: AppColors.danger),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactCalendar extends GregorianCalendarDelegate {
  const _CompactCalendar();

  @override
  String formatMonthYear(DateTime date, MaterialLocalizations localizations) =>
      'Thg ${date.month}/${date.year}';
}

class _DateField extends StatelessWidget {
  const _DateField(
      {required this.label, required this.date, required this.onTap});

  final String label;
  final DateTime? date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: AppText.cardTitle),
          const SizedBox(height: Space.xs),
          Semantics(
            label: label,
            child: TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 52),
                padding: const EdgeInsets.symmetric(horizontal: Space.md),
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: date == null ? AppColors.muted : AppColors.ink,
                shape: const StadiumBorder(),
              ),
              onPressed: onTap,
              child: Row(children: [
                Expanded(
                    child: Text(date == null ? 'Chọn ngày' : formatDate(date))),
                const Icon(Icons.chevron_right_rounded, size: 20),
              ]),
            ),
          ),
        ],
      );
}
