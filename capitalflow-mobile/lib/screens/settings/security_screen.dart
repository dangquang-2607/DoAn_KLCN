import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/auth_controller.dart';
import '../../widgets/common.dart';
import '../auth/auth_widgets.dart';

/// Hồ sơ tài khoản, đổi mật khẩu và danh sách phiên đăng nhập đang hoạt động.
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final TextEditingController _current = TextEditingController();
  final TextEditingController _next = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  List<LoginSession>? _sessions;
  String? _sessionError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSessions());
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _loadSessions() async {
    if (!mounted) return;
    final auth = context.read<AuthController>();
    try {
      final sessions = await auth.sessions();
      if (mounted) {
        setState(() {
          _sessions = sessions;
          _sessionError = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _sessionError = errorText(error));
    }
  }

  Future<void> _changePassword() async {
    if (_current.text.isEmpty) {
      showSnack('Vui lòng nhập mật khẩu hiện tại.', error: true);
      return;
    }
    if (_next.text.trim().length < 6) {
      showSnack('Mật khẩu mới phải có ít nhất 6 ký tự.', error: true);
      return;
    }
    if (_next.text != _confirm.text) {
      showSnack('Mật khẩu nhập lại không khớp.', error: true);
      return;
    }
    final confirmed = await confirmDialog(
      context,
      title: 'Đổi mật khẩu?',
      message: 'Sau khi đổi, mọi thiết bị (kể cả web) sẽ bị đăng xuất và bạn cần đăng nhập lại bằng mật khẩu mới.',
      confirmLabel: 'Đổi mật khẩu',
    );
    if (!confirmed || !mounted) return;
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthController>();
    setState(() => _saving = true);
    try {
      // Thành công: AuthController xóa phiên và ứng dụng tự quay về màn đăng nhập.
      await auth.changePassword(current: _current.text, next: _next.text);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthController>().profile;
    final sessions = _sessions;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Tài khoản & bảo mật'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          AppCard(
            child: Column(
              children: [
                _InfoRow(label: 'Họ và tên', value: profile?.displayName ?? '—'),
                const Divider(height: 22),
                _InfoRow(label: 'Email', value: profile?.email ?? '—'),
                const Divider(height: 22),
                _InfoRow(label: 'Vai trò', value: profile?.isAdmin == true ? 'Quản trị viên' : 'Người dùng'),
                const Divider(height: 22),
                _InfoRow(label: 'Ngày tạo', value: formatDate(profile?.createdAt)),
                const Divider(height: 22),
                _InfoRow(label: 'Đăng nhập gần nhất', value: formatDateTime(profile?.lastLoginAt)),
              ],
            ),
          ),
          const SectionHeader('Đổi mật khẩu'),
          PasswordField(controller: _current, label: 'Mật khẩu hiện tại'),
          const SizedBox(height: 10),
          PasswordField(controller: _next, label: 'Mật khẩu mới', helper: 'Tối thiểu 6 ký tự.'),
          const SizedBox(height: 10),
          PasswordField(
            controller: _confirm,
            label: 'Nhập lại mật khẩu mới',
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _changePassword(),
          ),
          const SizedBox(height: 14),
          PrimaryButton(label: 'Đổi mật khẩu', loading: _saving, onPressed: _changePassword, icon: Icons.lock_reset),
          const SectionHeader('Phiên đăng nhập đang hoạt động'),
          if (_sessionError != null)
            ErrorView(message: _sessionError!, onRetry: _loadSessions)
          else if (sessions == null)
            const LoadingView()
          else if (sessions.isEmpty)
            const AppCard(
              child: Text('Không có phiên nào đang hoạt động.', style: TextStyle(color: AppColors.muted)),
            )
          else
            AppCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (var i = 0; i < sessions.length; i++) ...[
                    if (i > 0) const Divider(height: 1, indent: 60),
                    ListTile(
                      leading: Icon(
                        (sessions[i].deviceName ?? '').toLowerCase().contains('mobile')
                            ? Icons.smartphone
                            : Icons.computer,
                        color: AppColors.muted,
                      ),
                      title: Text(
                        sessions[i].deviceName ?? 'Thiết bị không xác định',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        [
                          if ((sessions[i].ipAddress ?? '').isNotEmpty) 'IP ${sessions[i].ipAddress}',
                          'Đăng nhập ${formatDateTime(sessions[i].createdAt)}',
                        ].join(' · '),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: const TextStyle(fontSize: 13.5, color: AppColors.muted)),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
