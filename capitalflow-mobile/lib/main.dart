import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ha_tang/api.dart';
import 'ha_tang/cau_hinh.dart';
import 'dung_chung/giao_dien/chu_de.dart';
import 'ha_tang/luu_phien.dart';
import 'chuc_nang/xac_thuc/dat_mat_khau_dau.dart';
import 'chuc_nang/xac_thuc/dang_nhap.dart';
import 'ung_dung/khung_chinh.dart';
import 'chuc_nang/thong_bao/danh_sach.dart';
import 'du_lieu/trang_thai.dart';
import 'chuc_nang/thong_bao/tuy_chon.dart';
import 'chuc_nang/xac_thuc/phien_dang_nhap.dart';
import 'chuc_nang/thong_bao/push_android.dart';
import 'chuc_nang/thong_bao/nhac_cuc_bo.dart';
import 'chuc_nang/thong_bao/dong_bo.dart';
import 'dung_chung/giao_dien/thanh_phan.dart';
import 'dung_chung/giao_dien/thuong_hieu.dart';

/// CapitalFlow Mobile — ứng dụng quản lý tài chính cá nhân tích hợp nhận dạng hóa đơn bằng OCR.
///
/// Ứng dụng gọi cùng REST API (FastAPI) với hai cổng web nên dùng chung cơ sở dữ liệu
/// SQL Server; thông báo được đối soát định kỳ qua REST khi app đang mở.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(
      <DeviceOrientation>[DeviceOrientation.portraitUp]);

  final prefs = await SharedPreferences.getInstance();
  final config = AppConfig(prefs);
  final settings = AppSettings(prefs);
  final tokens = TokenStore();
  final api = ApiClient(config: config, tokens: tokens);
  final notifier = LocalNotifier();
  final data = AppData(api);
  final auth = AuthController(api: api, tokens: tokens);
  final businessPush =
      BusinessPush(api, auth, settings, (id) => notifier.onTap?.call(id));
  auth.onSigningOut = () {
    unawaited(businessPush.deactivate());
  };
  final center = NotificationCenter(
    api: api,
    config: config,
    tokens: tokens,
    settings: settings,
    notifier: notifier,
    data: data,
    readBackgroundReceipts: businessPush.delivered,
  );

  // Phiên không thể làm mới → quay về màn đăng nhập.
  api.onSessionExpired = auth.handleSessionExpired;

  auth.onSignedIn = () {
    data.refreshLookups().catchError((Object _) {});
    center.start();
    unawaited(businessPush.openFromNotification());
    final notificationLaunch = notifier.takeLaunchPayload();
    if (notificationLaunch != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        notifier.onTap?.call(notificationLaunch);
      });
    }
    // Xin quyền thông báo (Android 13+) và khôi phục lịch nhắc hằng ngày nếu đang bật.
    notifier.requestPermission().then((granted) {
      if (granted) unawaited(businessPush.sync());
      if (settings.reminderEnabled) {
        notifier.scheduleDailyReminder(
            hour: settings.reminderHour, minute: settings.reminderMinute);
      }
    });
  };

  auth.onSignedOut = () {
    unawaited(businessPush.deactivate());
    center.stop();
    data.clear();
    notifier.cancelDailyReminder();
    // Đóng mọi màn hình con đang mở để lộ ra màn đăng nhập.
    appNavigatorKey.currentState?.popUntil((route) => route.isFirst);
  };

  // Chạm vào thông báo hệ thống → mở trung tâm thông báo.
  notifier.onTap = (payload) {
    if (auth.status != AuthStatus.signedIn) return;
    final navigator = appNavigatorKey.currentState;
    if (navigator == null) return;
    navigator.push(
        MaterialPageRoute<void>(builder: (_) => const NotificationsScreen()));
  };

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AppConfig>.value(value: config),
        ChangeNotifierProvider<AppSettings>.value(value: settings),
        ChangeNotifierProvider<AuthController>.value(value: auth),
        ChangeNotifierProvider<AppData>.value(value: data),
        ChangeNotifierProvider<NotificationCenter>.value(value: center),
        Provider<ApiClient>.value(value: api),
        Provider<LocalNotifier>.value(value: notifier),
      ],
      child: const CapitalFlowApp(),
    ),
  );

  await notifier.init();
  await auth.restore();
}

class CapitalFlowApp extends StatelessWidget {
  const CapitalFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CapitalFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      navigatorKey: appNavigatorKey,
      scaffoldMessengerKey: appMessengerKey,
      locale: const Locale('vi', 'VN'),
      supportedLocales: const <Locale>[Locale('vi', 'VN'), Locale('en', 'US')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const _RootGate(),
    );
  }
}

/// Chọn màn hình gốc theo trạng thái phiên đăng nhập.
class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AuthController>().status;
    switch (status) {
      case AuthStatus.checking:
        return const _SplashScreen();
      case AuthStatus.signedOut:
        return const LoginScreen();
      case AuthStatus.mustChangePassword:
        return const FirstPasswordScreen();
      case AuthStatus.signedIn:
        return const HomeShell();
    }
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CapitalFlowMark(size: 72),
            const SizedBox(height: 18),
            const Text(
              'CapitalFlow',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                  color: AppColors.ink),
            ),
            const SizedBox(height: 22),
            const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.6)),
          ],
        ),
      ),
    );
  }
}
