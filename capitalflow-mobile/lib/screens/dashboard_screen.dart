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
import '../widgets/charts.dart';
import '../widgets/common.dart';
import 'accounts/accounts_screen.dart';
import 'accounts/bank_money_screen.dart';
import 'accounts/qr_scan_screen.dart';
import 'accounts/receive_sheet.dart';
import 'analytics/analytics_screen.dart';
import 'notifications/notifications_screen.dart';

/// Tổng quan tài chính: lời chào và trạng thái đồng bộ, tiện ích ví (nạp/rút, nhận tiền,
/// QR thanh toán, ví), cơ cấu chi tiêu, phân bổ tài sản theo ví,
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

  /// Mở một tiện ích ví; nếu số dư thay đổi (nạp/rút, chuyển tiền) thì tải lại tổng quan.
  Future<void> _open(Widget screen) async {
    final changed = await pushScreen<bool>(context, screen);
    if (changed == true && mounted) await _pullToRefresh();
  }

  Future<void> _receive(AppData appData) async {
    final wallet = receivingWallet(appData.wallets);
    if (wallet == null) {
      showSnack('Chưa tải được ví nhận tiền. Vui lòng thử lại.', error: true);
      return;
    }
    await showReceiveMoney(context, wallet);
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
                    _WalletUtilities(
                      onTopup: () => _open(const BankMoneyScreen()),
                      onReceive: () => _receive(appData),
                      onScan: () => _open(const QrScanScreen()),
                      onWallets: () => _open(const AccountsScreen()),
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
// Tiện ích ví
// ─────────────────────────────────────────────────────────────────────────────

/// Bốn tiện ích ví theo đúng nghiệp vụ ví độc lập của đồ án: nạp/rút qua ngân hàng
/// liên kết, nhận tiền bằng QR/email/mã ví, quét QR CapitalFlow để chuyển tiền và
/// mở trang Ví (tạo ví, liên kết ngân hàng, thanh toán hóa đơn, lịch sử).
class _WalletUtilities extends StatelessWidget {
  const _WalletUtilities(
      {required this.onTopup,
      required this.onReceive,
      required this.onScan,
      required this.onWallets});

  final VoidCallback onTopup;
  final VoidCallback onReceive;
  final VoidCallback onScan;
  final VoidCallback onWallets;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
            child: _UtilityButton(
                icon: Icons.login_rounded, label: 'Nạp/Rút', onTap: onTopup)),
        Expanded(
            child: _UtilityButton(
                icon: Icons.currency_exchange_rounded,
                label: 'Nhận tiền',
                onTap: onReceive)),
        Expanded(
            child: _UtilityButton(
                icon: Icons.qr_code_scanner_rounded,
                label: 'QR thanh toán',
                onTap: onScan)),
        Expanded(
            child: _UtilityButton(
                icon: Icons.account_balance_wallet_rounded,
                label: 'Ví tiện ích',
                onTap: onWallets)),
      ],
    );
  }
}

class _UtilityButton extends StatelessWidget {
  const _UtilityButton(
      {required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
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
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(Radii.md + 2),
                border: Border.all(color: AppColors.hairline),
                boxShadow: AppShadows.soft,
              ),
              child: Center(
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.blue.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(Radii.sm - 2),
                  ),
                  child: Icon(icon, size: 22, color: AppColors.blue),
                ),
              ),
            ),
            const SizedBox(height: Space.xs),
            Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 12.5,
                  height: 1.25,
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
