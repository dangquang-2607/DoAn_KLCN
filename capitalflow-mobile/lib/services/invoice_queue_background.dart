import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import '../core/api_client.dart';
import '../core/app_config.dart';
import '../core/token_store.dart';
import 'invoice_queue_runner.dart';
import 'invoice_queue_store.dart';

const _queueTask = 'capitalflow.invoice.uploads';

@pragma('vm:entry-point')
void invoiceQueueDispatcher() {
  Workmanager().executeTask((task, _) async {
    WidgetsFlutterBinding.ensureInitialized();
    if (task != _queueTask) return true;
    InvoiceQueueStore? store;
    ApiClient? api;
    try {
      store = await InvoiceQueueStore.open();
      final session = await store.active();
      if (session == null || session.paused) return true;
      final tokens = TokenStore();
      await tokens.load(clearOnFailure: false);
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final config = AppConfig(prefs);
      if (tokens.ownerId != session.owner || config.apiRoot != session.server) {
        return true;
      }
      // The foreground client owns token rotation. Background work uses the
      // current access token and waits for sign-in/foreground refresh on 401.
      api = ApiClient(config: config, tokens: tokens, refreshEnabled: false);
      await InvoiceQueueRunner(store, api, session, extraGuard: () async {
        final current = TokenStore();
        await current.load(clearOnFailure: false);
        await prefs.reload();
        if (current.accessToken != tokens.accessToken ||
            AppConfig(prefs).apiRoot != session.server) {
          throw QueueInterrupted();
        }
      }).run(limit: 3);
      final pending = await store.list(session.scope);
      return !pending
          .any((job) => job.state == 'waiting' || job.state == 'retry');
    } catch (_) {
      return false;
    } finally {
      api?.close();
      await store?.db.close();
    }
  });
}

Future<void> initializeInvoiceBackground() async {
  if (Platform.isAndroid) {
    await Workmanager().initialize(invoiceQueueDispatcher);
  }
}

Future<void> scheduleInvoiceBackground() async {
  if (!Platform.isAndroid) return;
  await Workmanager().registerOneOffTask('$_queueTask.now', _queueTask,
      existingWorkPolicy: ExistingWorkPolicy.keep,
      initialDelay: const Duration(seconds: 10),
      constraints: Constraints(networkType: NetworkType.connected),
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(seconds: 30));
  await Workmanager().registerPeriodicTask('$_queueTask.periodic', _queueTask,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(networkType: NetworkType.connected));
}

Future<void> cancelInvoiceBackground() async {
  if (!Platform.isAndroid) return;
  await Workmanager().cancelByUniqueName('$_queueTask.now');
  await Workmanager().cancelByUniqueName('$_queueTask.periodic');
}
