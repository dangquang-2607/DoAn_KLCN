import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_config.dart';
import '../core/theme.dart';
import '../services/auth_controller.dart';
import '../services/notification_center.dart';
import '../widgets/common.dart';
import 'accounts/accounts_screen.dart';
import 'admin/admin_screen.dart';
import 'analytics/analytics_screen.dart';
import 'categories/categories_screen.dart';
import 'invoices/invoices_screen.dart';
import 'notifications/notifications_screen.dart';
import 'settings/notification_settings_screen.dart';
import 'settings/security_screen.dart';
import 'settings/server_screen.dart';

/// Tab "Thêm": hồ sơ người dùng và lối vào các phân hệ còn lại.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Đăng xuất?',
      message: 'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng và nhận thông báo trên thiết bị này.',
      confirmLabel: 'Đăng xuất',
      danger: true,
    );
    if (!confirmed || !context.mounted) return;
    await context.read<AuthController>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final center = context.watch<NotificationCenter>();
    final config = context.watch<AppConfig>();
    final profile = auth.profile;

    void open(Widget screen) => pushScreen<void>(context, screen);

    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          AppCard(
            onTap: () => open(const SecurityScreen()),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.soft,
                  child: Text(
                    profile?.initials ?? '?',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.blue),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile?.displayName ?? 'Tài khoản',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        profile?.email ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, color: AppColors.muted),
                      ),
                      const SizedBox(height: 6),
                      StatusChip(
                        profile?.isAdmin == true ? 'Quản trị viên' : 'Người dùng',
                        color: profile?.isAdmin == true ? AppColors.warning : AppColors.blue,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.muted),
              ],
            ),
          ),
          const SectionHeader('Tài chính'),
          _MenuGroup(
            items: [
              _MenuItem(
                icon: Icons.account_balance_wallet_outlined,
                color: AppColors.blue,
                title: 'Ví & tài khoản',
                subtitle: 'Tiền mặt, ngân hàng, ví điện tử',
                onTap: () => open(const AccountsScreen()),
              ),
              _MenuItem(
                icon: Icons.document_scanner_outlined,
                color: AppColors.amber,
                title: 'Hóa đơn AI',
                subtitle: 'Chụp, tải lên và nhận dạng hóa đơn bằng OCR',
                onTap: () => open(const InvoicesScreen()),
              ),
              _MenuItem(
                icon: Icons.insights,
                color: AppColors.success,
                title: 'Báo cáo tài chính',
                subtitle: 'Thống kê thu chi và biểu đồ theo tháng',
                onTap: () => open(const AnalyticsScreen()),
              ),
              _MenuItem(
                icon: Icons.sell_outlined,
                color: AppColors.danger,
                title: 'Danh mục thu – chi',
                subtitle: 'Danh mục và từ khóa tự phân loại',
                onTap: () => open(const CategoriesScreen()),
              ),
            ],
          ),
          const SectionHeader('Thông báo & tài khoản'),
          _MenuGroup(
            items: [
              _MenuItem(
                icon: Icons.notifications_none,
                color: AppColors.blue,
                title: 'Thông báo',
                subtitle: center.unread > 0 ? '${center.unread} thông báo chưa đọc' : 'Không có thông báo mới',
                badge: center.unread,
                onTap: () => open(const NotificationsScreen()),
              ),
              _MenuItem(
                icon: Icons.notifications_active_outlined,
                color: AppColors.amber,
                title: 'Cài đặt thông báo & nhắc nhở',
                subtitle: 'Banner, cảnh báo ngân sách, nhắc ghi chép hằng ngày',
                onTap: () => open(const NotificationSettingsScreen()),
              ),
              _MenuItem(
                icon: Icons.lock_outline,
                color: AppColors.success,
                title: 'Bảo mật',
                subtitle: 'Đổi mật khẩu, phiên đăng nhập',
                onTap: () => open(const SecurityScreen()),
              ),
              _MenuItem(
                icon: Icons.dns_outlined,
                color: AppColors.muted,
                title: 'Máy chủ',
                subtitle: config.baseUrl,
                onTap: () => open(const ServerScreen()),
              ),
            ],
          ),
          if (profile?.isAdmin == true) ...[
            const SectionHeader('Quản trị hệ thống'),
            _MenuGroup(
              items: [
                _MenuItem(
                  icon: Icons.admin_panel_settings_outlined,
                  color: AppColors.warning,
                  title: 'Quản trị người dùng',
                  subtitle: 'Tổng quan hệ thống, khóa/mở khóa tài khoản',
                  onTap: () => open(const AdminScreen()),
                ),
              ],
            ),
          ],
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => _logout(context),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: Color(0xFFF0C4CB)),
            ),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Đăng xuất'),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text(
              'CapitalFlow Mobile 1.0.0 · Khóa luận CNTT-KLCN242',
              style: TextStyle(fontSize: 12, color: Color(0xFF9AA5B8)),
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final int badge;
}

class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.items});

  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 68),
            InkWell(
              onTap: items[i].onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    IconBadge(icon: items[i].icon, color: items[i].color, size: 40),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(items[i].title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text(
                            items[i].subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                    if (items[i].badge > 0)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: AppColors.danger, borderRadius: BorderRadius.circular(999)),
                        child: Text(
                          items[i].badge > 99 ? '99+' : '${items[i].badge}',
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                      ),
                    const Icon(Icons.chevron_right, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
