import 'package:flutter/material.dart';

/// Bảng màu "Swiss Platinum & Cobalt" dùng chung với hai cổng web của CapitalFlow.
class AppColors {
  static const Color background = Color(0xFFF3F5F8);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF172033);
  static const Color muted = Color(0xFF647087);
  static const Color line = Color(0xFFE1E6EE);
  static const Color blue = Color(0xFF2454E6);
  static const Color blueDark = Color(0xFF1940BD);
  static const Color soft = Color(0xFFEDF2FF);
  static const Color success = Color(0xFF087F5B);
  static const Color successSoft = Color(0xFFE6F5EF);
  static const Color danger = Color(0xFFC0394D);
  static const Color dangerSoft = Color(0xFFFBEBEE);
  static const Color warning = Color(0xFF946200);
  static const Color warningSoft = Color(0xFFFFF4DB);
  static const Color amber = Color(0xFFD48A08);
}

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.blue,
      onPrimary: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      error: AppColors.danger,
      outline: AppColors.line,
    );

    final base = ThemeData(colorScheme: scheme, scaffoldBackgroundColor: AppColors.background);

    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: AppColors.ink, displayColor: AppColors.ink),
      dividerColor: AppColors.line,
      splashFactory: InkRipple.splashFactory,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.blue,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size(0, 50),
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.blue,
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.blue,
        foregroundColor: Colors.white,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.soft,
        surfaceTintColor: Colors.transparent,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppColors.blue : AppColors.muted,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? AppColors.blue : AppColors.muted, size: 24);
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.line, thickness: 1, space: 1),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.blue),
    );
  }
}

/// Kiểu chữ số tiền: chữ số có độ rộng đều để các cột thẳng hàng.
const TextStyle moneyStyle = TextStyle(
  fontFeatures: [FontFeature.tabularFigures()],
  letterSpacing: -0.3,
  fontWeight: FontWeight.w700,
);
