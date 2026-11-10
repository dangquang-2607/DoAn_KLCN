import 'package:flutter/material.dart';

/// Hệ thống thiết kế CapitalFlow Mobile.
///
/// Nguyên tắc:
/// - Màu theo quy tắc 60-30-10: 60% nền trắng ngà ([AppColors.background]),
///   30% thẻ trắng có viền mảnh ([AppColors.surface] + [AppColors.hairline]),
///   10% màu nhấn cobalt ([AppColors.blue]) chỉ dành cho nút chính, tab đang chọn và điểm nhấn.
/// - Khoảng cách theo lưới 8pt ([Space]).
/// - Bo góc hài hòa ([Radii]) và bóng đổ mềm ([AppShadows]) thay cho elevation mặc định.
/// - Phân cấp chữ bằng độ đậm và độ mờ màu ([AppText]).

// ─────────────────────────────────────────────────────────────────────────────
// Màu sắc
// ─────────────────────────────────────────────────────────────────────────────

class AppColors {
  // 60% — nền
  static const Color background = Color(0xFFF8FAFC);

  // 30% — thẻ và khối nổi
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF1F5F9);

  /// Viền 1px của thẻ: đen 5% — chỉ đủ để tách thẻ khỏi nền.
  static const Color hairline = Color(0x0D000000);

  /// Đường kẻ, viền ô nhập liệu.
  static const Color line = Color(0xFFE2E8F0);

  // Chữ
  static const Color ink = Color(0xFF0F172A);
  static const Color muted = Color(0xFF64748B);
  static const Color subtle = Color(0xFF94A3B8);

  // 10% — màu nhấn thương hiệu (cobalt, dùng chung với bản web)
  static const Color blue = Color(0xFF2454E6);
  static const Color blueDark = Color(0xFF1A3FB8);
  static const Color soft = Color(0xFFEAF0FD); // cobalt 10%

  // Ngữ nghĩa
  // Ngữ nghĩa
  static const Color success = Color(0xFF059669);
  static const Color successSoft = Color(0xFFE7F6F0);
  static const Color danger = Color(0xFFDC2645);
  static const Color dangerSoft = Color(0xFFFDECEF);
  static const Color warning = Color(0xFFB45309);
  static const Color warningSoft = Color(0xFFFEF3E2);
  static const Color amber = Color(0xFFD97706);

  // Thẻ số dư tối (điểm nhấn duy nhất của màn Tổng quan)
  static const Color heroSurface = Color(0xFF111827);
  static const Color heroMuted = Color(0xFF9CA3AF);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bảng màu nóng – lạnh cân xứng
// ─────────────────────────────────────────────────────────────────────────────

/// Sáu sắc độ chia đều hai nhóm: 3 gam lạnh (chàm, ngọc, trời) và 3 gam nóng
/// (cam, hồng san hô, hổ phách). Mỗi màu đi kèm một nền nhạt ~10% để làm ô biểu tượng.
class AppPalette {
  // Gam lạnh
  static const Color indigo = Color(0xFF4F46E5);
  static const Color indigoSoft = Color(0xFFEEF0FF);
  static const Color teal = Color(0xFF0D9488);
  static const Color tealSoft = Color(0xFFE6F6F4);
  static const Color sky = Color(0xFF0284C7);
  static const Color skySoft = Color(0xFFE6F3FB);
  static const Color violet = Color(0xFF7C3AED);
  static const Color violetSoft = Color(0xFFF2ECFE);

  // Gam nóng
  static const Color orange = Color(0xFFEA580C);
  static const Color orangeSoft = Color(0xFFFDEFE6);
  static const Color coral = Color(0xFFE11D48);
  static const Color coralSoft = Color(0xFFFDE9EE);
  static const Color amber = Color(0xFFD97706);
  static const Color amberSoft = Color(0xFFFDF3E1);
  static const Color pink = Color(0xFFDB2777);
  static const Color pinkSoft = Color(0xFFFCE9F3);

