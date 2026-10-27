import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/category_style.dart';
import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../services/app_data.dart';
import '../services/app_settings.dart';
import '../services/auth_controller.dart';
import '../services/notification_center.dart';
import '../widgets/auto_refresh.dart';
import '../widgets/charts.dart';
import '../widgets/common.dart';
import 'accounts/accounts_screen.dart';
import 'analytics/analytics_screen.dart';
import 'invoices/invoices_screen.dart';
import 'notifications/notifications_screen.dart';
import 'transactions/transaction_form_screen.dart';
import 'transactions/transfer_screen.dart';

/// Tổng quan tài chính: lời chào và trạng thái đồng bộ, thẻ tổng tài sản, thao tác nhanh,
/// biểu đồ xu hướng thu chi và cơ cấu chi tiêu, phân bổ tài sản theo ví,
/// ngân sách cần chú ý và các giao dịch gần nhất.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen(
      {super.key,
      required this.onOpenTransactions,
      required this.onOpenBudgets});

  final VoidCallback onOpenTransactions;
  final VoidCallback onOpenBudgets;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with AutoRefresh<DashboardScreen> {
  DashboardData? _data;
  List<BudgetProgress> _budgets = <BudgetProgress>[];
  AnalyticsData? _analytics;
  String? _error;
  bool _loading = true;

  @override
  Future<void> reload() async {
    final appData = context.read<AppData>();
    if (_data == null) setState(() => _loading = true);
    try {
      if (!appData.loaded) await appData.refreshLookups();
      final now = DateTime.now();
      final results = await Future.wait<dynamic>([
        appData.finance.dashboard(),
        appData.finance.budgets(),
        // Biểu đồ chỉ là phần bổ sung: lỗi tải báo cáo không làm hỏng cả màn hình.
        appData.finance
            .analytics(
                start: DateTime(now.year, now.month, 1),
                end: DateTime(now.year, now.month + 1, 0))
            .then<AnalyticsData?>((value) => value)
            .catchError((Object _) => _analytics),
      ]);
      if (!mounted) return;
      setState(() {
        _data = results[0] as DashboardData;
        _budgets = results[1] as List<BudgetProgress>;
        _analytics = results[2] as AnalyticsData?;
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
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  Space.screen, Space.md, Space.screen, 0),
              sliver: SliverToBoxAdapter(
                child: _Header(
                  name: profile?.displayName ?? 'bạn',
                  initials: profile?.initials ?? '?',
                  unread: center.unread,
                  realtime: center.realtimeConnected,
                  onOpenNotifications: () =>
                      pushScreen<void>(context, const NotificationsScreen()),
                ),
              ),
            ),
            if (data == null && _loading)
              const SliverFillRemaining(
                  hasScrollBody: false, child: LoadingView())
            else if (data == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: ErrorView(
                    message: _error ?? 'Vui lòng kiểm tra kết nối máy chủ.',
                    onRetry: reload),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                    Space.screen, Space.xl, Space.screen, Space.bottomInset),
                sliver: SliverList.list(
                  children: [
                    if (_error != null) ...[
                      InfoBanner(
                          message: _error!,
                          icon: Icons.cloud_off_rounded,
                          color: AppColors.warning),
                      const SizedBox(height: Space.md),
                    ],
                    _BalanceCard(data: data),
                    const SizedBox(height: Space.xl),
                    const _QuickActions(),
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Xu hướng thu chi',
                      actionLabel: 'Báo cáo',
                      onAction: () =>
                          pushScreen<void>(context, const AnalyticsScreen()),
                    ),
                    _TrendCard(
                      analytics: _analytics,
                      onOpen: () =>
                          pushScreen<void>(context, const AnalyticsScreen()),
                    ),
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Cơ cấu chi tiêu tháng ${data.month}',
                      actionLabel: 'Chi tiết',
                      onAction: () =>
                          pushScreen<void>(context, const AnalyticsScreen()),
                    ),
                    _SpendingBreakdown(
                      analytics: _analytics,
                      onOpen: () =>
                          pushScreen<void>(context, const AnalyticsScreen()),
                    ),
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Ví & tài khoản',
                      actionLabel: 'Quản lý',
                      onAction: () =>
                          pushScreen<void>(context, const AccountsScreen()),
                    ),
                    _WalletStrip(
                      wallets: appData.wallets,
                      onOpen: () =>
                          pushScreen<void>(context, const AccountsScreen()),
                    ),
                    if (appData.wallets
                            .where((wallet) => wallet.balance > 0)
                            .length >
                        1) ...[
                      const SizedBox(height: Space.sm),
                      _WalletAllocation(
                        wallets: appData.wallets,
                        onOpen: () =>
                            pushScreen<void>(context, const AccountsScreen()),
                      ),
                    ],
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Ngân sách kỳ này',
                      actionLabel: 'Xem tất cả',
                      onAction: widget.onOpenBudgets,
                    ),
                    _BudgetPreview(
                        budgets: _budgets, onOpen: widget.onOpenBudgets),
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Giao dịch gần đây',
                      actionLabel: 'Xem tất cả',
                      onAction: widget.onOpenTransactions,
                    ),
                    _RecentList(
                        items: data.recent, onOpen: widget.onOpenTransactions),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Đầu trang
