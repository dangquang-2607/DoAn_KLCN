import 'package:flutter/material.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import '../../dung_chung/giao_dien/thuong_hieu.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

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
      body: Stack(
        children: [
          // Vầng màu nhấn rất nhạt phía trên — tạo chiều sâu mà không cạnh tranh với nút chính.
          Positioned(
            top: -160,
            right: -120,
            child: _AuthGlow(
                color: AppColors.blue.withValues(alpha: 0.10), size: 360),
          ),
          SafeArea(
            child: Column(
              children: [
                if (showBack || trailing != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Space.xs),
                    child: SizedBox(
                      height: 56,
                      child: Row(
                        children: [
                          if (showBack)
                            PillBackButton(
                              onPressed: () => Navigator.of(context).maybePop(),
                            ),
                          const Spacer(),
                          if (trailing != null) trailing!,
                        ],
                      ),
                    ),
                  ),
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(
                        Space.xl,
                        Space.md,
                        Space.xl,
                        Space.xxl,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 440),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _BrandMark(),
                            const SizedBox(height: Space.xxl),
                            Text(title,
                                style: AppText.screenTitle.copyWith(
                                    fontSize: 28, fontWeight: FontWeight.w800)),
                            const SizedBox(height: Space.xs),
                            Text(subtitle,
                                style: AppText.caption.copyWith(fontSize: 15)),
                            const SizedBox(height: Space.xl),
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
        ],
      ),
    );
  }
}

class _AuthGlow extends StatelessWidget {
  const _AuthGlow({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        CapitalFlowMark(size: 48),
        SizedBox(width: Space.sm),
        Flexible(
            child: Text(
          'CapitalFlow',
          style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
              color: AppColors.ink),
        )),
      ],
    );
  }
}

class AuthFooter extends StatelessWidget {
  const AuthFooter(
      {super.key,
      required this.prompt,
      required this.action,
      required this.onPressed,
      this.secondary});

  final String prompt, action;
  final VoidCallback? onPressed;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) => Column(children: [
        const Divider(height: 1, color: AppColors.line),
        const SizedBox(height: Space.xs),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(prompt,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: AppColors.muted)),
            TextButton(
                onPressed: onPressed,
                child: Text(action,
                    style: const TextStyle(fontWeight: FontWeight.w700))),
          ],
        ),
        if (secondary != null) secondary!,
      ]);
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
        icon: Icons.lock_outline_rounded,
        helper: widget.helper,
        suffix: IconButton(
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: Icon(
              _obscure
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              size: 20,
              color: AppColors.muted),
          tooltip: _obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
        ),
      ),
    );
  }
}

bool isValidEmail(String value) {
  return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim());
}
