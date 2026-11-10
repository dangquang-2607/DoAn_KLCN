import 'package:flutter/widgets.dart';

/// Raster export of user-web's official `src/app/icon.svg`.
class CapitalFlowMark extends StatelessWidget {
  const CapitalFlowMark({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
        'assets/thuong_hieu/bieu_tuong.png',
        width: size,
        height: size,
        excludeFromSemantics: true,
      );
}