// ─────────────────────────────────────────────────────────────────────────────

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

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 11) return 'Chào buổi sáng';
    if (hour < 14) return 'Chào buổi trưa';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                  color: AppColors.soft, shape: BoxShape.circle),
              child: Text(
                initials,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue),
              ),
            ),
            const SizedBox(width: Space.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_greeting, style: AppText.caption),
                  const SizedBox(height: 2),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: Space.sm),
            TintedIconButton(
              icon: Icons.notifications_none_rounded,
              tooltip: 'Thông báo',
              badgeCount: unread,
              onPressed: onOpenNotifications,
            ),
          ],
        ),
        const SizedBox(height: Space.sm),
        _SyncPill(realtime: realtime),
      ],
    );
  }
}

/// Nhãn trạng thái đồng bộ với web (WebSocket trực tiếp hoặc đồng bộ định kỳ).
class _SyncPill extends StatelessWidget {
  const _SyncPill({required this.realtime});

  final bool realtime;

  @override
  Widget build(BuildContext context) {
    final color = realtime ? AppColors.success : AppColors.amber;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(Radii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: Space.xs),
          Flexible(
            child: Text(
              realtime
                  ? 'Đang đồng bộ trực tiếp với web'
                  : 'Đồng bộ định kỳ với web',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12.5, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thẻ tổng tài sản
// ─────────────────────────────────────────────────────────────────────────────

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.data});

  final DashboardData data;

  static const Color _up = Color(0xFF34D399);
  static const Color _down = Color(0xFFFB7185);

  /// Chuỗi thay thế số tiền khi người dùng chọn ẩn số dư.
  static const String masked = '••••••';

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<AppSettings>();
    final hidden = settings.hideBalance;
    final net = data.incomeThisMonth - data.expenseThisMonth;
    final positive = net >= 0;
    final trendColor = positive ? _up : _down;
    return Container(
      padding: const EdgeInsets.all(Space.xl),
      decoration: BoxDecoration(
        color: AppColors.heroSurface,
        borderRadius: BorderRadius.circular(Radii.xl),
        boxShadow: AppShadows.floating,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Flexible(
                child: Text(
                  'Tổng tài sản',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.heroMuted),
                ),
              ),
              const SizedBox(width: Space.xxs),
              IconButton(
                onPressed: () => settings.setHideBalance(!hidden),
                tooltip: hidden ? 'Hiện số tiền' : 'Ẩn số tiền',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints:
                    const BoxConstraints.tightFor(width: 32, height: 32),
                splashRadius: 18,
                icon: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  transitionBuilder: (child, animation) =>
                      ScaleTransition(scale: animation, child: child),
                  child: Icon(
                    hidden
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                    key: ValueKey<bool>(hidden),
                    size: 18,
                    color: AppColors.heroMuted,
                  ),
                ),
              ),
              const SizedBox(width: Space.xs),
              Flexible(
                  child: Align(
                alignment: Alignment.centerRight,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: Space.xs, vertical: Space.xxs),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(Radii.pill),
                  ),
                  child: Text(
                    'Tháng ${data.month}/${data.year}',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.white),
                  ),
                ),
              )),
            ],
          ),
          const SizedBox(height: Space.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              layoutBuilder: (current, previous) => Stack(
                alignment: Alignment.centerLeft,
                children: [...previous, if (current != null) current],
              ),
              child: Text(
                hidden
                    ? '$masked ₫'
                    : formatMoney(data.netWorth, keepSign: true),
                key: ValueKey<bool>(hidden),
                style: AppText.heroMetric.copyWith(color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: Space.xxs),
          Row(
            children: [
              Icon(
                positive
                    ? Icons.trending_up_rounded
                    : Icons.trending_down_rounded,
                size: 16,
                color: trendColor,
              ),
              const SizedBox(width: Space.xxs),
              Flexible(
                child: Text(
                  '${positive ? 'Dư' : 'Thâm hụt'} ${hidden ? masked : formatMoney(net.abs())} trong tháng',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: trendColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.lg),
          Row(
            children: [
              Expanded(
                child: _FlowStat(
                  label: 'Thu nhập',
                  value: data.incomeThisMonth,
                  icon: Icons.south_west_rounded,
                  accent: _up,
                  hidden: hidden,
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: _FlowStat(
                  label: 'Chi tiêu',
                  value: data.expenseThisMonth,
                  icon: Icons.north_east_rounded,
                  accent: _down,
                  hidden: hidden,
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.md),
          _SpendRatio(
              income: data.incomeThisMonth,
              expense: data.expenseThisMonth,
              up: _up,
              down: _down),
        ],
      ),
    );
  }
}

/// Thanh tỉ lệ chi tiêu so với thu nhập trong tháng, đặt trong thẻ tổng tài sản.
class _SpendRatio extends StatelessWidget {
  const _SpendRatio(
      {required this.income,
      required this.expense,
      required this.up,
      required this.down});

  final double income;
  final double expense;
  final Color up;
  final Color down;

  @override
  Widget build(BuildContext context) {
    final String caption;
    final double ratio;
    final Color color;
    if (income <= 0) {
      ratio = expense > 0 ? 1 : 0;
      color = expense > 0 ? down : AppColors.heroMuted;
      caption = expense > 0
          ? 'Chưa có thu nhập trong tháng'
          : 'Chưa có giao dịch trong tháng';
    } else {
      ratio = expense / income;
      color = ratio > 1
          ? down
          : ratio > 0.8
              ? const Color(0xFFFBBF24)
              : up;
      caption = 'Đã chi ${(ratio * 100).round()}% thu nhập';
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(caption,
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.heroMuted)),
            ),
            if (income > 0)
              Text(
                ratio <= 1
                    ? 'Tiết kiệm ${((1 - ratio) * 100).round()}%'
                    : 'Vượt ${((ratio - 1) * 100).round()}%',
                style: TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w700, color: color),
              ),
          ],
        ),
        const SizedBox(height: Space.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.pill),
          child: TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: ratio.clamp(0, 1).toDouble()),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, value, _) => LinearProgressIndicator(
              value: value,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.10),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ),
      ],
    );
  }
}