  /// Chu kỳ màu xen kẽ lạnh – nóng, dùng cho ví/thẻ để không có hai thẻ liền nhau cùng tông.
  static const List<Color> cycle = [
    indigo,
    orange,
    teal,
    coral,
    sky,
    amber,
    violet,
    pink
  ];
  static const List<Color> cycleSoft = [
    indigoSoft,
    orangeSoft,
    tealSoft,
    coralSoft,
    skySoft,
    amberSoft,
    violetSoft,
    pinkSoft,
  ];

  static Color at(int index) => cycle[index % cycle.length];
  static Color softAt(int index) => cycleSoft[index % cycleSoft.length];
}

/// Dải chuyển màu dùng có chủ đích (mỗi màn tối đa một dải lớn).
class AppGradients {
  /// Thẻ tổng tài sản: chàm → tím, kèm quầng cam ấm ở góc (xem màn Tổng quan).
  static const LinearGradient hero = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B5BF5), Color(0xFF5B3FE0), Color(0xFF8B3FD9)],
    stops: [0.0, 0.55, 1.0],
  );

  /// Nút "+" và logo: cobalt → chàm.
  static const LinearGradient accent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF4F6BFF), Color(0xFF6D3FE6)],
  );

  /// Lớp màu rất nhạt phủ đầu màn Tổng quan: xanh trời (lạnh) → đào (nóng).
  static const LinearGradient headerWash = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFE6EAFF), Color(0xFFF7F6FB), Color(0xFFFFEDE3)],
    stops: [0.0, 0.55, 1.0],
  );

  /// Ô biểu tượng thao tác nhanh: từng cặp màu cùng họ, đậm dần.
  static LinearGradient tile(Color color) => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color.lerp(color, Colors.white, 0.18)!, color],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lưới khoảng cách 8pt
// ─────────────────────────────────────────────────────────────────────────────

class Space {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;

  /// Lề ngang của mọi màn hình.
  static const double screen = 20;

  /// Khoảng trống cuối danh sách để nội dung không bị thanh điều hướng che.
  static const double bottomInset = 32;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bo góc
// ─────────────────────────────────────────────────────────────────────────────

class Radii {
  /// Chip, nhãn, huy hiệu nhỏ.
  static const double chip = 8;

  /// Ô nhập liệu, ô biểu tượng.
  static const double sm = 12;

  /// Thẻ tiêu chuẩn, nút chính.
  static const double md = 16;

  /// Thẻ lớn, thẻ số dư.
  static const double lg = 20;

  /// Bảng trượt, hộp thoại, thanh điều hướng nổi.
  static const double xl = 24;

  static const double pill = 999;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bóng đổ mềm
// ─────────────────────────────────────────────────────────────────────────────

class AppShadows {
  /// Bóng khuếch tán cho thẻ.
  static const List<BoxShadow> soft = [
    BoxShadow(color: Color(0x0A000000), blurRadius: 16, offset: Offset(0, 4)),
  ];

  /// Bóng cho khối nổi (thanh điều hướng, nút thao tác nhanh).
  static const List<BoxShadow> floating = [
    BoxShadow(color: Color(0x14000000), blurRadius: 24, offset: Offset(0, 8)),
  ];

  /// Bóng có màu cho nút nhấn chính.
  static List<BoxShadow> accent(Color color) => [
        BoxShadow(
            color: color.withValues(alpha: 0.32),
            blurRadius: 16,
            offset: const Offset(0, 6)),
      ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Kiểu chữ
// ─────────────────────────────────────────────────────────────────────────────

class AppText {
  /// Con số chính (tổng tài sản): 32sp, w800.
  static const TextStyle heroMetric = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.5,
    height: 1.15,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  /// Tiêu đề màn hình: 26sp, w700.
  static const TextStyle screenTitle = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    height: 1.2,
    color: AppColors.ink,
  );

  /// Tiêu đề nhóm nội dung: 18sp, w600.
  static const TextStyle section = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: AppColors.ink,
  );

  /// Tiêu đề thẻ / dòng chính: 15sp, w600.
  static const TextStyle cardTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// Nội dung chính: 15sp, w500.
  static const TextStyle body = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: AppColors.ink,
  );

