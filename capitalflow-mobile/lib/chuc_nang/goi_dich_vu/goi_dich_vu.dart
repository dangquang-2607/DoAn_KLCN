import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../ha_tang/api.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../vi/dich_vu_vi.dart';
import '../../dung_chung/giao_dien/thuong_hieu.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'thanh_toan.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});
  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  Json? _subscription;
  String? _activeCheckoutId;
  bool _busy = false;
  String? _error;
  AccountFeatures get _repo =>
      AccountFeatures(context.read<AppData>().finance.api);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _run(Future<void> Function() task) async {
    if (!mounted || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await task();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _load() => _run(() async {
        final repo = _repo;
        final subscription = await repo.subscription();
        final activeCheckoutId = await repo.activeCheckoutId();
        if (!mounted) return;
        setState(() {
          _subscription = subscription;
          _activeCheckoutId = activeCheckoutId;
        });
      });
  Future<void> _checkout() async {
    final subscription = _subscription;
    if (_busy || subscription == null) return;
    final activeId = _activeCheckoutId;
    if (activeId == null) {
      if (subscription['payment_available'] != true) return;
      final isPremium = subscription['plan'] == 'PREMIUM';
      final confirmed = await confirmDialog(context,
          title: isPremium ? 'Gia hạn Premium' : 'Nâng cấp Premium',
          message:
              'Tạo đơn ${editMoney(subscription['price'])} ₫ cho ${subscription['days']} ngày? Gói được cập nhật sau khi máy chủ xác nhận thanh toán.',
          confirmLabel: 'Tạo đơn');
      if (!confirmed || !mounted) return;
    }
    Json? order;
    await _run(() async {
      final repo = _repo;
      order = activeId == null
          ? await repo.checkout()
          : await repo.resumeCheckout(activeId);
      final current = await repo.activeCheckoutId();
      if (mounted) setState(() => _activeCheckoutId = current);
    });
    if (!mounted || order == null) return;
    await pushScreen<void>(context, PremiumCheckoutScreen(order: order!));
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final subscription = _subscription;
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            tooltip: 'Đóng',
            icon: const Icon(Icons.close_rounded),
          ),
          const SizedBox(width: Space.xs),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                    Space.screen, 0, Space.screen, Space.bottomInset),
                children: [
                  if (subscription == null) ...[
                    if (_error == null)
                      const LoadingView()
                    else
                      ErrorView(message: _error!, onRetry: _load),
                  ] else ...[
                    _PlanOverview(
                        subscription: subscription,
                        busy: _busy,
                        canResume: _activeCheckoutId != null,
                        onCheckout: _checkout),
                    if (_error != null) ...[
                      const SizedBox(height: Space.md),
                      InfoBanner(message: _error!, color: AppColors.danger),
                    ],
                    const SizedBox(height: Space.xxl),
                    _PlanUsage(subscription: subscription),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

const _planResources = {
  'wallets': 'Ví đang hoạt động',
  'budgets': 'Ngân sách',
  'categories': 'Danh mục cá nhân',
  'ai': 'Lượt nhận dạng AI / tháng',
};

class _PlanOverview extends StatelessWidget {
  const _PlanOverview(
      {required this.subscription,
      required this.busy,
      required this.canResume,
      required this.onCheckout});

  final Json subscription;
  final bool busy;
  final bool canResume;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context) {
    final premium = subscription['plan'] == 'PREMIUM';
    final until = parseApiDateTime(subscription['premium_until']);
    final paymentAvailable = subscription['payment_available'] == true;
    final price = editMoney(subscription['price']);
    final duration = subscription['days'];
    final muted = Theme.of(context)
        .textTheme
        .bodyMedium
        ?.copyWith(color: AppColors.muted, height: 1.45);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: CapitalFlowMark(size: 54)),
        const SizedBox(height: Space.md),
        const Text('CapitalFlow Premium',
            textAlign: TextAlign.center, style: AppText.screenTitle),
        const SizedBox(height: Space.xs),
        Text('Thêm hạn mức ví, ngân sách và nhận dạng hóa đơn.',
            textAlign: TextAlign.center, style: muted),
        const SizedBox(height: Space.lg),
        Center(
            child: StatusChip(premium ? 'Gói Premium' : 'Gói Free',
                color: premium ? AppColors.blueDark : AppColors.muted)),
        if (premium && until != null) ...[
          const SizedBox(height: Space.xs),
          Text('Có hiệu lực đến ${formatDateTime(until)}',
              textAlign: TextAlign.center, style: muted),
        ],
        const SizedBox(height: Space.lg),
        _PlanComparison(plans: subscription['plans'] as Map?),
        const SizedBox(height: Space.xl),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.ink,
            minimumSize: const Size(0, 56),
            padding: const EdgeInsets.symmetric(
                horizontal: Space.md, vertical: Space.sm),
            shape: const StadiumBorder(),
          ),
          onPressed:
              busy || (!paymentAvailable && !canResume) ? null : onCheckout,
          child: Text(
            busy
                ? 'Đang xử lý…'
                : canResume
                    ? 'Tiếp tục thanh toán'
                    : !paymentAvailable
                        ? 'Thanh toán chưa khả dụng'
                        : '${premium ? 'Gia hạn' : 'Nâng cấp'} với $price ₫',
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: Space.sm),
        Text('$duration ngày · Thanh toán một lần',
            textAlign: TextAlign.center, style: muted),
      ],
    );
  }
}

