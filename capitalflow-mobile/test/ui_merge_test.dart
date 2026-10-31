import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:capitalflow_mobile/core/api_client.dart';
import 'package:capitalflow_mobile/core/app_config.dart';
import 'package:capitalflow_mobile/core/theme.dart';
import 'package:capitalflow_mobile/core/token_store.dart';
import 'package:capitalflow_mobile/models/models.dart';
import 'package:capitalflow_mobile/screens/accounts/accounts_screen.dart';
import 'package:capitalflow_mobile/screens/auth/login_screen.dart';
import 'package:capitalflow_mobile/screens/home_shell.dart';
import 'package:capitalflow_mobile/screens/home_tabs.dart';
import 'package:capitalflow_mobile/screens/transactions/transaction_form_screen.dart';
import 'package:capitalflow_mobile/services/app_data.dart';
import 'package:capitalflow_mobile/services/app_settings.dart';
import 'package:capitalflow_mobile/services/auth_controller.dart';
import 'package:capitalflow_mobile/services/local_notifier.dart';
import 'package:capitalflow_mobile/services/notification_center.dart';
import 'package:capitalflow_mobile/services/repositories.dart';

// Fixtures are synthetic; these tests never connect to the real backend.
class Harness {
  final requests = <String>[];
  final captureKey = GlobalKey();
  late SharedPreferences prefs;
  late AppConfig config;
  late AppSettings settings;
  late ApiClient api;
  late AppData data;
  late AuthController auth;
  late NotificationCenter center;
  final tokens = TokenStore();
  final notifier = LocalNotifier();

