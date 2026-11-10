enum ReportPeriodMode {
  day('Ngày'),
  week('Tuần'),
  month('Tháng'),
  quarter('Quý'),
  year('Năm'),
  all('Tất cả'),
  custom('Tùy chỉnh');

  const ReportPeriodMode(this.label);

  final String label;
  bool get isCalendar => this != all && this != custom;
}

class ReportPeriod {
  const ReportPeriod(this.start, this.end);
  final DateTime start;
  final DateTime end;
  int get days =>
      DateTime.utc(end.year, end.month, end.day)
          .difference(DateTime.utc(start.year, start.month, start.day))
          .inDays +
      1;
  bool get valid => !start.isAfter(end) && days <= 367;
}

ReportPeriod resolveReportPeriod(ReportPeriodMode mode, DateTime anchor,
    {ReportPeriod? custom}) {
  final day = DateTime(anchor.year, anchor.month, anchor.day);
  switch (mode) {
    case ReportPeriodMode.day:
      return ReportPeriod(day, day);
    case ReportPeriodMode.week:
      final start = DateTime(day.year, day.month, day.day - day.weekday + 1);
      return ReportPeriod(
          start, DateTime(start.year, start.month, start.day + 6));
    case ReportPeriodMode.month:
      return ReportPeriod(
          DateTime(day.year, day.month), DateTime(day.year, day.month + 1, 0));
    case ReportPeriodMode.quarter:
      final first = ((day.month - 1) ~/ 3) * 3 + 1;
      return ReportPeriod(
          DateTime(day.year, first), DateTime(day.year, first + 3, 0));
    case ReportPeriodMode.year:
      return ReportPeriod(DateTime(day.year), DateTime(day.year, 12, 31));
    case ReportPeriodMode.custom:
      return custom ?? ReportPeriod(day, day);
    case ReportPeriodMode.all:
      throw ArgumentError('All-time dates come from the report API.');
  }
}

DateTime shiftReportAnchor(ReportPeriodMode mode, DateTime anchor, int delta) {
  switch (mode) {
    case ReportPeriodMode.day:
      return DateTime(anchor.year, anchor.month, anchor.day + delta);
    case ReportPeriodMode.week:
      return DateTime(anchor.year, anchor.month, anchor.day + delta * 7);
    case ReportPeriodMode.month:
      return DateTime(anchor.year, anchor.month + delta);
    case ReportPeriodMode.quarter:
      return DateTime(anchor.year, anchor.month + delta * 3);
    case ReportPeriodMode.year:
      return DateTime(anchor.year + delta);
    case ReportPeriodMode.custom:
    case ReportPeriodMode.all:
      return anchor;
  }
}
