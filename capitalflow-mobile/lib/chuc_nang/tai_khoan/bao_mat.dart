import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../xac_thuc/quy_tac_mat_khau.dart';
import '../../du_lieu/mo_hinh.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../vi/dich_vu_vi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../xac_thuc/thanh_phan.dart';

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
  bool _revoking = false;

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

  Future<void> _revoke([LoginSession? session]) async {
    if (_revoking || session?.isCurrent == true) return;
    if (!await confirmDialog(context,
        title: 'Thu hồi phiên đăng nhập?',
        message: session == null
            ? 'Đăng xuất mọi thiết bị khác, giữ phiên hiện tại.'
            : 'Đăng xuất ${session.deviceName ?? "thiết bị này"}?',
        confirmLabel: 'Thu hồi',
        danger: true)) {
      return;
    }
    if (!mounted) return;
    setState(() => _revoking = true);
    try {
      await AccountFeatures(context.read<AuthController>().api)
          .revokeSession(session?.id);
      await _loadSessions();
      showSnack('Đã thu hồi phiên đăng nhập.');
    } catch (e) {
      showSnack(errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _revoking = false);
    }
  }

  Future<void> _changePassword() async {
    if (_current.text.isEmpty) {
      showSnack('Vui lòng nhập mật khẩu hiện tại.', error: true);
      return;
    }
    final problem = newPasswordError(_next.text);
    if (problem != null) {
      showSnack(problem, error: true);
      return;
    }
    if (_next.text != _confirm.text) {
      showSnack('Mật khẩu nhập lại không khớp.', error: true);
      return;
    }
    final confirmed = await confirmDialog(
      context,
      title: 'Đổi mật khẩu?',
      message:
          'Sau khi đổi, mọi thiết bị (kể cả web) sẽ bị đăng xuất và bạn cần đăng nhập lại bằng mật khẩu mới.',
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
      appBar: appBar(context, 'Tài khoản & bảo mật'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          AppCard(
            child: Column(
              children: [
                _InfoRow(
                    label: 'Họ và tên', value: profile?.displayName ?? '—'),
                const Divider(height: 22),
                _InfoRow(label: 'Email', value: profile?.email ?? '—'),
                const Divider(height: 22),
                _InfoRow(
                    label: 'Vai trò',
                    value: profile?.isAdmin == true
                        ? 'Quản trị viên'
                        : 'Người dùng'),
                const Divider(height: 22),
                _InfoRow(
                    label: 'Ngày tạo', value: formatDate(profile?.createdAt)),
                const Divider(height: 22),
                _InfoRow(
                    label: 'Đăng nhập gần nhất',
                    value: formatDateTime(profile?.lastLoginAt)),
              ],
            ),
          ),
          const SectionHeader('Đổi mật khẩu'),
          PasswordField(controller: _current, label: 'Mật khẩu hiện tại'),
          const SizedBox(height: 10),
          PasswordField(
              controller: _next,
              label: 'Mật khẩu mới',
              helper: passwordHelper),
          const SizedBox(height: 10),
          PasswordField(
            controller: _confirm,
            label: 'Nhập lại mật khẩu mới',
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _changePassword(),
          ),
          const SizedBox(height: 14),
          PrimaryButton(
              label: 'Đổi mật khẩu',
              loading: _saving,
              onPressed: _changePassword,
              icon: Icons.lock_reset),
          const SizedBox(height: Space.xl),
          LayoutBuilder(builder: (context, constraints) {
            const title = Text('Phiên đăng nhập',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700));
            final action = TextButton(
              onPressed:
                  _revoking || !(sessions?.any((s) => !s.isCurrent) ?? false)
                      ? null
                      : () => _revoke(),
              style: TextButton.styleFrom(
                minimumSize: const Size(0, 48),
                padding: const EdgeInsets.symmetric(horizontal: Space.xs),
                textStyle: const TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
              child: const Text('Đăng xuất thiết bị khác'),
            );
            if (constraints.maxWidth < 336 ||
                MediaQuery.textScalerOf(context).scale(1) > 1.15) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [title, action],
              );
            }
            return Row(children: [Expanded(child: title), action]);
          }),
          const SizedBox(height: Space.xs),
          if (_sessionError != null)
            ErrorView(message: _sessionError!, onRetry: _loadSessions)
          else if (sessions == null)
            const LoadingView()
          else if (sessions.isEmpty)
            const AppCard(
              child: Text('Không có phiên nào đang hoạt động.',
                  style: TextStyle(color: AppColors.muted)),
            )
          else
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (var i = 0; i < sessions.length; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, indent: 40, endIndent: Space.sm),
                    _SessionTile(
                      key: ValueKey(sessions[i].id),
                      session: sessions[i],
                      onRevoke: _revoking || sessions[i].isCurrent
                          ? null
                          : () => _revoke(sessions[i]),
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

class _SessionTile extends StatefulWidget {
  const _SessionTile(
      {super.key, required this.session, required this.onRevoke});

  final LoginSession session;
  final VoidCallback? onRevoke;

  @override
  State<_SessionTile> createState() => _SessionTileState();
}

class _SessionTileState extends State<_SessionTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final name = session.deviceName?.trim();
    final device =
        name == null || name.isEmpty ? 'Thiết bị không xác định' : name;
    final mobile =
        RegExp(r'mobile|android|iphone|ipad|ios', caseSensitive: false)
            .hasMatch(device);
    final activeAt = session.lastUsedAt ?? session.createdAt;

    Widget detail(String label, String value) => Padding(
          padding: const EdgeInsets.only(top: Space.xs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 72,
                child: Text(label,
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.muted)),
              ),
              const SizedBox(width: Space.xs),
              Expanded(
                child: SelectableText(value,
                    style: const TextStyle(fontSize: 12, height: 1.4)),
              ),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          hint: _expanded ? 'Thu gọn thông tin phiên' : 'Xem thông tin phiên',
          child: InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  Space.sm, Space.xxs, Space.xs, Space.xxs),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Row(
                  children: [
                    Icon(mobile ? Icons.smartphone : Icons.computer,
                        size: 20,
                        color: session.isCurrent
                            ? AppColors.blue
                            : AppColors.muted),
                    const SizedBox(width: Space.xs),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(device,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600)),
                          const SizedBox(height: Space.xxs),
                          Text(formatDateTime(activeAt),
                              style: const TextStyle(
                                  fontSize: 12, color: AppColors.muted)),
                        ],
                      ),
                    ),
                    const SizedBox(width: Space.xxs),
                    if (session.isCurrent)
                      Container(
                        margin: const EdgeInsets.only(right: Space.xs),
                        padding: const EdgeInsets.symmetric(
                            horizontal: Space.xs, vertical: Space.xxs),
                        decoration: BoxDecoration(
                            color: AppColors.soft,
                            borderRadius: BorderRadius.circular(Radii.chip)),
                        child: const Text('Hiện tại',
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.blue)),
                      )
                    else
                      IconButton(
                        tooltip: 'Thu hồi phiên',
                        constraints:
                            const BoxConstraints(minWidth: 48, minHeight: 48),
                        onPressed: widget.onRevoke,
                        icon: const Icon(Icons.logout,
                            size: 20, color: AppColors.muted),
                      ),
                    Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (_expanded)
          Padding(
            padding: const EdgeInsets.fromLTRB(40, 0, Space.sm, Space.sm),
            child: Column(
              children: [
                detail('Thiết bị', device),
                if (session.ipAddress?.isNotEmpty == true)
                  detail('Địa chỉ IP', session.ipAddress!),
                detail('Hoạt động', formatDateTime(activeAt)),
                detail('Hết hạn', formatDateTime(session.expiresAt)),
              ],
            ),
          ),
      ],
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 5,
          child: Text(label,
              style: const TextStyle(fontSize: 13.5, color: AppColors.muted)),
        ),
        const SizedBox(width: Space.sm),
        Expanded(
          flex: 6,
          child: Text(
            value,
            textAlign: TextAlign.right,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
