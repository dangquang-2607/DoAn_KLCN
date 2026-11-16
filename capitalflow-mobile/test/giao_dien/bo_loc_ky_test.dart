import 'package:capitalflow_mobile/chuc_nang/bao_cao/bo_loc_ky.dart';
import 'package:capitalflow_mobile/chuc_nang/bao_cao/ky_bao_cao.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Calendar history stops at the first reporting date',
      (tester) async {
    final firstDate = DateTime(2026, 8, 30);
    final cases = [
      (ReportPeriodMode.day, DateTime(2026, 8, 31), 1, firstDate),
      (ReportPeriodMode.week, DateTime(2026, 8, 31), 1, firstDate),
      (
        ReportPeriodMode.month,
        DateTime(2026, 10, 31),
        2,
        DateTime(2026, 8, 31)
      ),
      (
        ReportPeriodMode.quarter,
        DateTime(2026, 11, 15),
        1,
        DateTime(2026, 9, 30)
      ),
      (
        ReportPeriodMode.year,
        DateTime(2026, 11, 15),
        0,
        DateTime(2026, 11, 15)
      ),
    ];

    for (final (mode, through, offset, end) in cases) {
      final filter = ReportPeriodFilterController(through: through, mode: mode);
      addTearDown(filter.dispose);

      filter.shift(offset);
      expect(filter.period.start, firstDate, reason: mode.name);
      expect(filter.period.end, end, reason: mode.name);

      filter.shift(1);
      expect(filter.period.start, firstDate, reason: mode.name);
      expect(filter.period.end, end, reason: mode.name);
    }
  });

  testWidgets(
      'All transactions hides the return button while past and custom periods show it',
      (tester) async {
    final through = DateTime(2026, 11, 15);
    final filter = ReportPeriodFilterController(
      through: through,
      mode: ReportPeriodMode.month,
    );
    addTearDown(filter.dispose);
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(MaterialApp(
      home: ListenableBuilder(
        listenable: filter,
        builder: (context, _) => Scaffold(
          appBar:
              AppBar(actions: [ReportPeriodFilterButton(controller: filter)]),
          body: Align(
            alignment: Alignment.topCenter,
            child: ReportPeriodFilterStrip(controller: filter),
          ),
        ),
      ),
    ));

    final returnButton = find.byTooltip('Về kỳ hiện tại');
    filter.shift(1);
    await tester.pumpAndSettle();
    expect(returnButton, findsOneWidget);

    Future<void> chooseMode(String mode) async {
      await tester.tap(find.byTooltip('Khoảng thời gian'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(mode));
      await tester.pumpAndSettle();
    }

    await chooseMode('Tất cả');
    expect(find.text('TẤT CẢ CÁC GIAO DỊCH'), findsOneWidget);
    expect(returnButton, findsNothing);

    await chooseMode('Tùy chỉnh');
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text('Chọn ngày').first);
      await tester.pumpAndSettle();
      final calendar =
          tester.widget<CalendarDatePicker>(find.byType(CalendarDatePicker));
      expect(calendar.firstDate, DateTime(2026, 8, 30));
      expect(calendar.lastDate, through);
      await tester.tap(find.text('Chọn'));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.text('Xong'));
    await tester.pumpAndSettle();
    expect(returnButton, findsOneWidget);
  });
}