class _FlowStat extends StatelessWidget {
  const _FlowStat({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.hidden,
  });

  final String label;
  final double value;
  final IconData icon;
  final Color accent;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Space.sm),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(Radii.chip),
            ),
            child: Icon(icon, size: 18, color: accent),
          ),
          const SizedBox(width: Space.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.heroMuted)),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    hidden ? _BalanceCard.masked : formatMoney(value),
                    style:
                        moneyStyle.copyWith(fontSize: 15, color: Colors.white),
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

// ─────────────────────────────────────────────────────────────────────────────
// Thao tác nhanh
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _QuickAction(
            icon: Icons.north_east_rounded,
            label: 'Ghi chi',
            color: AppColors.danger,
            onTap: () => pushScreen<bool>(
                context, const TransactionFormScreen(initialType: 'EXPENSE')),
          ),
        ),
        Expanded(
          child: _QuickAction(
            icon: Icons.south_west_rounded,
            label: 'Ghi thu',
            color: AppColors.success,
            onTap: () => pushScreen<bool>(
                context, const TransactionFormScreen(initialType: 'INCOME')),
          ),
        ),
        Expanded(
          child: _QuickAction(
            icon: Icons.document_scanner_rounded,
            label: 'Quét hóa đơn',
            color: AppColors.blue,
            onTap: () => pushScreen<bool>(context,
                const InvoicesScreen(startAction: InvoiceStartAction.camera)),
          ),
        ),
        Expanded(
          child: _QuickAction(
            icon: Icons.swap_horiz_rounded,
            label: 'Chuyển ví',
            color: AppColors.amber,
            onTap: () => pushScreen<bool>(context, const TransferScreen()),
          ),
        ),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.xxs),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(Radii.md + 2),
                border: Border.all(color: AppColors.hairline),
                boxShadow: AppShadows.soft,
              ),
              child: Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(Radii.sm - 2),
                  ),
                  child: Icon(icon, size: 20, color: color),
                ),
              ),
            ),
            const SizedBox(height: Space.xs),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Biểu đồ