  /// Chú thích, mô tả phụ: 13sp, w400, màu xám.
  static const TextStyle caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: AppColors.muted,
  );

  /// Nhãn nhỏ phía trên số liệu: 12sp, w500.
  static const TextStyle label = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.1,
    color: AppColors.muted,
  );
}

/// Kiểu chữ số tiền: chữ số có độ rộng đều để các cột thẳng hàng.
const TextStyle moneyStyle = TextStyle(
  fontFeatures: [FontFeature.tabularFigures()],
  letterSpacing: -0.3,
  fontWeight: FontWeight.w700,
);

// ─────────────────────────────────────────────────────────────────────────────
// ThemeData
// ─────────────────────────────────────────────────────────────────────────────

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.blue,
      onPrimary: Colors.white,
      primaryContainer: AppColors.soft,
      onPrimaryContainer: AppColors.blueDark,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      onSurfaceVariant: AppColors.muted,
      surfaceContainerLowest: AppColors.surface,
      surfaceContainerLow: AppColors.background,
      surfaceContainer: AppColors.surfaceMuted,
      error: AppColors.danger,
      outline: AppColors.line,
      outlineVariant: AppColors.line,
    );

    final base = ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      useMaterial3: true,
    );

    OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(Radii.sm),
          borderSide: BorderSide(color: color, width: width),
        );

    return base.copyWith(
      textTheme: base.textTheme
          .apply(bodyColor: AppColors.ink, displayColor: AppColors.ink),
      dividerColor: AppColors.line,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
            color: AppColors.ink),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          side: const BorderSide(color: AppColors.hairline),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
            horizontal: Space.md, vertical: Space.md),
        labelStyle: const TextStyle(color: AppColors.muted, fontSize: 15),
        floatingLabelStyle:
            const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w600),
        hintStyle: const TextStyle(color: AppColors.subtle, fontSize: 15),
        border: inputBorder(AppColors.line),
        enabledBorder: inputBorder(AppColors.line),
        focusedBorder: inputBorder(AppColors.blue, 1.6),
        errorBorder: inputBorder(AppColors.danger),
        focusedErrorBorder: inputBorder(AppColors.danger, 1.6),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.blue,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.blue.withValues(alpha: 0.4),
          disabledForegroundColor: Colors.white,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: Space.lg),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md)),
          textStyle: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.1),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          backgroundColor: AppColors.surface,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: Space.lg),
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.md)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.blue,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: Space.sm),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.sm)),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(Radii.sm)),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.blue,
        foregroundColor: Colors.white,
        elevation: 2,
        focusElevation: 2,
        hoverElevation: 3,
        highlightElevation: 3,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.md)),
        extendedTextStyle:
            const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: Space.lg),
        minVerticalPadding: Space.sm,
        iconColor: AppColors.muted,
        titleTextStyle: TextStyle(
            fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.ink),
        subtitleTextStyle:
            TextStyle(fontSize: 13, height: 1.4, color: AppColors.muted),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surface,
        selectedColor: AppColors.soft,
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.pill)),
        labelStyle: const TextStyle(
            fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.ink),
        padding: const EdgeInsets.symmetric(
            horizontal: Space.xs, vertical: Space.xxs),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : AppColors.subtle,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.blue
              : AppColors.surfaceMuted,
        ),
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.blue
              : AppColors.line,
        ),
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
          return IconThemeData(
              color: selected ? AppColors.blue : AppColors.muted, size: 24);
        }),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.xl)),
        titleTextStyle: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink),
        contentTextStyle:
            const TextStyle(fontSize: 15, height: 1.45, color: AppColors.muted),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        contentTextStyle: const TextStyle(
            color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
        insetPadding:
            const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.md),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.sm)),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: AppColors.line,
        shape: RoundedRectangleBorder(
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(Radii.xl))),
      ),
      dividerTheme: const DividerThemeData(
          color: AppColors.line, thickness: 0.5, space: 1),
      progressIndicatorTheme:
          const ProgressIndicatorThemeData(color: AppColors.blue),
    );
  }
}