class _PlanComparison extends StatelessWidget {
  const _PlanComparison({required this.plans});

  final Map? plans;

  @override
  Widget build(BuildContext context) {
    final header = Theme.of(context)
        .textTheme
        .bodyMedium
        ?.copyWith(fontWeight: FontWeight.w700, color: AppColors.muted);
    final highlighted = header?.copyWith(color: AppColors.blueDark);
    Widget cell(String value, {TextStyle? style, bool centered = false}) =>
        Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: Space.xs, vertical: Space.sm),
          child: Text(value,
              style: style,
              textAlign: centered ? TextAlign.center : TextAlign.start),
        );
    return DecoratedBox(
      decoration: BoxDecoration(
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(Radii.lg)),
      child: Padding(
        padding: const EdgeInsets.all(Space.xs),
        child: Table(
          defaultVerticalAlignment: TableCellVerticalAlignment.middle,
          columnWidths: const {
            0: FlexColumnWidth(2),
            1: FlexColumnWidth(0.9),
            2: FlexColumnWidth(1.25)
          },
          border: const TableBorder(
              horizontalInside: BorderSide(color: AppColors.line)),
          children: [
            TableRow(children: [
              cell('Hạn mức', style: header),
              cell('Free', centered: true, style: header),
              cell('Premium', centered: true, style: highlighted),
            ]),
            for (final resource in _planResources.entries)
              TableRow(children: [
                cell(resource.value),
                cell('${plans?['FREE']?[resource.key] ?? '—'}', centered: true),
                cell('${plans?['PREMIUM']?[resource.key] ?? '—'}',
                    centered: true, style: highlighted),
              ]),
          ],
        ),
      ),
    );
  }
}

class _PlanUsage extends StatelessWidget {
  const _PlanUsage({required this.subscription});

  final Json subscription;

  @override
  Widget build(BuildContext context) {
    final usage = subscription['usage'];
    final limits = subscription['limits'];
    final pending = asInt(usage?['ai_pending']);
    final muted = Theme.of(context)
        .textTheme
        .bodyMedium
        ?.copyWith(color: AppColors.muted);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Mức sử dụng của bạn'),
        for (final resource in _planResources.entries)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Text(resource.value)),
                const SizedBox(width: Space.sm),
                Text(
                    '${usage?[resource.key] ?? '—'} / ${limits?[resource.key] ?? '—'}',
                    style: muted),
              ],
            ),
          ),
        if (pending > 0) Text('$pending lượt AI đang xử lý', style: muted),
      ],
    );
  }
}

Future<bool> showQuotaLimit(BuildContext context, Object error) async {
  if (error is! ApiException || error.code != 'PLAN_LIMIT_REACHED') {
    return false;
  }
  final open = await confirmDialog(context,
      title: 'Đã đạt hạn mức gói ${error.detail['plan'] ?? ''}',
      message:
          'Bạn đã dùng hết hạn mức cho thao tác này. Xem số lượt đã dùng, giới hạn và các gói hiện có.',
      confirmLabel: 'Xem gói sử dụng');
  if (open && context.mounted) {
    await pushScreen<void>(context, const SubscriptionScreen());
  }
  return true;
}
