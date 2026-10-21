import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/notification_center.dart';
import '../../widgets/common.dart';
import '../accounts/accounts_screen.dart';
import '../categories/categories_screen.dart';
import '../home_tabs.dart';
import '../invoices/invoice_review_screen.dart';
import '../settings/notification_settings_screen.dart';

/// Trung tâm thông báo: mọi thay đổi phát sinh trên web, trên điện thoại và các
/// nhắc nhở/cảnh báo ngân sách của hệ thống.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationCenter>().refresh();
    });
  }

  Future<void> _onMenu(String action) async {
    final center = context.read<NotificationCenter>();
    try {
      if (action == 'read') {
        await center.markAllRead();
        showSnack('Đã đánh dấu tất cả là đã đọc.');
      } else if (action == 'clear') {
        final confirmed = await confirmDialog(
          context,
          title: 'Xóa thông báo đã đọc?',
          message: 'Các thông báo đã đọc sẽ bị xóa khỏi danh sách. Thông báo chưa đọc được giữ lại.',
          confirmLabel: 'Xóa',
          danger: true,
        );
        if (!confirmed) return;
        await center.clearRead();
        showSnack('Đã xóa các thông báo đã đọc.');
      } else if (action == 'settings') {
        if (mounted) await pushScreen<void>(context, const NotificationSettingsScreen());
      }
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  /// Chạm vào thông báo: đánh dấu đã đọc và mở đúng màn hình liên quan.
  void _open(AppNotification item) {
    context.read<NotificationCenter>().markRead(item);
    final navigator = Navigator.of(context);
    switch (item.entityType) {
      case 'transaction':
        navigator.popUntil((route) => route.isFirst);
        homeTab.value = HomeTabs.transactions;
        break;
      case 'budget':
        navigator.popUntil((route) => route.isFirst);
        homeTab.value = HomeTabs.budgets;
        break;
      case 'account':
        pushScreen<void>(context, const AccountsScreen());
        break;
      case 'category':
        pushScreen<void>(context, const CategoriesScreen());
        break;
      case 'invoice':
        final id = item.entityId;
        if (id != null && item.type != 'INVOICE_DELETED') {
          pushScreen<bool>(context, InvoiceReviewScreen(invoiceId: id));
        }
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final center = context.watch<NotificationCenter>();
    final items = _unreadOnly ? center.items.where((item) => !item.isRead).toList() : center.items;

    Widget content;
    if (center.loading && center.items.isEmpty) {
      content = ListView(children: const [SizedBox(height: 120), LoadingView()]);
    } else if (center.error != null && center.items.isEmpty) {
      content = ListView(
        children: [const SizedBox(height: 60), ErrorView(message: center.error!, onRetry: center.refresh)],
      );
    } else if (items.isEmpty) {
      content = ListView(
        children: [
          const SizedBox(height: 40),
          EmptyView(
            icon: Icons.notifications_none,
            title: _unreadOnly ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo nào',
            message: 'Khi bạn thêm giao dịch, quét hóa đơn hoặc chỉnh ngân sách trên web, '
                'thông báo sẽ xuất hiện tại đây và trên thanh thông báo của điện thoại.',
          ),
        ],
      );
    } else {
      content = ListView.separated(
        padding: const EdgeInsets.only(bottom: 32),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
        itemBuilder: (context, index) {
          final item = items[index];
          return Dismissible(
            key: ValueKey<String>(item.id),
            direction: DismissDirection.endToStart,
            background: Container(
              color: AppColors.dangerSoft,
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 24),
              child: const Icon(Icons.delete_outline, color: AppColors.danger),
            ),
            onDismissed: (_) => center.remove(item),
            child: _NotificationTile(item: item, onTap: () => _open(item)),
          );
        },
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(
        'Thông báo',
        actions: [
          PopupMenuButton<String>(
            onSelected: _onMenu,
            icon: const Icon(Icons.more_vert, color: AppColors.ink),
            itemBuilder: (_) => const [
              PopupMenuItem<String>(value: 'read', child: Text('Đánh dấu tất cả đã đọc')),
              PopupMenuItem<String>(value: 'clear', child: Text('Xóa thông báo đã đọc')),
              PopupMenuItem<String>(value: 'settings', child: Text('Cài đặt thông báo')),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: SegmentedChoice<bool>(
                    options: [
                      const MapEntry(false, 'Tất cả'),
                      MapEntry(true, center.unread > 0 ? 'Chưa đọc (${center.unread})' : 'Chưa đọc'),
                    ],
                    value: _unreadOnly,
                    onChanged: (value) => setState(() => _unreadOnly = value),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: center.realtimeConnected ? AppColors.success : AppColors.amber,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    center.realtimeConnected
                        ? 'Kênh thời gian thực đang kết nối — thông báo từ web đến ngay lập tức.'
                        : 'Thông báo được cập nhật mỗi 5 giây khi ứng dụng đang mở.',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ColoredBox(
              color: AppColors.surface,
              child: RefreshIndicator(onRefresh: center.refresh, color: AppColors.blue, child: content),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, required this.onTap});

  final AppNotification item;
  final VoidCallback onTap;

  IconData get _icon {
    final type = item.type;
    if (type.startsWith('BUDGET_WARNING') || type.startsWith('BUDGET_EXCEEDED')) return Icons.warning_amber_rounded;
    if (type.startsWith('BUDGET')) return Icons.pie_chart_outline;
    if (type.startsWith('TRANSFER')) return Icons.swap_horiz;
    if (type.startsWith('TRANSACTION')) return Icons.receipt_long;
    if (type.startsWith('ACCOUNT')) return Icons.account_balance_wallet_outlined;
    if (type.startsWith('CATEGORY')) return Icons.sell_outlined;
    if (type.startsWith('INVOICE')) return Icons.document_scanner_outlined;
    if (type.startsWith('SECURITY')) return Icons.shield_outlined;
    return Icons.notifications_none;
  }

  Color get _color {
    switch (item.severity) {
      case 'SUCCESS':
        return AppColors.success;
      case 'WARNING':
        return AppColors.amber;
      case 'DANGER':
        return AppColors.danger;
      default:
        return AppColors.blue;
    }
  }

  String get _originLabel {
    switch (item.origin) {
      case 'WEB':
        return 'Từ web';
      case 'MOBILE':
        return 'Từ điện thoại';
      default:
        return 'Hệ thống';
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        color: item.isRead ? AppColors.surface : const Color(0xFFF6F8FF),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IconBadge(icon: _icon, color: _color, size: 42),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14.5,
                      height: 1.3,
                      fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  if (item.body.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      item.body,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, height: 1.4, color: AppColors.muted),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    '$_originLabel · ${relativeTime(item.createdAt)}',
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF8A95A8)),
                  ),
                ],
              ),
            ),
            if (!item.isRead)
              Container(
                margin: const EdgeInsets.only(left: 8, top: 4),
                width: 9,
                height: 9,
                decoration: const BoxDecoration(color: AppColors.blue, shape: BoxShape.circle),
              ),
          ],
        ),
      ),
    );
  }
}
