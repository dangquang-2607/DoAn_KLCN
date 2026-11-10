import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../vi/dich_vu_vi.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../thong_bao/dong_bo.dart';
import '../../dung_chung/giao_dien/tu_lam_moi.dart';
import 'the_bao_cao.dart';
import 'xu_huong_thang.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../goi_dich_vu/the_nang_cap.dart';
import '../vi/vi_cua_toi.dart';
import '../vi/nap_rut.dart';
import '../vi/quet_qr.dart';
import '../vi/nhan_tien.dart';
import '../vi/lich_su_vi.dart';
import '../bao_cao/bao_cao.dart';
import '../thong_bao/danh_sach.dart';
import '../goi_dich_vu/goi_dich_vu.dart';
import '../giao_dich/chuyen_tien.dart';

/// Tổng quan ví và báo cáo thu chi dùng chung nguồn dữ liệu với bản web.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.onOpenTransactions});

  final VoidCallback onOpenTransactions;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with AutoRefresh<DashboardScreen> {
  DashboardData? _data;
  MonthlyTrendData? _report;
  String? _reportError;
  bool _reportLoading = true;
  int _request = 0;
  Json? _subscription;
  int _subscriptionRequest = 0;
  String? _error;
  bool _loading = true;

  @override
  Future<void> reload() async {
    final request = ++_request;
    await Future.wait(
        [_loadDashboard(request), _loadReport(request), _loadSubscription()]);
  }

  Future<void> _loadSubscription() async {
    final request = ++_subscriptionRequest;
    try {
      final subscription =
          await AccountFeatures(context.read<AppData>().finance.api)
              .subscription();
      if (mounted && request == _subscriptionRequest) {
        setState(() => _subscription = subscription);
      }
    } catch (_) {
      if (mounted && request == _subscriptionRequest) {
        setState(() => _subscription = null);
      }
    }
  }

  Future<void> _openSubscription() async {
    _subscriptionRequest++;
    setState(() => _subscription = null);
    await pushScreen<void>(context, const SubscriptionScreen());
    if (mounted) await _loadSubscription();
  }

  Future<void> _loadDashboard(int request) async {
    final data = context.read<AppData>();
    if (_data == null) setState(() => _loading = true);
    try {
      if (!data.loaded) await data.refreshLookups();
      final result = await data.finance.dashboard();
      if (!mounted || request != _request) return;
      setState(() {
        _data = result;
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

  Future<void> _loadReport(int request) async {
    try {
      final result = await context.read<AppData>().finance.monthlyTrend();
      if (!mounted || request != _request) return;
      setState(() {
        _report = result;
        _reportError = null;
        _reportLoading = false;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _reportError = errorText(error);
        _reportLoading = false;
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
                  onOpenNotifications: () =>
                      pushScreen<void>(context, const NotificationsScreen()),
                ),
              ),
            ),
            if (data == null && _loading)
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(
                    Space.screen, Space.xl, Space.screen, Space.bottomInset),
                sliver: SliverToBoxAdapter(child: _DashboardSkeleton()),
              )
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
                      onTransfer: () => _open(const TransferScreen()),
                    ),
                    const SizedBox(height: Space.md),
                    _WalletSummary(
                      wallets: appData.wallets,
                      onManage: () => _open(const AccountsScreen()),
                      onOpen: (wallet) =>
                          _open(WalletHistoryScreen(wallet: wallet)),
                    ),
                    if (appData.wallets.isNotEmpty &&
                        appData.wallets.every((w) => w.balance == 0) &&
                        data.recent.isEmpty) ...[
                      const SizedBox(height: Space.md),
                      _GettingStarted(
                          onTap: () => _open(const BankMoneyScreen())),
                    ],
                    const SizedBox(height: Space.xl),
                    DashboardReports(
                      report: _report,
                      loading: _reportLoading,
                      error: _reportError,
                      onRetry: reload,
                      promotion: _subscription?['plan'] == 'FREE' &&
                              asInt(_subscription?['price']) > 0
                          ? PremiumBanner(
                              price: _subscription!['price'] as Object,
                              days: asInt(_subscription?['days']),
                              onTap: _openSubscription,
                            )
                          : null,
                      onOpenReport: () => pushScreen<void>(
                          context,
                          AnalyticsScreen(
                            initialAnchor: _report?.through,
                          )),
                    ),
                    const SizedBox(height: Space.xxl),
                    SectionHeader(
                      'Giao dịch gần đây',
                      actionLabel: 'Xem tất cả',
                      onAction: widget.onOpenTransactions,
                      showActionChevron: false,
                      maxTitleLines: 2,
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
    required this.onOpenNotifications,
  });

  final String name;
  final String initials;
  final int unread;
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
              // Chưa tải được hồ sơ: hiện biểu tượng thay vì dấu "?".
              child: initials == '?'
                  ? const Icon(Icons.person_outline_rounded,
                      color: AppColors.blue)
                  : Text(
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
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiện ích ví
// ─────────────────────────────────────────────────────────────────────────────

/// Lối tắt nạp/rút, nhận tiền, quét QR và chuyển tiền.
class _WalletUtilities extends StatelessWidget {
  const _WalletUtilities(
      {required this.onTopup,
      required this.onReceive,
      required this.onScan,
      required this.onTransfer});

  final VoidCallback onTopup;
  final VoidCallback onReceive;
  final VoidCallback onScan;
  final VoidCallback onTransfer;

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
                label: 'Quét mọi QR',
                onTap: onScan)),
        Expanded(
            child: _UtilityButton(
                icon: Icons.swap_horiz_rounded,
                label: 'Chuyển tiền',
                onTap: onTransfer)),
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
    return PressScale(
      scale: 0.92,
      child: _tile(),
    );
  }

  Widget _tile() {
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

/// Gợi ý bước đầu khi ví chưa có tiền và chưa có giao dịch nào.
class _GettingStarted extends StatelessWidget {
  const _GettingStarted({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: const Row(
        children: [
          IconBadge(icon: Icons.rocket_launch_outlined, color: AppColors.blue),
          SizedBox(width: Space.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bắt đầu với ví của bạn', style: AppText.cardTitle),
                SizedBox(height: 2),
                Text(
                  'Liên kết ngân hàng rồi nạp tiền để chuyển tiền và thanh toán.',
                  style: AppText.caption,
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: AppColors.subtle),
        ],
      ),
    );
  }
}

/// Khung giữ chỗ khi tải lần đầu, để trang không nhảy bố cục khi có dữ liệu.
class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  Widget _box(double height, {double? width}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.hairline,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Đang tải tổng quan',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [for (var i = 0; i < 4; i++) _box(58, width: 58)],
          ),
          const SizedBox(height: Space.xxl),
          _box(20, width: 180),
          const SizedBox(height: Space.sm),
          _box(170),
          const SizedBox(height: Space.xxl),
          _box(20, width: 140),
          const SizedBox(height: Space.sm),
          Row(
            children: [
              Expanded(child: _box(110)),
              const SizedBox(width: Space.sm),
              Expanded(child: _box(110)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Tóm tắt tối đa hai ví ngay dưới các tiện ích, ưu tiên ví mặc định.
class _WalletSummary extends StatefulWidget {
  const _WalletSummary(
      {required this.wallets, required this.onManage, required this.onOpen});
  final List<Wallet> wallets;
  final VoidCallback onManage;
  final ValueChanged<Wallet> onOpen;

  @override
  State<_WalletSummary> createState() => _WalletSummaryState();
}

class _WalletSummaryState extends State<_WalletSummary> {
  bool _visible = true;

  @override
  Widget build(BuildContext context) {
    final active = widget.wallets.where((wallet) => wallet.isActive).toList();
    final visible = [
      ...active.where((wallet) => wallet.isDefault),
      ...active.where((wallet) => !wallet.isDefault),
    ].take(2).toList();
    if (visible.isEmpty) {
      return _EmptyHint(
        icon: Icons.account_balance_wallet_outlined,
        text: 'Chưa có ví. Chạm để tạo ví đầu tiên.',
        onTap: widget.onManage,
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: AppColors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: Space.xxs, vertical: Space.xs),
        child: IntrinsicHeight(
            child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            IconButton(
              tooltip: _visible ? 'Ẩn số dư ví' : 'Hiện số dư ví',
              onPressed: () => setState(() => _visible = !_visible),
              icon: Icon(
                _visible
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: 20,
                color: AppColors.muted,
              ),
            ),
            for (var index = 0; index < visible.length; index++) ...[
              if (index > 0)
                const VerticalDivider(
                    width: Space.md, indent: Space.xs, endIndent: Space.xs),
              Expanded(
                  child: InkWell(
                borderRadius: BorderRadius.circular(Radii.md),
                onTap: () => widget.onOpen(visible[index]),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: Space.xxs, vertical: Space.xxs),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(visible[index].name,
                          style: AppText.caption,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: Space.xxs),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                            _visible
                                ? formatMoney(visible[index].balance,
                                    keepSign: true)
                                : '••••••',
                            style: moneyStyle.copyWith(
                                fontSize: 15, color: AppColors.ink)),
                      ),
                    ],
                  ),
                ),
              )),
            ],
            IconButton(
              tooltip: 'Quản lý ví',
              onPressed: widget.onManage,
              icon: const Icon(Icons.chevron_right_rounded,
                  color: AppColors.blueDark),
            ),
          ],
        )),
      ),
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
