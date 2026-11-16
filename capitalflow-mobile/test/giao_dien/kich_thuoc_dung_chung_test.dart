import 'package:capitalflow_mobile/dung_chung/giao_dien/chu_de.dart';
import 'package:capitalflow_mobile/dung_chung/giao_dien/thanh_phan.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Shared controls are compact and grow for larger text',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 740));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const button = Key('confirm');
    const field = Key('amount');
    const picker = Key('category');

    Future<void> mount(double textScale, String label) async {
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(Space.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: Space.xs,
              children: [
                TextField(key: field, decoration: fieldDecoration('Số tiền')),
                PickerField(
                  key: picker,
                  label: 'Danh mục chi',
                  onTap: () {},
                  value: 'Mua sắm',
                ),
                PrimaryButton(key: button, label: label, onPressed: () {}),
              ],
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();
    }

    await mount(1, 'Xác nhận');
    expect(tester.getSize(find.byKey(button)).height, 48);
    expect(tester.getSize(find.byKey(field)).height, inInclusiveRange(48, 52));
    expect(tester.getSize(find.byKey(picker)).height, inInclusiveRange(48, 52));

    const longLabel = 'Xác nhận & ghi nhận khoản chi';
    await mount(1.6, longLabel);
    expect(tester.getSize(find.byKey(button)).height, greaterThan(48));
    expect(find.text(longLabel).hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
