import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Khung chung của các màn xác thực: logo, tiêu đề và thẻ biểu mẫu.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.showBack = false,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final bool showBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 48,
              child: Row(
                children: [
                  if (showBack)
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back, color: AppColors.ink),
                      tooltip: 'Quay lại',
                    ),
                  const Spacer(),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _BrandMark(),
                        const SizedBox(height: 22),
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.6,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(subtitle, style: const TextStyle(fontSize: 14.5, height: 1.45, color: AppColors.muted)),
                        const SizedBox(height: 22),
                        ...children,
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.account_balance_wallet, color: Colors.white, size: 24),
        ),
        const SizedBox(width: 12),
        const Text(
          'CapitalFlow',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, letterSpacing: -0.4, color: AppColors.ink),
        ),
      ],
    );
  }
}

/// Ô nhập mật khẩu có nút hiện/ẩn.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.onSubmitted,
    this.helper,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final String label;
  final String? helper;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _obscure,
      enableSuggestions: false,
      autocorrect: false,
      textInputAction: widget.textInputAction,
      onSubmitted: widget.onSubmitted,
      decoration: fieldDecoration(
        widget.label,
        icon: Icons.lock_outline,
        helper: widget.helper,
        suffix: IconButton(
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20, color: AppColors.muted),
          tooltip: _obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
        ),
      ),
    );
  }
}

bool isValidEmail(String value) {
  return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim());
}
