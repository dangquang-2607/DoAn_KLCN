import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../auth/auth_widgets.dart';

/// Quản trị người dùng trên mobile (chỉ hiển thị với tài khoản quản trị viên):
/// chỉ số tổng quan hệ thống, tìm kiếm, tạo, khóa/mở khóa và cấp lại mật khẩu.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  final TextEditingController _search = TextEditingController();

  AdminOverview? _overview;
  List<AdminUser> _users = <AdminUser>[];
  String _status = 'all';
  bool _loading = true;
  String? _error;
  Timer? _debounce;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    final request = ++_request;
    final admin = context.read<AppData>().admin;
    try {
      final results = await Future.wait<dynamic>([
        admin.overview(),
        admin.users(search: _search.text.trim(), status: _status == 'all' ? null : _status),
      ]);
      if (!mounted || request != _request) return;
      setState(() {
        _overview = results[0] as AdminOverview;
        _users = results[1] as List<AdminUser>;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), _load);
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      showSnack(success);
      await _load();
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  Future<void> _toggleLock(AdminUser user) async {
    final admin = context.read<AppData>().admin;
    final locking = user.isActive;
    final confirmed = await confirmDialog(
      context,
      title: locking ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
      message: locking
          ? '${user.email} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho tới khi được mở khóa.'
          : '${user.email} sẽ có thể đăng nhập trở lại.',
      confirmLabel: locking ? 'Khóa' : 'Mở khóa',
      danger: locking,
    );
    if (!confirmed) return;
    await _run(
      () => locking ? admin.ban(user.id) : admin.unban(user.id),
      locking ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
    );
  }

  Future<void> _resetPassword(AdminUser user) async {
    final admin = context.read<AppData>().admin;
    final confirmed = await confirmDialog(
      context,
      title: 'Cấp lại mật khẩu?',
      message: 'Hệ thống sẽ tạo mật khẩu tạm thời mới và gửi tới ${user.email}. Người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.',
      confirmLabel: 'Cấp lại',
    );
    if (!confirmed) return;
    await _run(() => admin.resetPassword(user.id), 'Đã gửi mật khẩu tạm thời qua email.');
  }

  void _showActions(AdminUser user) {
    showPickerSheet<void>(
      context,
      title: user.fullName.isEmpty ? user.email : user.fullName,
      children: (sheetContext) => [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(
            '${user.email}\nTạo ngày ${formatDate(user.createdAt)} · Đăng nhập gần nhất ${formatDateTime(user.lastLoginAt)}',
            style: const TextStyle(fontSize: 13, height: 1.5, color: AppColors.muted),
          ),
        ),
        if (user.isAdmin || user.isSystemAccount)
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: InfoBanner(message: 'Tài khoản quản trị/hệ thống được bảo vệ, không thể khóa từ ứng dụng.'),
          )
        else
          SheetOption(
            title: user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
            leading: Icon(
              user.isActive ? Icons.block : Icons.lock_open,
              color: user.isActive ? AppColors.danger : AppColors.success,
            ),
            onTap: () {
              Navigator.of(sheetContext).pop();
              _toggleLock(user);
            },
          ),
        SheetOption(
          title: 'Cấp lại mật khẩu tạm thời',
          leading: const Icon(Icons.key_outlined, color: AppColors.ink),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _resetPassword(user);
          },
        ),
      ],
    );
  }

  Future<void> _openCreate() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => const _CreateUserForm(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final overview = _overview;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Quản trị người dùng'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Tạo tài khoản'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            if (overview != null) ...[
              Row(
                children: [
                  Expanded(child: _Kpi(label: 'Người dùng', value: '${overview.usersTotal}', icon: Icons.group_outlined, color: AppColors.blue)),
                  const SizedBox(width: 10),
                  Expanded(child: _Kpi(label: 'Đang khóa', value: '${overview.usersBanned}', icon: Icons.block, color: AppColors.danger)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _Kpi(label: 'Giao dịch', value: '${overview.totalTransactions}', icon: Icons.receipt_long, color: AppColors.success)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Kpi(
                      label: 'Hóa đơn đã ghi sổ',
                      value: '${overview.invoicesCompleted}/${overview.invoicesTotal}',
                      icon: Icons.document_scanner_outlined,
                      color: AppColors.amber,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
            ],
            TextField(
              controller: _search,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: fieldDecoration('Tìm theo email hoặc họ tên', icon: Icons.search),
            ),
            const SizedBox(height: 10),
            SegmentedChoice<String>(
              options: const [MapEntry('all', 'Tất cả'), MapEntry('active', 'Hoạt động'), MapEntry('banned', 'Bị khóa')],
              value: _status,
              onChanged: (value) {
                setState(() {
                  _status = value;
                  _loading = true;
                });
                _load();
              },
            ),
            const SizedBox(height: 12),
            if (_loading && _users.isEmpty)
              const Padding(padding: EdgeInsets.only(top: 40), child: LoadingView())
            else if (_error != null && _users.isEmpty)
              ErrorView(message: _error!, onRetry: _load)
            else if (_users.isEmpty)
              const EmptyView(icon: Icons.group_outlined, title: 'Không có người dùng phù hợp')
            else
              for (final user in _users)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    onTap: () => _showActions(user),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: user.isActive ? AppColors.soft : AppColors.dangerSoft,
                          child: Icon(
                            user.isAdmin ? Icons.admin_panel_settings_outlined : Icons.person_outline,
                            size: 20,
                            color: user.isActive ? AppColors.blue : AppColors.danger,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.fullName.isEmpty ? user.email : user.fullName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                user.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (!user.isActive)
                          const StatusChip('Bị khóa', color: AppColors.danger)
                        else if (user.isAdmin)
                          const StatusChip('Admin', color: AppColors.warning)
                        else
                          const StatusChip('Hoạt động', color: AppColors.success),
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value, required this.icon, required this.color});

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          IconBadge(icon: icon, color: color, size: 38),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(value, style: moneyStyle.copyWith(fontSize: 18, color: AppColors.ink)),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateUserForm extends StatefulWidget {
  const _CreateUserForm();

  @override
  State<_CreateUserForm> createState() => _CreateUserFormState();
}

class _CreateUserFormState extends State<_CreateUserForm> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  String _role = 'USER';
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2) {
      showSnack('Vui lòng nhập họ và tên.', error: true);
      return;
    }
    if (!isValidEmail(_email.text)) {
      showSnack('Vui lòng nhập email hợp lệ.', error: true);
      return;
    }
    final admin = context.read<AppData>().admin;
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final message = await admin.createUser(
        email: _email.text.trim(),
        fullName: _name.text.trim(),
        role: _role,
      );
      showSnack(message);
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Tạo tài khoản mới', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Text(
                'Hệ thống tự sinh mật khẩu tạm thời và gửi qua email cho người dùng.',
                style: TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: fieldDecoration('Họ và tên', icon: Icons.person_outline),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                decoration: fieldDecoration('Email', icon: Icons.mail_outline),
              ),
              const SizedBox(height: 12),
              SegmentedChoice<String>(
                options: const [MapEntry('USER', 'Người dùng'), MapEntry('ADMIN', 'Quản trị viên')],
                value: _role,
                onChanged: (value) => setState(() => _role = value),
              ),
              const SizedBox(height: 16),
              PrimaryButton(label: 'Tạo tài khoản', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