// ─────────────────────────────────────────────────────────────────────────────

/// Biểu đồ cột thu/chi 6 tháng gần nhất kèm mức chênh lệch so với tháng trước.
class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.analytics, required this.onOpen});

  final AnalyticsData? analytics;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final data = analytics;
    if (data == null || data.trend.isEmpty) {
      return _EmptyHint(
        icon: Icons.bar_chart_rounded,
        text: data == null
            ? 'Chưa tải được dữ liệu biểu đồ. Kéo xuống để thử lại.'
            : 'Chưa đủ dữ liệu để vẽ xu hướng thu chi.',
        onTap: onOpen,
      );
    }
    return AppCard(
      onTap: onOpen,
      padding:
          const EdgeInsets.fromLTRB(Space.md, Space.md, Space.md, Space.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _DeltaStat(
                  label: 'Thu nhập',
                  color: AppColors.success,
                  current: data.income,
                  previous: data.previousIncome,
                  goodWhenUp: true,
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: _DeltaStat(
                  label: 'Chi tiêu',
                  color: AppColors.danger,
                  current: data.expense,
                  previous: data.previousExpense,
                  goodWhenUp: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: Space.md),
          TrendBarChart(points: data.trend, height: 170),
        ],
      ),
    );
  }
}

class _DeltaStat extends StatelessWidget {
  const _DeltaStat({
    required this.label,
    required this.color,
    required this.current,
    required this.previous,
    required this.goodWhenUp,
  });

  final String label;
  final Color color;
  final double current;
  final double previous;
  final bool goodWhenUp;

  @override
  Widget build(BuildContext context) {
    var trend = 'Chưa có tháng trước';
    var trendColor = AppColors.subtle;
    if (previous > 0) {
      final change = (current - previous) / previous * 100;
      if (change.abs() < 0.5) {
        trend = 'Không đổi';
      } else {
        final upward = change > 0;
        trend =
            '${upward ? '▲' : '▼'} ${change.abs().round()}% so với tháng trước';
        trendColor =
            upward == goodWhenUp ? AppColors.success : AppColors.danger;
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LegendDot(color: color, label: label),
        const SizedBox(height: Space.xxs),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(formatMoney(current),
              style: moneyStyle.copyWith(fontSize: 16, color: AppColors.ink)),
        ),
        const SizedBox(height: 2),
        Text(
          trend,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
              fontSize: 11.5, fontWeight: FontWeight.w600, color: trendColor),
        ),
      ],
    );
  }
}

/// Biểu đồ vành khuyên cơ cấu chi tiêu theo danh mục của tháng hiện tại.
class _SpendingBreakdown extends StatelessWidget {
  const _SpendingBreakdown({required this.analytics, required this.onOpen});

