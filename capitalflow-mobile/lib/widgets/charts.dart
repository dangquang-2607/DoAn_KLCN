import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';

/// Biểu đồ tự vẽ bằng CustomPainter để trực quan hóa tình hình tài chính
/// (không phụ thuộc thư viện ngoài).

/// Bảng màu luân phiên cho các lát của biểu đồ cơ cấu chi tiêu.
const List<Color> chartPalette = [
  Color(0xFF2454E6),
  Color(0xFFDF6C2F),
  Color(0xFF0F9F8F),
  Color(0xFFD14B62),
  Color(0xFFD48A08),
  Color(0xFF198EC8),
  Color(0xFF2F8F61),
  Color(0xFF42536A),
];

class ChartSlice {
  const ChartSlice({required this.label, required this.value, required this.color});

  final String label;
  final double value;
  final Color color;
}

/// Gom các danh mục nhỏ thành "Khác" để biểu đồ tròn không quá vụn.
List<ChartSlice> buildSlices(List<CategoryAmount> categories, {int maxSlices = 6}) {
  final slices = <ChartSlice>[];
  var other = 0.0;
  for (var i = 0; i < categories.length; i++) {
    if (i < maxSlices - 1 || categories.length <= maxSlices) {
      slices.add(ChartSlice(
        label: categories[i].name,
        value: categories[i].amount,
        color: chartPalette[slices.length % chartPalette.length],
      ));
    } else {
      other += categories[i].amount;
    }
  }
  if (other > 0) {
    slices.add(ChartSlice(label: 'Khác', value: other, color: const Color(0xFF9AA5B8)));
  }
  return slices;
}

/// Biểu đồ vành khuyên thể hiện cơ cấu chi tiêu theo danh mục.
class DonutChart extends StatelessWidget {
  const DonutChart({
    super.key,
    required this.slices,
    required this.centerLabel,
    required this.centerValue,
    this.size = 170,
  });

  final List<ChartSlice> slices;
  final String centerLabel;
  final String centerValue;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _DonutPainter(slices),
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(size * 0.2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(centerLabel, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(centerValue, style: moneyStyle.copyWith(fontSize: 17, color: AppColors.ink)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.slices);

  final List<ChartSlice> slices;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * 0.13;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: (size.shortestSide - stroke) / 2,
    );
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0xFFE9EDF3);
    canvas.drawArc(rect, 0, math.pi * 2, false, track);

    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    if (total <= 0) return;

    // Chừa khe hở nhỏ giữa các lát để dễ phân biệt.
    final gap = slices.length > 1 ? 0.035 : 0.0;
    var start = -math.pi / 2;
    for (final slice in slices) {
      final sweep = slice.value / total * math.pi * 2;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt
        ..color = slice.color;
      final visible = sweep - gap;
      if (visible > 0) canvas.drawArc(rect, start + gap / 2, visible, false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) => oldDelegate.slices != slices;
}

/// Biểu đồ cột đôi thu/chi theo tháng.
class TrendBarChart extends StatelessWidget {
  const TrendBarChart({super.key, required this.points, this.height = 190});

  final List<TrendPoint> points;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _TrendPainter(points)),
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.points);

  final List<TrendPoint> points;

  static const double _axisWidth = 44;
  static const double _labelHeight = 22;

  void _text(Canvas canvas, String text, Offset offset, {double width = 60, TextAlign align = TextAlign.left}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: const TextStyle(fontSize: 10.5, color: AppColors.muted)),
      textAlign: align,
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(minWidth: width, maxWidth: width);
    painter.paint(canvas, offset);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final chartHeight = size.height - _labelHeight - 6;
    final chartWidth = size.width - _axisWidth;
    if (chartHeight <= 0 || chartWidth <= 0) return;

    var maxValue = 0.0;
    for (final point in points) {
      maxValue = math.max(maxValue, math.max(point.income, point.expense));
    }
    if (maxValue <= 0) maxValue = 1;

    // Lưới ngang và nhãn trục tung.
    final grid = Paint()
      ..color = const Color(0xFFE9EDF3)
      ..strokeWidth = 1;
    const steps = 3;
    for (var i = 0; i <= steps; i++) {
      final y = 6 + chartHeight - chartHeight * i / steps;
      canvas.drawLine(Offset(_axisWidth, y), Offset(size.width, y), grid);
      _text(
        canvas,
        formatCompact(maxValue * i / steps),
        Offset(0, y - 7),
        width: _axisWidth - 6,
        align: TextAlign.right,
      );
    }

    final slot = chartWidth / points.length;
    final barWidth = math.min(16.0, slot * 0.28);
    final incomePaint = Paint()..color = AppColors.success;
    final expensePaint = Paint()..color = AppColors.danger;

    for (var i = 0; i < points.length; i++) {
      final point = points[i];
      final center = _axisWidth + slot * i + slot / 2;
      final baseY = 6 + chartHeight;

      void bar(double value, double left, Paint paint) {
        final barHeight = value <= 0 ? 0.0 : math.max(2.0, chartHeight * value / maxValue);
        if (barHeight <= 0) return;
        final rect = RRect.fromRectAndCorners(
          Rect.fromLTWH(left, baseY - barHeight, barWidth, barHeight),
          topLeft: const Radius.circular(4),
          topRight: const Radius.circular(4),
        );
        canvas.drawRRect(rect, paint);
      }

      bar(point.income, center - barWidth - 2, incomePaint);
      bar(point.expense, center + 2, expensePaint);
      _text(canvas, point.label, Offset(center - slot / 2, baseY + 6), width: slot, align: TextAlign.center);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) => oldDelegate.points != points;
}

/// Chú thích màu của biểu đồ.
class LegendDot extends StatelessWidget {
  const LegendDot({super.key, required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
      ],
    );
  }
}