  Future<void> init() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    config = AppConfig(prefs);
    settings = AppSettings(prefs);
    api = ApiClient(
      config: config,
      tokens: tokens,
      client: MockClient((request) async {
        final path = request.url.path.replaceFirst('/api/v1', '');
        requests.add(path);
        final body = fixture(path);
        return http.Response(jsonEncode(body), 200,
            headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    data = AppData(api);
    auth = AuthController(api: api, tokens: tokens);
    center = NotificationCenter(
      api: api,
      config: config,
      tokens: tokens,
      settings: settings,
      notifier: notifier,
      data: data,
    );
  }

  dynamic fixture(String path) {
    final now = DateTime.now();
    switch (path) {
      case '/wallets':
        return [
          {
            'id': 'cash',
            'name': 'Ví mặc định',
            'balance': '2500000.00',
            'currency': 'VND',
            'is_active': true,
            'is_default': true,
            'receive_code': 'demo@example.com'
          },
          {
            'id': 'bank',
            'name': 'Quỹ tiết kiệm',
            'balance': '10000000.00',
            'currency': 'VND',
            'is_active': true,
            'is_default': false,
            'receive_code': 'CF-7K9M2P4R'
          },
        ];
      case '/categories':
        return [
          {'id': 'food', 'name': 'Ăn uống', 'type': 'EXPENSE'}
        ];
      case '/bookkeeping/dashboard':
        return {
          'net_worth': 12500000,
          'income_this_month': 18000000,
          'expense_this_month': 5500000,
          'net_cash_flow': 12500000,
          'period': {'month': now.month, 'year': now.year},
          'recent_transactions': [
            {
              'id': 't1',
              'description': 'Ăn trưa',
              'amount': -45000,
              'type': 'EXPENSE',
              'transaction_date': '2026-10-23'
            },
          ],
        };
      case '/analytics':
        return {
          'summary': {'income': 18000000, 'expense': 5500000, 'net': 12500000},
          'previous_summary': {'income': 16000000, 'expense': 6000000},
          'expense_by_category': {
            'Ăn uống': 3000000,
            'Di chuyển': 1500000,
            'Mua sắm': 1000000
          },
          'trend': [
            {'month': 'Tháng 8/2026', 'income': 15000000, 'expense': 7000000},
            {'month': 'Tháng 9/2026', 'income': 16000000, 'expense': 6000000},
            {'month': 'Tháng 10/2026', 'income': 18000000, 'expense': 5500000},
          ],
        };
      case '/budgets':
        return [
          {
            'budget_id': 'b1',
            'budget_name': 'Ăn uống',
            'category_id': 'food',
            'amount_limit': 4000000,
            'period_type': 'MONTHLY',
            'start_date':
                '${now.year}-${now.month.toString().padLeft(2, '0')}-01',
            'end_date': '${now.year}-12-31',
            'warning_percent': 80,
            'spent_amount': 3000000,
            'remaining_amount': 1000000,
            'usage_percent': 75,
            'progress_status': 'SAFE'
          },
        ];
      case '/bookkeeping':
        return {'items': [], 'total': 0, 'page': 1, 'page_size': 30};
      case '/notifications':
        return {'items': [], 'total': 7, 'unread_count': 7};
      default:
        throw StateError('Unexpected request in UI test: $path');
    }
  }

  Widget app({Widget home = const HomeShell(), double textScale = 1}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AppConfig>.value(value: config),
        ChangeNotifierProvider<AppSettings>.value(value: settings),
        ChangeNotifierProvider<AppData>.value(value: data),
        ChangeNotifierProvider<AuthController>.value(value: auth),
        ChangeNotifierProvider<NotificationCenter>.value(value: center),
        Provider<ApiClient>.value(value: api),
        Provider<LocalNotifier>.value(value: notifier),
      ],
      child: RepaintBoundary(
        key: captureKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          locale: const Locale('vi'),
          supportedLocales: const [Locale('vi')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: home,
        ),
      ),
    );
  }

  Future<void> capture(WidgetTester tester, String name) async {
    if (!const bool.fromEnvironment('CAPTURE_UI')) return;
    final boundary =
        captureKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('build/ui-review/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  void dispose() {
    center.dispose();
    auth.dispose();
    data.dispose();
    config.dispose();
    settings.dispose();
    api.close();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Harness harness;

  setUpAll(() async {
    // Optional readable captures on Windows; normal tests use Flutter's test font.
    if (const bool.fromEnvironment('CAPTURE_UI')) {
      await (FontLoader('MaterialIcons')
            ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
          .load();
      final windows = Platform.environment['WINDIR'];
      if (windows != null) {
        final font = File('$windows/Fonts/arial.ttf');
        if (await font.exists()) {
          await (FontLoader('Ahem')
                ..addFont(font.readAsBytes().then(ByteData.sublistView)))
              .load();
          await (FontLoader('Roboto')
                ..addFont(font.readAsBytes().then(ByteData.sublistView)))
              .load();
        }
      }
    }
  });

  setUp(() async {
    harness = Harness();
    await harness.init();
  });

  tearDown(() => harness.dispose());

  Future<void> mount(WidgetTester tester,
      {Size size = const Size(390, 844),
      double textScale = 1,
      Widget home = const HomeShell()}) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = size;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(harness.app(home: home, textScale: textScale));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'Dashboard shows wallet utilities instead of balance card and trend chart',
      (tester) async {
    await harness.settings.rememberNotifications('server:user', ['n1']);
    await mount(tester);
    for (final label in ['Nạp/Rút', 'Nhận tiền', 'QR thanh toán', 'Ví tiện ích']) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('Tổng tài sản'), findsNothing);
    expect(find.text('Xu hướng thu chi'), findsNothing);
    await harness.capture(tester, 'dashboard');
    await tester.tap(find.text('Ví tiện ích'));
    await tester.pumpAndSettle();
    expect(find.byType(AccountsScreen), findsOneWidget);
    final restored = AppSettings(harness.prefs);
    expect(restored.deliveredNotifications('server:user'), ['n1']);
    restored.dispose();
  });

  testWidgets(
      'New navigation preserves lazy tabs and defers refresh of hidden tabs',
      (tester) async {
    await mount(tester);
    expect(harness.requests.where((p) => p == '/bookkeeping'), isEmpty);
    expect(harness.requests.where((p) => p == '/wallets').length, 1);
    await tester.tap(find.text('Giao dịch'));
    await tester.pumpAndSettle();
    final before = harness.requests.where((p) => p == '/bookkeeping').length;
    expect(before, 1);
    await tester.tap(find.text('Tổng quan'));
    await tester.pumpAndSettle();
    await harness.data.markChanged();
    await tester.pumpAndSettle();
    expect(harness.requests.where((p) => p == '/bookkeeping').length, before);
    await tester.tap(find.text('Giao dịch'));
    await tester.pumpAndSettle();
    expect(
        harness.requests.where((p) => p == '/bookkeeping').length, before + 1);
    expect(homeTab.value, HomeTabs.transactions);
  });

  testWidgets(
      'Fan menu merges income/expense into one action and adds QR scan',
      (tester) async {
    await mount(tester);
    await tester.tap(find.byTooltip('Thao tác nhanh'));
    await tester.pumpAndSettle();
    for (final label in [
      'Ghi thu chi',
      'Chụp hóa đơn',
      'Quét QR',
      'Ảnh hóa đơn',
      'Chuyển ví'
    ]) {
      expect(find.text(label), findsWidgets);
    }
    expect(find.text('Ghi chi'), findsNothing);
    expect(find.text('Ghi thu'), findsNothing);
    await harness.capture(tester, 'quick-actions');
    await tester.tap(find.text('Ghi thu chi').last);
    await tester.pumpAndSettle();
    expect(find.byType(TransactionFormScreen), findsOneWidget);
    expect(
        tester
            .widget<TransactionFormScreen>(find.byType(TransactionFormScreen))
            .initialType,
        'EXPENSE');
  });

  testWidgets('Dashboard and fan fit a small phone with enlarged text',
      (tester) async {
    await mount(tester, size: const Size(320, 740), textScale: 1.3);

    final scroll = find.byType(CustomScrollView).first;
    for (var i = 0; i < 6; i++) {
      await tester.drag(scroll, const Offset(0, -430));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byTooltip('Thao tác nhanh'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Đóng'));
    await tester.pumpAndSettle();
  });

  testWidgets('Login keeps validation with the imported design',
      (tester) async {
    await mount(tester, home: const LoginScreen());
    await harness.capture(tester, 'login');
    await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập địa chỉ email hợp lệ.'), findsOneWidget);
    expect(harness.requests, isEmpty);
  });

  test(
      'Backend notification contract and invoice duplicate metadata remain intact',
      () async {
    final notification = AppNotification.fromJson({
      'id': 'n1',
      'kind': 'BUDGET_WARNING',
      'severity': 'WARNING',
      'title': 'Ngân sách',
      'message': 'Sắp chạm hạn mức',
      'read_at': '2026-10-23T01:00:00',
      'source_type': 'BUDGET',
      'source_id': 'b1',
    });
    expect(notification.body, 'Sắp chạm hạn mức');
    expect(notification.isRead, isTrue);
    expect(notification.entityType, 'budget');
    expect((await NotificationRepository(harness.api).list()).unread, 7);
    final invoice = InvoiceSummary.fromJson({
      'id': 'i1',
      'status': 'CONFIRMED',
      'revision': 4,
      'deleted_at': '2026-10-23T01:00:00',
      'duplicate_level': 'EXACT',
      'duplicate_of_invoice_id': 'original',
      'transaction_id': 't1',
    });
    expect(invoice.revision, 4);
    expect(invoice.hidden, isTrue);
    expect(invoice.duplicateLevel, 'EXACT');
    expect(invoice.transactionId, 't1');
  });
}
