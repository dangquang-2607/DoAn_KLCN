import 'dart:convert';
import 'dart:io';

import 'package:capitalflow_mobile/core/api_client.dart';
import 'package:capitalflow_mobile/core/app_config.dart';
import 'package:capitalflow_mobile/core/token_store.dart';
import 'package:capitalflow_mobile/services/local_notifier.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

final contracts = Map<String, dynamic>.from(jsonDecode(
    File('test/fixtures/backend_contract.json').readAsStringSync()) as Map);
Map<String, dynamic> contract(String name) =>
    Map<String, dynamic>.from(contracts[name] as Map);
http.Response jsonResponse(Object? body, [int status = 200]) => http.Response(
    body == null ? '' : jsonEncode(body), status,
    headers: {'content-type': 'application/json; charset=utf-8'});
String jwt(String owner) =>
    'test.${base64Url.encode(utf8.encode(jsonEncode({'sub': owner})))}.signature';

class ApiHarness {
  final tokens = TokenStore();
  late SharedPreferences prefs;
  late AppConfig config;
  late ApiClient api;
  Future<void> init(Future<http.Response> Function(http.Request) handler,
      {bool refreshEnabled = true}) async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    config = AppConfig(prefs);
    await tokens.save(access: jwt('owner-a'), refresh: 'refresh-a');
    api = ApiClient(config: config, tokens: tokens,
        client: MockClient(handler), refreshEnabled: refreshEnabled);
  }
  void dispose() {
    api.close();
    config.dispose();
  }
}

class RecordingNotifier extends LocalNotifier {
  final calls = <Map<String, Object?>>[];
  bool succeeds = true;
  Future<void> Function()? beforeReturn;
  @override
  Future<bool> show({required int id, required String title, required String body,
      String? payload, bool important = false}) async {
    calls.add({'id': id, 'title': title, 'body': body, 'payload': payload, 'important': important});
    await beforeReturn?.call();
    return succeeds;
  }
}
