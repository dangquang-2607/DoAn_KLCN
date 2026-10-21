import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../services/auth_controller.dart';
import '../../widgets/common.dart';
import 'auth_widgets.dart';

/// Quên mật khẩu: nhận mã OTP 6 số qua email rồi đặt mật khẩu mới.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final TextEditingController _email = TextEditingController(text: widget.initialEmail);
  final TextEditingController _otp = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  /// Bước 1: nhập email. Bước 2: nhập OTP và mật khẩu mới.
  bool _otpSent = false;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _otp.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestOtp() async {
    if (!isValidEmail(_email.text)) {
      setState(() => _error = 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    await _run(() async {
      final message = await context.read<AuthController>().requestPasswordOtp(_email.text);
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _info = message.isEmpty ? 'Nếu email tồn tại, mã OTP đã được gửi tới hộp thư của bạn.' : message;
      });
    });
  }

  Future<void> _reset() async {
    if (_otp.text.trim().length != 6) {
      setState(() => _error = 'Mã OTP gồm 6 chữ số.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (_password.text != _confirm.text) {
      setState(() => _error = 'Mật khẩu nhập lại không khớp.');
      return;
    }
    await _run(() async {
      await context.read<AuthController>().resetPassword(
            email: _email.text,
            otp: _otp.text.trim(),
            newPassword: _password.text,
          );
      if (mounted) Navigator.of(context).pop(true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      showBack: true,
      title: 'Quên mật khẩu',
      subtitle: _otpSent
          ? 'Nhập mã OTP 6 số trong email (hiệu lực 10 phút) và mật khẩu mới.'
          : 'Nhập email đã đăng ký, hệ thống sẽ gửi mã xác thực OTP cho bạn.',
      children: [
        if (_info != null && _otpSent) ...[
          InfoBanner(message: _info!, icon: Icons.mark_email_read_outlined, color: AppColors.blue),
          const SizedBox(height: 14),
        ],
        if (_error != null) ...[
          InfoBanner(message: _error!, icon: Icons.error_outline, color: AppColors.danger),
          const SizedBox(height: 14),
        ],
        TextField(
          controller: _email,
          enabled: !_otpSent,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          textInputAction: TextInputAction.done,
          decoration: fieldDecoration('Email', icon: Icons.mail_outline),
        ),
        if (!_otpSent) ...[
          const SizedBox(height: 20),
          PrimaryButton(label: 'Gửi mã OTP', loading: _busy, onPressed: _requestOtp),
        ] else ...[
          const SizedBox(height: 12),
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next,
            style: const TextStyle(fontSize: 18, letterSpacing: 6, fontWeight: FontWeight.w700),
            decoration: fieldDecoration('Mã OTP', icon: Icons.pin_outlined),
          ),
          const SizedBox(height: 12),
          PasswordField(controller: _password, label: 'Mật khẩu mới', helper: 'Tối thiểu 6 ký tự.'),
          const SizedBox(height: 12),
          PasswordField(
            controller: _confirm,
            label: 'Nhập lại mật khẩu mới',
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _reset(),
          ),
          const SizedBox(height: 20),
          PrimaryButton(label: 'Đặt lại mật khẩu', loading: _busy, onPressed: _reset),
          const SizedBox(height: 8),
          Center(
            child: TextButton(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                        _otpSent = false;
                        _otp.clear();
                        _error = null;
                      }),
              child: const Text('Dùng email khác hoặc gửi lại mã'),
            ),
          ),
        ],
      ],
    );
  }
}
