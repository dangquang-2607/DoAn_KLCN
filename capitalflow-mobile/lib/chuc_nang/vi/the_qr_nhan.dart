import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../dung_chung/giao_dien/thuong_hieu.dart';

/// Bố cục cố định để ảnh xuất ra đồng nhất trên mọi màn hình.
class ReceiveQrCard extends StatelessWidget {
  const ReceiveQrCard({super.key, required this.info});

  static const width = 320.0;
  static const height = 352.0;

  final ReceiveInfo info;

  String get _maskedCode {
    final code = info.receiveCode;
    final at = code.indexOf('@');
    if (at > 0) return '••••${code.substring(at)}';
    return code.length > 3 ? '••••${code.substring(code.length - 3)}' : '••••';
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: MediaQuery.withNoTextScaling(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: ColoredBox(
            color: const Color(0xFFFFF8DC),
            child: Stack(
              fit: StackFit.expand,
              children: [
                const CustomPaint(painter: _GoldBackdrop()),
                const Positioned(
                  top: 18,
                  left: 0,
                  right: 0,
                  child: Column(
                    children: [
                      CapitalFlowMark(size: 40),
                      SizedBox(height: 4),
                      Text('CapitalFlow',
                          style: TextStyle(
                              color: AppColors.ink,
                              fontSize: 15,
                              fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
                Positioned(
                  top: 91,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE6AD35)),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x22945116),
                              offset: Offset(0, 6),
                              blurRadius: 14),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          QrImageView(
                            data: info.qrPayload,
                            size: 166,
                            padding: const EdgeInsets.all(22),
                            semanticsLabel:
                                'Mã QR nhận tiền vào ${info.walletName}',
                          ),
                          const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: Text('Quét để chuyển tiền',
                                style: TextStyle(
                                    color: AppColors.blueDark,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  top: 284,
                  bottom: 6,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(info.recipientName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: AppColors.ink,
                              fontSize: 17,
                              height: 1.1,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('${info.walletName} · $_maskedCode',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: Color(0xFF594522), fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GoldBackdrop extends CustomPainter {
  const _GoldBackdrop();

  @override
  void paint(Canvas canvas, Size size) {
    final gold = Path()
      ..lineTo(320, 0)
      ..lineTo(320, 222)
      ..quadraticBezierTo(160, 342, 0, 222)
      ..close();
    canvas.drawPath(
        gold,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFFEF9E), Color(0xFFFFD458)],
          ).createShader(const Rect.fromLTWH(0, 0, 320, 280)));
    for (final side in [false, true]) {
      canvas.save();
      if (side) {
        canvas.translate(size.width, 0);
        canvas.scale(-1, 1);
      }
      _coin(canvas, const Offset(42, 72), 11, -.35);
      _coin(canvas, const Offset(27, 122), 14, .4);
      _coin(canvas, const Offset(53, 158), 10, -.2);
      _bag(canvas);
      _coin(canvas, const Offset(23, 246), 15, .3);
      _coin(canvas, const Offset(48, 259), 12, -.2);
      for (final point in [const Offset(59, 52), const Offset(19, 162)]) {
        final sparkle = Path()
          ..moveTo(point.dx, point.dy - 6)
          ..lineTo(point.dx + 3, point.dy)
          ..lineTo(point.dx, point.dy + 6)
          ..lineTo(point.dx - 3, point.dy)
          ..close();
        canvas.drawPath(sparkle, Paint()..color = const Color(0xFFFFFBDE));
      }
      canvas.restore();
    }
  }

  void _bag(Canvas canvas) {
    final bag = Path()
      ..moveTo(32, 178)
      ..quadraticBezierTo(54, 166, 82, 178)
      ..lineTo(72, 198)
      ..cubicTo(109, 235, 94, 269, 55, 269)
      ..cubicTo(17, 269, 10, 232, 43, 198)
      ..close();
    canvas.drawPath(
        bag,
        Paint()
          ..shader = const LinearGradient(
            colors: [Color(0xFFED6B58), Color(0xFFBF3849)],
          ).createShader(const Rect.fromLTWH(20, 176, 80, 94)));
    canvas.drawLine(
        const Offset(42, 198),
        const Offset(73, 198),
        Paint()
          ..color = const Color(0xFFFFCD7B)
          ..strokeWidth = 4
          ..strokeCap = StrokeCap.round);
  }

  void _coin(Canvas canvas, Offset center, double radius, double angle) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(angle);
    final oval = Rect.fromCenter(
        center: Offset.zero, width: radius * 2, height: radius * 1.38);
    canvas.drawOval(oval.shift(const Offset(0, 3)),
        Paint()..color = const Color(0xFFD3952B));
    canvas.drawOval(oval, Paint()..color = const Color(0xFFFFE693));
    canvas.drawOval(
        oval.deflate(2),
        Paint()
          ..color = const Color(0xFFE5A52D)
          ..style = PaintingStyle.stroke);
    canvas.rotate(math.pi / 4);
    canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: 5, height: 5),
        Paint()..color = const Color(0xFFE5A52D));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GoldBackdrop oldDelegate) => false;
}
