import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_config.dart';
import '../../core/theme.dart';
import '../../services/auth_controller.dart';
import '../../widgets/common.dart';

/// Cấu hình địa chỉ backend FastAPI mà ứng dụng kết nối tới.
///
/// Web và mobile phải trỏ về cùng một backend thì mới dùng chung cơ sở dữ liệu.
class ServerScreen extends StatefulWidget {
  const ServerScreen({super.key});

  @override
  State<ServerScreen> createState() => _ServerScreenState();
}

class _ServerScreenState extends State<ServerScreen> {
  late final TextEditingController _url;
  bool _testing = false;
  bool? _reachable;

  static const List<MapEntry<String, String>> _presets = [
    MapEntry('Máy ảo Android (Emulator)', 'http://10.0.2.2:8000'),
    MapEntry('Điện thoại thật qua USB (adb reverse)', 'http://127.0.0.1:8000'),
  ];

  @override
  void initState() {
    super.initState();
    _url = TextEditingController(text: context.read<AppConfig>().baseUrl);
  }

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _testing = true;
      _reachable = null;
    });
    final ok = await context.read<ApiClient>().ping(_url.text);
    if (!mounted) return;
    setState(() {
      _testing = false;
      _reachable = ok;
    });
  }

  Future<void> _save() async {
    final config = context.read<AppConfig>();
    final next = AppConfig.normalizeBaseUrl(_url.text);
    if (next != config.baseUrl) {
      // End the old-server session before replacing its address. Pending files
      // remain bound to their original server/account and cannot cross over.
      await context.read<AuthController>().logout();
      await config.setBaseUrl(next);
    }
    if (!mounted) return;
    _url.text = config.baseUrl;
    showSnack('Đã lưu địa chỉ máy chủ: ${config.baseUrl}');
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Máy chủ'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const InfoBanner(
            message:
                'Ứng dụng mobile dùng chung backend và cơ sở dữ liệu với bản web. '
                'Nhập địa chỉ máy đang chạy FastAPI (cổng 8000).',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: fieldDecoration(
              'Địa chỉ máy chủ',
              icon: Icons.dns_outlined,
              hint: 'http://192.168.1.10:8000',
              helper:
                  'Điện thoại thật qua Wi-Fi: dùng địa chỉ IPv4 của máy tính, ví dụ http://192.168.1.10:8000',
            ),
            onChanged: (_) {
              setState(() => _reachable = null);
            },
          ),
          const SizedBox(height: 14),
          const Text('Chọn nhanh',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.muted)),
          const SizedBox(height: 8),
          InfoBanner(message: AppConfig.connectionHelp(_url.text)),
          for (final preset in _presets)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                onTap: () => setState(() {
                  _url.text = preset.value;
                  _reachable = null;
                }),
                child: Row(
                  children: [
                    const Icon(Icons.bolt, size: 18, color: AppColors.blue),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(preset.key,
                              style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600)),
                          Text(preset.value,
                              style: const TextStyle(
                                  fontSize: 12.5, color: AppColors.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          if (_reachable == true)
            const InfoBanner(
              message: 'Kết nối thành công tới máy chủ.',
              icon: Icons.check_circle_outline,
              color: AppColors.success,
            ),
          if (_reachable == false)
            InfoBanner(
              message:
                  'Không kết nối được. ${AppConfig.connectionHelp(_url.text)}',
              icon: Icons.error_outline,
              color: AppColors.danger,
            ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _testing ? null : _test,
            icon: _testing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.wifi_tethering, size: 18),
            label: Text(_testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'),
          ),
          const SizedBox(height: 12),
          PrimaryButton(
              label: 'Lưu địa chỉ',
              onPressed: _save,
              icon: Icons.save_outlined),
        ],
      ),
    );
  }
}
