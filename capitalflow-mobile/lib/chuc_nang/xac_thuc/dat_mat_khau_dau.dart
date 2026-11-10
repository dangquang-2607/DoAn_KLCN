import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import 'quy_tac_mat_khau.dart';
import 'phien_dang_nhap.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'thanh_phan.dart';

/// Bắt buộc đặt mật khẩu chính thức khi đăng nhập bằng mật khẩu tạm do quản trị viên cấp.
class FirstPasswordScreen extends StatefulWidget {
  const FirstPasswordScreen({super.key});

  @override
  State<FirstPasswordScreen> createState() => _FirstPasswordScreenState();
}

class _FirstPasswordScreenState extends State<FirstPasswordScreen> {
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final problem = newPasswordError(_password.text);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    if (_password.text != _confirm.text) {
      setState(() => _error = 'Mật khẩu nhập lại không khớp.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthController>().setFirstPassword(_password.text);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return AuthScaffold(
      title: 'Thiết lập mật khẩu',
      subtitle:
          'Tài khoản ${auth.profile?.email ?? ''} đang dùng mật khẩu tạm. '
          'Hãy đặt mật khẩu của riêng bạn để tiếp tục.',
      children: [
        if (_error != null) ...[
          InfoBanner(
              message: _error!,
              icon: Icons.error_outline,
              color: AppColors.danger),
          const SizedBox(height: 14),
        ],
        PasswordField(
            controller: _password,
            label: 'Mật khẩu mới',
            helper: passwordHelper),
        const SizedBox(height: 12),
        PasswordField(
          controller: _confirm,
          label: 'Nhập lại mật khẩu mới',
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 20),
        PrimaryButton(
            label: 'Lưu mật khẩu', loading: _busy, onPressed: _submit),
        const SizedBox(height: 8),
        Center(
          child: TextButton(
            onPressed:
                _busy ? null : () => context.read<AuthController>().logout(),
            child: const Text('Đăng xuất'),
          ),
        ),
      ],
    );
  }
}
