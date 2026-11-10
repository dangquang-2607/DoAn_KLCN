import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import 'quy_tac_mat_khau.dart';
import 'phien_dang_nhap.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'thanh_phan.dart';

/// Đăng ký tài khoản người dùng mới. Khi thành công trả email về màn đăng nhập.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static const _consentError =
      'Vui lòng đồng ý với điều khoản và chính sách quyền riêng tư.';
  static final _gmail = RegExp(
    r"^[a-z0-9!#$%&'*+/=?^`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^`{|}~-]+)*@gmail\.com$",
    caseSensitive: false,
  );
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  bool _busy = false;
  bool _agreed = false;
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
    if (!_gmail.hasMatch(_email.text.trim())) {
      return 'Vui lòng nhập địa chỉ @gmail.com hợp lệ.';
    }
    final problem = newPasswordError(_password.text);
    if (problem != null) return problem;
    if (_password.text != _confirm.text) return 'Mật khẩu nhập lại không khớp.';
    if (!_agreed) return _consentError;
    return null;
  }

  Future<void> _submit() async {
    if (_busy) return;
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
      final email = _email.text.trim().toLowerCase();
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
      title: 'Tạo tài khoản',
      subtitle: 'Một tài khoản dùng chung cho cả ứng dụng mobile và bản web.',
      children: [
        if (_error != null && _error != _consentError) ...[
          InfoBanner(
              message: _error!,
              icon: Icons.error_outline,
              color: AppColors.danger),
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
          decoration:
              fieldDecoration('Địa chỉ Gmail', icon: Icons.mail_outline),
        ),
        const SizedBox(height: 12),
        PasswordField(
            controller: _password,
            label: 'Mật khẩu',
            helper: passwordHelper),
        const SizedBox(height: 12),
        PasswordField(
          controller: _confirm,
          label: 'Nhập lại mật khẩu',
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: Space.sm),
        CheckboxListTile(
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          value: _agreed,
          onChanged: _busy
              ? null
              : (value) => setState(() {
                    _agreed = value ?? false;
                    if (_agreed && _error == _consentError) {
                      _error = null;
                    }
                  }),
          title: Text.rich(
              const TextSpan(children: [
                TextSpan(text: 'Tôi đồng ý với '),
                TextSpan(
                    text: 'Điều khoản dịch vụ',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                TextSpan(text: ' và '),
                TextSpan(
                    text: 'Chính sách quyền riêng tư',
                    style: TextStyle(fontWeight: FontWeight.w600)),
              ]),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppColors.muted, height: 1.4)),
        ),
        if (_error == _consentError)
          Semantics(
            liveRegion: true,
            child: Text(_consentError,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.danger)),
          ),
        const SizedBox(height: Space.sm),
        PrimaryButton(label: 'Đăng ký', loading: _busy, onPressed: _submit),
        const SizedBox(height: Space.xl),
        AuthFooter(
          prompt: 'Đã có tài khoản?',
          action: 'Đăng nhập',
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