  final AnalyticsData? analytics;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final data = analytics;
    if (data == null || data.byCategory.isEmpty) {
      return _EmptyHint(
        icon: Icons.donut_large_rounded,
        text:
            'Chưa có khoản chi nào trong tháng. Biểu đồ sẽ hiện khi bạn ghi chi tiêu.',
        onTap: onOpen,
      );
    }
    final slices = buildSlices(data.byCategory, maxSlices: 5);
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    return AppCard(
      onTap: onOpen,
      padding: const EdgeInsets.all(Space.md),
      child: Row(
        children: [
          DonutChart(
              slices: slices,
              centerLabel: 'Tổng chi',
              centerValue: formatCompact(total),
              size: 132),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(
              children: [
                for (var i = 0; i < slices.length; i++) ...[
                  if (i > 0) const SizedBox(height: Space.xs),
                  _SliceRow(
                      slice: slices[i],
                      share: total <= 0 ? 0 : slices[i].value / total),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SliceRow extends StatelessWidget {
  const _SliceRow({required this.slice, required this.share});

  final ChartSlice slice;
  final double share;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                  color: slice.color, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                slice.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink),
              ),
            ),
            Text(
              '${(share * 100).round()}%',
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.muted),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ProgressBar(value: share, color: slice.color, height: 5),
      ],
    );
  }
}

/// Phân bổ tài sản giữa các ví có số dư dương.
class _WalletAllocation extends StatelessWidget {
  const _WalletAllocation({required this.wallets, required this.onOpen});

