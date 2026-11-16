import 'package:capitalflow_mobile/chuc_nang/tai_khoan/tai_khoan.dart';
import 'package:capitalflow_mobile/chuc_nang/xac_thuc/dang_nhap.dart';
import 'package:capitalflow_mobile/chuc_nang/xac_thuc/phien_dang_nhap.dart';
import 'package:capitalflow_mobile/dung_chung/giao_dien/chu_de.dart';
import 'package:capitalflow_mobile/ha_tang/api.dart';
import 'package:capitalflow_mobile/ha_tang/cau_hinh.dart';
import 'package:capitalflow_mobile/ha_tang/luu_phien.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const localServer = 'http://192.168.1.20:8000';
  const publicServer = 'https://api.capitalflow.online';

  setUp(() {
    SharedPreferences.setMockInitialValues({'cf_api_base_url': localServer});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('Fixed server ignores a saved LAN URL and hides both controls',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final prefs = await SharedPreferences.getInstance();
    final config = AppConfig(prefs, allowServerChanges: false);
    final tokens = TokenStore();
    final api = ApiClient(config: config, tokens: tokens);
    final auth = AuthController(api: api, tokens: tokens);
    addTearDown(config.dispose);
    addTearDown(api.close);
    addTearDown(auth.dispose);

    expect(config.baseUrl, publicServer);
    await config.setBaseUrl('https://other.example');
    expect(config.apiRoot, '$publicServer/api/v1');
    expect(prefs.getString('cf_api_base_url'), localServer);

    Widget screen(Widget home) => MultiProvider(
          providers: [
            ChangeNotifierProvider<AppConfig>.value(value: config),
            ChangeNotifierProvider<AuthController>.value(value: auth),
          ],
          child: MaterialApp(theme: AppTheme.light(), home: home),
        );

    await tester.pumpWidget(screen(const LoginScreen()));
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.byTooltip('Cấu hình máy chủ'), findsNothing);

    await tester.pumpWidget(screen(const Scaffold(body: MoreScreen())));
    await tester.scrollUntilVisible(find.text('Đăng xuất'), 220);
    expect(find.text('Trung tâm hỗ trợ'), findsOneWidget);
    expect(find.text('Máy chủ'), findsNothing);
  });

  test('A saved session is restored only for its own release server', () async {
    await TokenStore().save(access: 'legacy-access', refresh: 'legacy-refresh');

    final release = TokenStore(serverUrl: publicServer);
    await release.load();
    expect(release.hasSession, isFalse);
    await release.save(access: 'release-access', refresh: 'release-refresh');

    final sameServer = TokenStore(serverUrl: publicServer);
    await sameServer.load();
    expect(sameServer.refreshToken, 'release-refresh');

    final otherServer = TokenStore(serverUrl: 'https://other.example');
    await otherServer.load();
    expect(otherServer.hasSession, isFalse);
  });
}
