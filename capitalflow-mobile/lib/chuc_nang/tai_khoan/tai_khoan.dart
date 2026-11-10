import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../vi/vi_cua_toi.dart';
import '../quan_tri/quan_tri.dart';
import '../danh_muc/danh_muc.dart';
import '../hoa_don/danh_sach.dart';
import '../thong_bao/cai_dat.dart';
import 'bao_mat.dart';
import '../cai_dat/may_chu.dart';
import '../goi_dich_vu/goi_dich_vu.dart';
import '../ho_tro/gui_yeu_cau.dart';

/// Tab tài khoản với hồ sơ người dùng và lối vào các phân hệ còn lại.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Đăng xuất?',
      message:
          'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng và nhận thông báo trên thiết bị này.',
      confirmLabel: 'Đăng xuất',
      danger: true,
    );
    if (!confirmed || !context.mounted) return;
    await context.read<AuthController>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
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
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.blue),
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
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        profile?.email ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.muted),
                      ),
                      const SizedBox(height: 6),
                      StatusChip(
                        profile?.isAdmin == true
                            ? 'Quản trị viên'
                            : 'Người dùng',
                        color: profile?.isAdmin == true
                            ? AppColors.warning
                            : AppColors.blue,
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.muted),
              ],
            ),
          ),
          const SizedBox(height: Space.md),
          _MenuGroup(
            items: [
              _MenuItem(
                icon: Icons.account_balance_wallet_outlined,
                color: AppColors.blue,
                title: 'Ví của tôi',
                onTap: () => open(const AccountsScreen()),
              ),
              _MenuItem(
                icon: Icons.sell_outlined,
                color: AppColors.danger,
                title: 'Danh mục',
                onTap: () => open(const CategoriesScreen()),
              ),
              _MenuItem(
                icon: Icons.document_scanner_outlined,
                color: AppColors.amber,
                title: 'Quét hóa đơn',
                onTap: () => open(const InvoicesScreen()),
              ),
            ],
          ),
          const SizedBox(height: Space.md),
          _MenuGroup(items: [
            _MenuItem(
                icon: Icons.workspace_premium_outlined,
                color: AppColors.amber,
                title: 'Gói sử dụng',
                onTap: () => open(const SubscriptionScreen())),
            _MenuItem(
              icon: Icons.notifications_active_outlined,
              color: AppColors.amber,
              title: 'Cài đặt thông báo & nhắc nhở',
              onTap: () => open(const NotificationSettingsScreen()),
            ),
          ]),
          const SizedBox(height: Space.md),
          _MenuGroup(
            items: [
              _MenuItem(
                icon: Icons.help_outline,
                color: AppColors.blue,
                title: 'Trung tâm hỗ trợ',
                onTap: () => open(const SupportScreen()),
              ),
              _MenuItem(
                icon: Icons.dns_outlined,
                color: AppColors.muted,
                title: 'Máy chủ',
                onTap: () => open(const ServerScreen()),
              ),
            ],
          ),
          if (profile?.isAdmin == true) ...[
            const SizedBox(height: Space.md),
            const SectionHeader('Quản trị hệ thống'),
            _MenuGroup(
              items: [
                _MenuItem(
                  icon: Icons.admin_panel_settings_outlined,
                  color: AppColors.warning,
                  title: 'Quản trị người dùng',
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
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final VoidCallback onTap;
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    IconBadge(
                        icon: items[i].icon, color: items[i].color, size: 40),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(items[i].title,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
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
