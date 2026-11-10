import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'chu_de.dart';
import '../../du_lieu/mo_hinh.dart';

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
  const ChartSlice(
      {required this.label, required this.value, required this.color});

  final String label;
  final double value;
  final Color color;
}

/// Gom các danh mục nhỏ thành "Khác" để biểu đồ tròn không quá vụn.
List<ChartSlice> buildSlices(List<CategoryAmount> categories,
    {int maxSlices = 6}) {
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
    slices.add(ChartSlice(
        label: 'Khác', value: other, color: const Color(0xFF9AA5B8)));
  }
  return slices;
}

/// Biểu đồ vành khuyên thể hiện cơ cấu chi tiêu theo danh mục.
class DonutChart extends StatelessWidget {
  const DonutChart({
    super.key,
    required this.slices,
    this.centerLabel,
    this.centerValue,
    this.size = 170,
    this.ringWidth = 0.13,
  });

  final List<ChartSlice> slices;
  final String? centerLabel;
  final String? centerValue;
  final double size;
  final double ringWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: 1),
        duration: const Duration(milliseconds: 900),
        curve: Curves.easeOutCubic,
        builder: (context, progress, child) => CustomPaint(
            painter: _DonutPainter(slices, progress, ringWidth), child: child),
        child: centerLabel == null && centerValue == null
            ? null
            : Center(
                child: Padding(
                  padding: EdgeInsets.all(size * 0.2),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (centerLabel case final label?)
                        Text(label,
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.muted)),
                      const SizedBox(height: 2),
                      if (centerValue case final value?)
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(value,
                              style: moneyStyle.copyWith(
                                  fontSize: 17, color: AppColors.ink)),
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
  _DonutPainter(this.slices, this.progress, this.ringWidth);

  final List<ChartSlice> slices;

  /// Tỉ lệ vẽ (0 → 1) để tạo hiệu ứng vành khuyên quét dần khi xuất hiện.
  final double progress;
  final double ringWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * ringWidth;
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
      final sweep = slice.value / total * math.pi * 2 * progress;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt
        ..color = slice.color;
      final visible = sweep - gap * progress;
      if (visible > 0) {
        canvas.drawArc(rect, start + gap / 2, visible, false, paint);
      }
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.slices != slices ||
      oldDelegate.progress != progress ||
      oldDelegate.ringWidth != ringWidth;
}

/// Thanh ngang xếp chồng thể hiện tỉ trọng của từng phần trong tổng (ví dụ phân bổ tài sản theo ví).
class StackedShareBar extends StatelessWidget {
  const StackedShareBar({super.key, required this.slices, this.height = 14});

  final List<ChartSlice> slices;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total =
        slices.fold<double>(0, (sum, slice) => sum + math.max(0, slice.value));
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: SizedBox(
        height: height,
        child: total <= 0
            ? const ColoredBox(color: Color(0xFFE9EDF3))
            : TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0, end: 1),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (context, progress, _) => Row(
                  children: [
                    for (var i = 0; i < slices.length; i++)
                      if (slices[i].value > 0)
                        Flexible(
                          flex: math.max(
                              1,
                              (slices[i].value / total * 1000 * progress)
                                  .round()),
                          child: Container(
                            margin: EdgeInsets.only(left: i == 0 ? 0 : 2),
                            color: slices[i].color,
                          ),
                        ),
                    if (progress < 1)
                      Flexible(
                        flex: math.max(1, ((1 - progress) * 1000).round()),
                        child: const ColoredBox(
                            color: Color(0xFFE9EDF3), child: SizedBox.expand()),
                      ),
                  ],
                ),
              ),
      ),
    );
  }
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
        Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
                color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Flexible(
            child: Text(label,
                style:
                    const TextStyle(fontSize: 12.5, color: AppColors.muted))),
      ],
    );
  }
}