  final List<Wallet> wallets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final positive = wallets.where((wallet) => wallet.balance > 0).toList()
      ..sort((a, b) => b.balance.compareTo(a.balance));
    final slices = buildSlices(
      [
        for (final wallet in positive)
          CategoryAmount(wallet.name, wallet.balance)
      ],
      maxSlices: 4,
    );
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    return AppCard(
      onTap: onOpen,
      padding: const EdgeInsets.all(Space.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('Phân bổ tài sản', style: AppText.cardTitle)),
              Text(formatMoney(total),
                  style:
                      moneyStyle.copyWith(fontSize: 14, color: AppColors.ink)),
            ],
          ),
          const SizedBox(height: Space.sm),
          StackedShareBar(slices: slices),
          const SizedBox(height: Space.sm),
          Wrap(
            spacing: Space.md,
            runSpacing: Space.xs,
            children: [
              for (final slice in slices)
                LegendDot(
                  color: slice.color,
                  label:
                      '${slice.label} · ${total <= 0 ? 0 : (slice.value / total * 100).round()}%',
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ví
// ─────────────────────────────────────────────────────────────────────────────

class _WalletStrip extends StatelessWidget {
  const _WalletStrip({required this.wallets, required this.onOpen});

  final List<Wallet> wallets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (wallets.isEmpty) {
      return _EmptyHint(
        icon: Icons.account_balance_wallet_rounded,
        text: 'Chưa có ví nào. Chạm để tạo ví đầu tiên và bắt đầu ghi chép.',
        onTap: onOpen,
      );
    }
    return SizedBox(
      height: 128,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        physics: const BouncingScrollPhysics(),
        itemCount: wallets.length,
        separatorBuilder: (_, __) => const SizedBox(width: Space.sm),
        itemBuilder: (context, index) {
          final wallet = wallets[index];
          final color = walletColor(wallet.accountType);
          return SizedBox(
            width: 168,
            child: AppCard(
              onTap: onOpen,
              padding: const EdgeInsets.all(Space.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconBadge(
                      icon: walletIcon(wallet.accountType),
                      color: color,
                      size: 36),
                  const Spacer(),
                  Text(
                    wallet.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        AppText.caption.copyWith(fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 2),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      formatMoney(wallet.balance, keepSign: true),
                      style: moneyStyle.copyWith(
                        fontSize: 17,
                        color: wallet.balance < 0
                            ? AppColors.danger
                            : AppColors.ink,
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

// ─────────────────────────────────────────────────────────────────────────────
// Ngân sách
// ─────────────────────────────────────────────────────────────────────────────

class _BudgetPreview extends StatelessWidget {
  const _BudgetPreview({required this.budgets, required this.onOpen});

  final List<BudgetProgress> budgets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final current = budgets
        .where((budget) => budget.isActive && budget.isCurrent)
        .toList()
      ..sort((a, b) => b.usagePercent.compareTo(a.usagePercent));
    if (current.isEmpty) {
      return _EmptyHint(
        icon: Icons.donut_large_rounded,
        text:
            'Chưa có ngân sách cho kỳ này. Đặt hạn mức để nhận cảnh báo khi chi tiêu gần chạm ngưỡng.',
        onTap: onOpen,
      );
    }
    return AppCard(
      onTap: onOpen,
      padding: const EdgeInsets.all(Space.lg),
      child: Column(
        children: [
          for (var i = 0; i < current.length && i < 3; i++) ...[
            if (i > 0) const SizedBox(height: Space.lg),
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
    final status = budget.isExceeded
        ? 'Vượt hạn mức'
        : budget.isWarning
            ? 'Sắp chạm'
            : 'An toàn';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(budget.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.cardTitle),
            ),
            const SizedBox(width: Space.xs),
            StatusChip(status, color: color),
          ],
        ),
        const SizedBox(height: Space.sm),
        ProgressBar(value: budget.usagePercent / 100, color: color),
        const SizedBox(height: Space.xs),
        Row(
          children: [
            Expanded(
              child: Text(
                '${formatMoney(budget.spent)} / ${formatMoney(budget.amountLimit)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.caption,
              ),
            ),
            Text(
              '${budget.usagePercent.round()}%',
              style: moneyStyle.copyWith(fontSize: 13, color: color),
            ),
          ],
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Giao dịch gần đây
// ─────────────────────────────────────────────────────────────────────────────

class _RecentList extends StatelessWidget {
  const _RecentList({required this.items, required this.onOpen});

  final List<RecentTxn> items;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const _EmptyHint(
        icon: Icons.receipt_long_rounded,
        text:
            'Chưa có giao dịch nào. Nhấn nút + để ghi khoản thu chi đầu tiên.',
      );
    }
    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: Space.xs),
      onTap: onOpen,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              const Divider(
                  indent: Space.md + 44 + Space.sm, endIndent: Space.md),
            _RecentRow(item: items[i]),
          ],
        ],
      ),
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.item});

  final RecentTxn item;

  @override
  Widget build(BuildContext context) {
    final title = item.description.trim().isEmpty
        ? (item.isIncome ? 'Khoản thu' : 'Khoản chi')
        : item.description;
    return Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm),
      child: Row(
        children: [
          IconBadge(
            icon: item.isIncome
                ? Icons.south_west_rounded
                : Icons.north_east_rounded,
            color: item.isIncome ? AppColors.success : AppColors.danger,
            size: 44,
          ),
          const SizedBox(width: Space.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.cardTitle),
                const SizedBox(height: Space.xxs),
                Text(formatDate(item.date), style: AppText.caption),
              ],
            ),
          ),
          const SizedBox(width: Space.sm),
          Text(
            formatSigned(item.amount.abs(), income: item.isIncome),
            style: moneyStyle.copyWith(
                fontSize: 15,
                color: item.isIncome ? AppColors.success : AppColors.ink),
          ),
        ],
      ),
    );
  }
}

/// Thẻ gợi ý khi một nhóm chưa có dữ liệu.
class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.icon, required this.text, this.onTap});

  final IconData icon;
  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(Space.md),
      child: Row(
        children: [
          IconBadge(icon: icon, color: AppColors.blue, size: 44),
          const SizedBox(width: Space.sm),
          Expanded(
              child: Text(text, style: AppText.caption.copyWith(fontSize: 14))),
          if (onTap != null) ...[
            const SizedBox(width: Space.xs),
            const Icon(Icons.chevron_right_rounded, color: AppColors.subtle),
          ],
        ],
      ),
    );
  }
}
