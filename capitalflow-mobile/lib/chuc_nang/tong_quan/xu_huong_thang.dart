import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../du_lieu/mo_hinh.dart';

/// Cùng dữ liệu và cách cộng kỳ báo cáo với trang Tổng quan trên web.
class MonthlyTrendData {
  MonthlyTrendData(
      {required this.through, required this.days, required this.categories});

  final DateTime through;
  final List<Json> days;
  final List<Json> categories;

  factory MonthlyTrendData.fromJson(Json json) {
    final through = parseApiDate(json['through']);
    if (through == null) throw const FormatException('Thiếu ngày báo cáo');
    return MonthlyTrendData(
      through: through,
      days: asJsonList(json['days']),
      categories: asJsonList(json['expense_categories']),
    );
  }

  DateTime get monthStart => DateTime(through.year, through.month);

  DateTime periodStart(bool week) => week
      ? DateTime(through.year, through.month, through.day - through.weekday + 1)
      : monthStart;

  double total(String metric, {bool week = false, bool previous = false}) {
    final start = periodStart(week);
    final from = previous
        ? (week
            ? DateTime(start.year, start.month, start.day - 7)
            : DateTime(start.year, start.month - 1))
        : start;
    final first = isoDate(from);
    final end = isoDate(
        previous ? DateTime(start.year, start.month, start.day - 1) : through);
    var result = 0.0;
    for (final day in days) {
      final date = day['date'].toString();
      if (date.compareTo(first) >= 0 && date.compareTo(end) <= 0) {
        result += asDouble(day[metric]);
      }
    }
    return result;
  }

  List<Json> rankedCategories(bool week) {
    final metric = week ? 'week' : 'month';
    final ranked =
        categories.where((row) => asDouble(row[metric]) > 0).toList();
    ranked.sort((a, b) {
      final amount = asDouble(b[metric]).compareTo(asDouble(a[metric]));
      return amount == 0
          ? a['name'].toString().compareTo(b['name'].toString())
          : amount;
    });
    return ranked;
  }

  /// Lũy kế từng ngày của tháng này và trung bình ba tháng trước.
  /// Ngày chưa đến được để trống, ngày 31 của tháng ngắn hơn cộng thêm 0.
  List<MonthlyTrendPoint> comparison(String metric) {
    final amounts = {
      for (final day in days) day['date'].toString(): asDouble(day[metric])
    };
    final sums = List<double>.filled(4, 0);
    final months = List.generate(
        4,
        (offset) => isoDate(DateTime(through.year, through.month - offset))
            .substring(0, 7));
    return List.generate(DateTime(through.year, through.month + 1, 0).day,
        (index) {
      final day = index + 1;
      final suffix = day.toString().padLeft(2, '0');
      for (var month = 0; month < months.length; month++) {
        sums[month] += amounts['${months[month]}-$suffix'] ?? 0;
      }
      return MonthlyTrendPoint(
        day: day,
        actual: day <= through.day ? sums[0] : null,
        average: (sums[1] + sums[2] + sums[3]) / 3,
      );
    });
  }
}

class MonthlyTrendPoint {
  const MonthlyTrendPoint(
      {required this.day, required this.actual, required this.average});
  final int day;
  final double? actual;
  final double average;
}
