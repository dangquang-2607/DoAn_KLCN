import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/category_style.dart';
import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/app_data.dart';
import '../services/auth_controller.dart';
import '../services/notification_center.dart';
import '../widgets/auto_refresh.dart';
import '../widgets/common.dart';
import 'accounts/accounts_screen.dart';
import 'notifications/notifications_screen.dart';

/// Tổng quan tài chính: tổng tài sản, thu chi trong tháng, ví, ngân sách cần chú ý
/// và các giao dịch gần nhất.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.onOpenTransactions, required this.onOpenBudgets});

  final VoidCallback onOpenTransactions;
  final VoidCallback onOpenBudgets;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with AutoRefresh<DashboardScreen> {
  DashboardData? _data;
  List<BudgetProgress> _budgets = <BudgetProgress>[];
  String? _error;
  bool _loading = true;

  @override
  Future<void> reload() async {
    final appData = context.read<AppData>();
    if (_data == null) setState(() => _loading = true);
    try {
      if (!appData.loaded) await appData.refreshLookups();
      final results = await Future.wait<dynamic>([appData.finance.dashboard(), appData.finance.budgets()]);
      if (!mounted) return;
      setState(() {
        _data = results[0] as DashboardData;
        _budgets = results[1] as List<BudgetProgress>;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = errorText(error);
        _loading = false;
      });
    }
  }

  Future<void> _pullToRefresh() async {
    final appData = context.read<AppData>();
    try {
      await appData.refreshLookups();
    } catch (_) {
      // Lỗi kết nối sẽ được hiển thị bởi reload().
    }
    await reload();
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<AuthController>().profile;
    final center = context.watch<NotificationCenter>();
    final appData = context.watch<AppData>();
    final data = _data;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _pullToRefresh,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            _Header(
              name: profile?.displayName ?? 'bạn',
              initials: profile?.initials ?? '?',
              unread: center.unread,
              realtime: center.realtimeConnected,
              onOpenNotifications: () => pushScreen<void>(context, const NotificationsScreen()),
            ),
            const SizedBox(height: 16),
            if (data == null && _loading)
              const Padding(padding: EdgeInsets.only(top: 80), child: LoadingView())
            else if (data == null)
              Padding(
                padding: const EdgeInsets.only(top: 40),
                child: ErrorView(message: _error ?? 'Không tải được dữ liệu.', onRetry: reload),
              )
            else ...[
              if (_error != null) ...[
                InfoBanner(message: _error!, icon: Icons.cloud_off, color: AppColors.warning),
                const SizedBox(height: 12),
              ],
              _NetWorthCard(data: data),
              const SizedBox(height: 18),
              SectionHeader(
                'Ví & tài khoản',
                actionLabel: 'Quản lý',
                onAction: () => pushScreen<void>(context, const AccountsScreen()),
              ),
              _WalletStrip(
                wallets: appData.wallets,
                onOpen: () => pushScreen<void>(context, const AccountsScreen()),
              ),
              const SizedBox(height: 18),
              SectionHeader('Ngân sách kỳ này', actionLabel: 'Xem tất cả', onAction: widget.onOpenBudgets),
              _BudgetPreview(budgets: _budgets, onOpen: widget.onOpenBudgets),
              const SizedBox(height: 18),
              SectionHeader('Giao dịch gần đây', actionLabel: 'Xem tất cả', onAction: widget.onOpenTransactions),
              _RecentList(items: data.recent, onOpen: widget.onOpenTransactions),
            ],
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.initials,
    required this.unread,
    required this.realtime,
    required this.onOpenNotifications,
  });

  final String name;
  final String initials;
  final int unread;
  final bool realtime;
  final VoidCallback onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.soft,
          child: Text(initials, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.blue)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Xin chào, $name',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: realtime ? AppColors.success : AppColors.amber,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      realtime ? 'Đang đồng bộ trực tiếp với web' : 'Đồng bộ định kỳ với web',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: onOpenNotifications,
          tooltip: 'Thông báo',
          icon: Badge(
            isLabelVisible: unread > 0,
            label: Text(unread > 99 ? '99+' : '$unread'),
            backgroundColor: AppColors.danger,
            child: const Icon(Icons.notifications_none, color: AppColors.ink, size: 26),
          ),
        ),
      ],
    );
  }
}

