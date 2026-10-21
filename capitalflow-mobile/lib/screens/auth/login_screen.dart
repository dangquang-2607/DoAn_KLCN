import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../services/auth_controller.dart';
import '../../widgets/common.dart';
import '../settings/server_screen.dart';
import 'auth_widgets.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

/// Đăng nhập bằng cùng tài khoản đang dùng trên bản web.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _busy = false;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    _notice = context.read<AuthController>().takeNotice();
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (!isValidEmail(email)) {
      setState(() => _error = 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _error = 'Vui lòng nhập mật khẩu.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await context.read<AuthController>().login(email, password);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openRegister() async {
    final email = await pushScreen<String>(context, const RegisterScreen());
    if (!mounted || email == null) return;
    setState(() {
      _email.text = email;
      _password.clear();
      _error = null;
      _notice = 'Đăng ký thành công. Hãy đăng nhập để bắt đầu.';
    });
  }

  Future<void> _openForgot() async {
    final done = await pushScreen<bool>(context, ForgotPasswordScreen(initialEmail: _email.text.trim()));
    if (!mounted || done != true) return;
    setState(() {
      _password.clear();
      _error = null;
      _notice = 'Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Đăng nhập',
      subtitle: 'Quản lý thu chi, ngân sách và hóa đơn của bạn — đồng bộ với bản web.',
      trailing: IconButton(
        onPressed: () => pushScreen<void>(context, const ServerScreen()),
        icon: const Icon(Icons.dns_outlined, color: AppColors.muted),
        tooltip: 'Cấu hình máy chủ',
      ),
      children: [
        if (_notice != null) ...[
          InfoBanner(message: _notice!, icon: Icons.check_circle_outline, color: AppColors.success),
          const SizedBox(height: 14),
        ],
        if (_error != null) ...[
          InfoBanner(message: _error!, icon: Icons.error_outline, color: AppColors.danger),
          const SizedBox(height: 14),
        ],
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: fieldDecoration('Email', icon: Icons.mail_outline, hint: 'ban@example.com'),
        ),
        const SizedBox(height: 12),
        PasswordField(
          controller: _password,
          label: 'Mật khẩu',
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: _busy ? null : _openForgot, child: const Text('Quên mật khẩu?')),
        ),
        const SizedBox(height: 4),
        PrimaryButton(label: 'Đăng nhập', loading: _busy, onPressed: _submit),
        const SizedBox(height: 18),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Chưa có tài khoản?', style: TextStyle(color: AppColors.muted, fontSize: 14)),
            TextButton(onPressed: _busy ? null : _openRegister, child: const Text('Đăng ký ngay')),
          ],
        ),
      ],
    );
  }
}
