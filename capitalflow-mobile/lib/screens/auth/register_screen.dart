import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../services/auth_controller.dart';
import '../../widgets/common.dart';
import 'auth_widgets.dart';

/// Đăng ký tài khoản người dùng mới. Khi thành công trả email về màn đăng nhập.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? _validate() {
    if (_name.text.trim().length < 2) return 'Vui lòng nhập họ và tên.';
    if (!isValidEmail(_email.text)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
    if (_password.text.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (_password.text != _confirm.text) return 'Mật khẩu nhập lại không khớp.';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      await context.read<AuthController>().register(
            fullName: _name.text,
            email: email,
            password: _password.text,
          );
      if (mounted) Navigator.of(context).pop(email);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      title: 'Tạo tài khoản',
      subtitle: 'Một tài khoản dùng chung cho cả ứng dụng mobile và bản web.',
      children: [
        if (_error != null) ...[
          InfoBanner(message: _error!, icon: Icons.error_outline, color: AppColors.danger),
          const SizedBox(height: 14),
        ],
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          maxLength: 150,
          decoration: fieldDecoration('Họ và tên', icon: Icons.person_outline),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autocorrect: false,
          decoration: fieldDecoration('Email', icon: Icons.mail_outline),
        ),
        const SizedBox(height: 12),
        PasswordField(controller: _password, label: 'Mật khẩu', helper: 'Tối thiểu 6 ký tự.'),
        const SizedBox(height: 12),
        PasswordField(
          controller: _confirm,
          label: 'Nhập lại mật khẩu',
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        PrimaryButton(label: 'Đăng ký', loading: _busy, onPressed: _submit),
      ],
    );
  }
}