class _NetWorthCard extends StatelessWidget {
  const _NetWorthCard({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.blue, AppColors.blueDark],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Tổng tài sản', style: TextStyle(fontSize: 13.5, color: Color(0xCCFFFFFF))),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              formatMoney(data.netWorth, keepSign: true),
              style: moneyStyle.copyWith(fontSize: 32, color: Colors.white, letterSpacing: -1),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _FlowStat(
                  label: 'Thu tháng ${data.month}',
                  value: data.incomeThisMonth,
                  icon: Icons.south_west,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _FlowStat(
                  label: 'Chi tháng ${data.month}',
                  value: data.expenseThisMonth,
                  icon: Icons.north_east,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FlowStat extends StatelessWidget {
  const _FlowStat({required this.label, required this.value, required this.icon});

  final String label;
  final double value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: const Color(0x24FFFFFF), borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: Color(0xCCFFFFFF))),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(formatMoney(value), style: moneyStyle.copyWith(fontSize: 15, color: Colors.white)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WalletStrip extends StatelessWidget {
  const _WalletStrip({required this.wallets, required this.onOpen});

  final List<Wallet> wallets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (wallets.isEmpty) {
      return AppCard(
        onTap: onOpen,
        child: const Row(
          children: [
            IconBadge(icon: Icons.account_balance_wallet_outlined, color: AppColors.blue),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Chưa có ví nào. Chạm để tạo ví đầu tiên và bắt đầu ghi chép.',
                style: TextStyle(fontSize: 14, color: AppColors.muted, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: wallets.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final wallet = wallets[index];
          return SizedBox(
            width: 172,
            child: AppCard(
              onTap: onOpen,
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      IconBadge(
                        icon: walletIcon(wallet.accountType),
                        color: walletColor(wallet.accountType),
                        size: 32,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          wallet.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      formatMoney(wallet.balance, keepSign: true),
                      style: moneyStyle.copyWith(
                        fontSize: 16,
                        color: wallet.balance < 0 ? AppColors.danger : AppColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BudgetPreview extends StatelessWidget {
  const _BudgetPreview({required this.budgets, required this.onOpen});

  final List<BudgetProgress> budgets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final current = budgets.where((budget) => budget.isActive && budget.isCurrent).toList()
      ..sort((a, b) => b.usagePercent.compareTo(a.usagePercent));
    if (current.isEmpty) {
      return AppCard(
        onTap: onOpen,
        child: const Row(
          children: [
            IconBadge(icon: Icons.pie_chart_outline, color: AppColors.blue),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Chưa có ngân sách cho kỳ này. Đặt hạn mức để nhận cảnh báo khi chi tiêu gần chạm ngưỡng.',
                style: TextStyle(fontSize: 14, color: AppColors.muted, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }
    return AppCard(
      onTap: onOpen,
      child: Column(
        children: [
          for (var i = 0; i < current.length && i < 3; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            _BudgetRow(budget: current[i]),
          ],
        ],
      ),
    );
  }
}

class _BudgetRow extends StatelessWidget {
  const _BudgetRow({required this.budget});

  final BudgetProgress budget;

  @override
  Widget build(BuildContext context) {
    final color = budget.isExceeded
        ? AppColors.danger
        : budget.isWarning
            ? AppColors.amber
            : AppColors.success;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                budget.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
            Text(
              '${budget.usagePercent.round()}%',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: color),
            ),
          ],
        ),
        const SizedBox(height: 7),
        ProgressBar(value: budget.usagePercent / 100, color: color),
        const SizedBox(height: 6),
        Text(
          '${formatMoney(budget.spent)} / ${formatMoney(budget.amountLimit)}',
          style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
        ),
      ],
    );
  }
}

class _RecentList extends StatelessWidget {
  const _RecentList({required this.items, required this.onOpen});

  final List<RecentTxn> items;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const AppCard(
        child: Row(
          children: [
            IconBadge(icon: Icons.receipt_long, color: AppColors.blue),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Chưa có giao dịch nào. Nhấn nút + để ghi khoản thu chi đầu tiên.',
                style: TextStyle(fontSize: 14, color: AppColors.muted, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 6),
      onTap: onOpen,
      child: Column(
        children: [
          for (final item in items)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  IconBadge(
                    icon: item.isIncome ? Icons.south_west : Icons.north_east,
                    color: item.isIncome ? AppColors.success : AppColors.danger,
                    size: 38,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.description.trim().isEmpty
                              ? (item.isIncome ? 'Khoản thu' : 'Khoản chi')
                              : item.description,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(formatDate(item.date), style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      ],
                    ),
                  ),
                  Text(
                    formatSigned(item.amount.abs(), income: item.isIncome),
                    style: moneyStyle.copyWith(
                      fontSize: 14.5,
                      color: item.isIncome ? AppColors.success : AppColors.ink,
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
