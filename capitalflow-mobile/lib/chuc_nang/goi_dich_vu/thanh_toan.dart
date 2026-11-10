import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../vi/dich_vu_vi.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

class PremiumCheckoutScreen extends StatefulWidget {
  const PremiumCheckoutScreen({super.key, required this.order});

  final Json order;

  @override
  State<PremiumCheckoutScreen> createState() => _PremiumCheckoutScreenState();
}

class _PremiumCheckoutScreenState extends State<PremiumCheckoutScreen> {
  late Json _order = widget.order;
  late final AppLifecycleListener _lifecycle;
  Timer? _expiration;
  Timer? _poll;
  bool _foreground = true;
  int _pollFailures = 0;
  late final _api = context.read<AppData>().finance.api;
  late final String? _owner;
  late final String _root;
  late final int _epoch;
  bool _expired = false;
  bool _checking = false;
  bool _opening = false;
  bool _awaitingReturn = false;
  String? _error;
  String? _notice;

  Object? get _status => _order['status'];
  bool get _payable => _status == 'PENDING' && !_expired;
  bool get _canReplace =>
      _expired || const {'EXPIRED', 'FAILED', 'CANCELLED'}.contains(_status);
  bool get _pending => const {'CREATING', 'PENDING'}.contains(_status);
  bool get _sameSession =>
      _owner == _api.tokens.ownerId &&
      _root == _api.config.apiRoot &&
      _epoch == _api.tokens.epoch;

  void _schedulePoll() {
    _poll?.cancel();
    if (!mounted || !_foreground || !_pending || !_sameSession) return;
    final seconds = (_expired ? 30 : 10) * (1 << _pollFailures.clamp(0, 3));
    _poll = Timer(Duration(seconds: seconds.clamp(10, 120)), () async {
      if (!mounted || !_foreground || !_sameSession) return;
      if (ModalRoute.of(context)?.isCurrent != false) {
        await _refresh(automatic: true);
      }
      _schedulePoll();
    });
  }

  @override
  void initState() {
    super.initState();
    _owner = _api.tokens.ownerId;
    _root = _api.config.apiRoot;
    _epoch = _api.tokens.epoch;
    _setExpiration();
    _foreground = WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    _lifecycle = AppLifecycleListener(onStateChange: (state) {
      _foreground = state == AppLifecycleState.resumed;
      if (!_foreground) {
        _poll?.cancel();
        return;
      }
      if (_awaitingReturn) {
        _awaitingReturn = false;
        unawaited(_refresh());
      }
      _schedulePoll();
    });
    _schedulePoll();
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _expiration?.cancel();
    _poll?.cancel();
    super.dispose();
  }

  void _setExpiration() {
    _expiration?.cancel();
    _expired = false;
    if (_status != 'PENDING' && _status != 'CREATING') return;
    final end = parseApiDateTime(_order['expires_at']);
    if (end == null) return;
    final now = parseApiDateTime(_order['server_time']) ?? DateTime.now();
    final remaining = end.difference(now);
    _expired = remaining <= Duration.zero;
    if (!_expired) {
      _expiration = Timer(remaining, () => setState(() => _expired = true));
    }
  }

  Future<void> _refresh({bool replace = false, bool automatic = false}) async {
    if (_checking || _status == 'PAID' || !_sameSession) return;
    final repo = AccountFeatures(_api);
    _checking = true;
    if (!automatic) {
      setState(() {
        _error = null;
        _notice = null;
      });
    }
    try {
      final id = _order['id'].toString();
      final order = !automatic && _status == 'CREATING' && !_expired
          ? await repo.checkout(creatingOrderId: id)
          : await repo.refreshOrder(id);
      if (!mounted || !_sameSession) return;
      _pollFailures = 0;
      setState(() {
        _order = order;
        _error = null;
        _setExpiration();
        if (!_payable) _notice = null;
        if (_payable && !automatic) {
          _notice = 'Chưa ghi nhận thanh toán cho đơn này.';
        }
      });
      if (replace && _canReplace) {
        final replacement = await repo.checkout();
        if (mounted) {
          setState(() {
            _order = replacement;
            _setExpiration();
          });
        }
      }
    } catch (e) {
      _pollFailures++;
      if (mounted && !automatic) setState(() => _error = errorText(e));
    } finally {
      _checking = false;
      if (mounted) {
        if (!automatic) setState(() {});
        _schedulePoll();
      }
    }
  }

  Future<void> _openCheckout(String url) async {
    if (!_payable || _opening || _checking) return;
    setState(() => _opening = true);
    _awaitingReturn = true;
    try {
      await const MethodChannel('capitalflow/checkout')
          .invokeMethod<void>('open', url);
    } catch (_) {
      _awaitingReturn = false;
      if (mounted) {
        showSnack(
            'Không mở được payOS. Hãy thử lại hoặc dùng mã VietQR nếu có.',
            error: true);
      }
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  Future<void> _copy(String value, String label) async {
    if (!_payable) return;
    try {
      await Clipboard.setData(ClipboardData(text: value));
      if (mounted) showSnack('Đã sao chép $label.');
    } catch (_) {
      if (mounted) showSnack('Không sao chép được. Hãy thử lại.', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final paid = _status == 'PAID';
    final amount = _order['amount'];
    final price = '${editMoney(amount)} ₫';
    final url = asText(_order['checkout_url']);
    final checkout = _order['checkout'];
    final transfer = _payable &&
            checkout is Map &&
            amount is int &&
            amount > 0 &&
            checkout['amount'] == amount
        ? checkout
        : null;
    final qr = asText(transfer?['qr_code']);
    final status = _expired
        ? 'Mã đã hết hạn'
        : switch (_status) {
            'PAID' => 'Đã thanh toán',
            'PENDING' => 'Chờ thanh toán',
            'CREATING' => 'Đang tạo đơn',
            'REVIEW' => 'Cần đối soát',
            'EXPIRED' => 'Mã đã hết hạn',
            'CANCELLED' => 'Đã hủy',
            'FAILED' => 'Không thành công',
            _ => 'Chưa xác nhận',
          };
    final expires = parseApiDateTime(_order['expires_at']);
    final premiumUntil = parseApiDateTime(_order['premium_until']);
    final secondary = Theme.of(context)
        .textTheme
        .bodyMedium
        ?.copyWith(color: AppColors.muted, height: 1.4);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(context, 'Thanh toán Premium'),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  Space.screen, Space.xs, Space.screen, Space.xl),
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.soft,
                    borderRadius: BorderRadius.circular(Radii.md),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(Space.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(price, style: AppText.heroMetric),
                        if (_order['days'] != null) ...[
                          const SizedBox(height: Space.xxs),
                          Text('Premium · ${_order['days']} ngày',
                              style: secondary),
                        ],
                        const SizedBox(height: Space.sm),
                        Wrap(
                          spacing: Space.xs,
                          runSpacing: Space.xs,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            StatusChip(status,
                                color: paid
                                    ? const Color(0xFF047857)
                                    : AppColors.blueDark,
                                background: paid
                                    ? AppColors.successSoft
                                    : AppColors.surface),
                            if (_payable && expires != null)
                              Text('Hết hạn ${formatDateTime(expires)}',
                                  style: secondary),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                if (_payable && url != null) ...[
                  const SizedBox(height: Space.md),
                  FilledButton.icon(
                    onPressed:
                        _opening || _checking ? null : () => _openCheckout(url),
                    icon: const Icon(Icons.open_in_new_rounded, size: 20),
                    label: Text(
                        _opening ? 'Đang mở payOS…' : 'Mở payOS để thanh toán',
                        textAlign: TextAlign.center),
                  ),
                  const SizedBox(height: Space.xxs),
                  Text('Dùng khi thanh toán trên điện thoại này.',
                      textAlign: TextAlign.center, style: secondary),
                ],
                if (_error != null || _notice != null) ...[
                  const SizedBox(height: Space.md),
                  Semantics(
                      liveRegion: true,
                      child: InfoBanner(
                          message: _error ?? _notice!,
                          color: _error != null
                              ? AppColors.danger
                              : AppColors.blue)),
                ],
                if (qr != null) ...[
                  const SizedBox(height: Space.xl),
                  _PaymentQr(qr: qr),
                ],
                if (transfer != null) ...[
                  const SizedBox(height: Space.xl),
                  const SectionHeader('Thông tin chuyển khoản'),
                  const SizedBox(height: Space.xxs),
                  _TransferRow(
                      label: 'Ngân hàng', value: asText(transfer['bank_name'])),
                  _TransferRow(
                      label: 'Người nhận',
                      value: asText(transfer['account_name'])),
                  _TransferRow(
                      label: 'Số tài khoản',
                      value: asText(transfer['account_number']),
                      onCopy: _copy),
                  _TransferRow(
                      label: 'Số tiền',
                      value: price,
                      copyValue: amount.toString(),
                      onCopy: _copy),
                  _TransferRow(
                      label: 'Nội dung chuyển khoản',
                      value: asText(transfer['description']),
                      onCopy: _copy),
                  const SizedBox(height: Space.xs),
                  Text('Chuyển đúng số tiền và nội dung để hệ thống xác nhận.',
                      style: secondary),
                ],
                if (!_payable || (transfer == null && url == null)) ...[
                  const SizedBox(height: Space.xl),
                  Text(paid ? 'Thanh toán thành công' : status,
                      style: AppText.section),
                  const SizedBox(height: Space.xs),
                  Text(_statusMessage(premiumUntil), style: secondary),
                  if (_canReplace) ...[
                    const SizedBox(height: Space.md),
                    FilledButton(
                      onPressed:
                          _checking ? null : () => _refresh(replace: true),
                      child: const Text('Tạo mã thanh toán mới'),
                    ),
                  ],
                ],
                const SizedBox(height: Space.lg),
                if (_order['order_code'] != null)
                  Text('Mã đơn ${_order['order_code']}', style: secondary),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: Material(
        color: AppColors.surface,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.fromLTRB(
              Space.screen, Space.xs, Space.screen, Space.xs),
          child: Center(
            heightFactor: 1,
            child: SizedBox(
              width: 520,
              child: paid
                  ? FilledButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Về gói sử dụng'),
                    )
                  : OutlinedButton.icon(
                      onPressed: _checking || _opening ? null : _refresh,
                      icon: const Icon(Icons.refresh_rounded, size: 20),
                      label: Text(
                          _checking ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán',
                          textAlign: TextAlign.center),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  String _statusMessage(DateTime? premiumUntil) {
    if (_expired || _status == 'EXPIRED') {
      return 'Nếu đã chuyển tiền, hãy kiểm tra thanh toán trước khi tạo đơn mới.';
    }
    return switch (_status) {
      'PAID' => premiumUntil == null
          ? 'Premium đã được kích hoạt cho tài khoản của bạn.'
          : 'Premium có hiệu lực đến ${formatDateTime(premiumUntil)}.',
      'CREATING' => 'Đơn đang được chuẩn bị. Hãy kiểm tra lại sau ít phút.',
      'REVIEW' =>
        'Gửi mã đơn bên dưới cho Trung tâm hỗ trợ để đối soát giao dịch.',
      'CANCELLED' ||
      'FAILED' =>
        'Bạn có thể tạo mã mới để tiếp tục thanh toán Premium.',
      _ => 'Chưa có phương thức thanh toán. Hãy kiểm tra lại sau.',
    };
  }
}

class _PaymentQr extends StatelessWidget {
  const _PaymentQr({required this.qr});

  final String qr;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(Radii.md),
        ),
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(children: [
            const Text('Quét mã VietQR',
                style: AppText.section, textAlign: TextAlign.center),
            const SizedBox(height: Space.xxs),
            const Text('Dùng ứng dụng ngân hàng trên thiết bị khác.',
                style: TextStyle(color: AppColors.muted),
                textAlign: TextAlign.center),
            const SizedBox(height: Space.xs),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 212),
              child: Semantics(
                label: 'Mã VietQR thanh toán Premium',
                image: true,
                child: QrImageView(data: qr, backgroundColor: Colors.white),
              ),
            ),
          ]),
        ),
      );
}

class _TransferRow extends StatelessWidget {
  const _TransferRow(
      {required this.label, required this.value, this.copyValue, this.onCopy});

  final String label;
  final String? value;
  final String? copyValue;
  final Future<void> Function(String value, String label)? onCopy;

  @override
  Widget build(BuildContext context) {
    final text = value;
    if (text == null) return const SizedBox.shrink();
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.xs),
        child: Row(children: [
          Expanded(
              child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: Space.xxs),
              SelectableText(text, style: AppText.cardTitle),
            ],
          )),
          if (onCopy != null)
            IconButton(
              tooltip: 'Sao chép ${label.toLowerCase()}',
              onPressed: () => onCopy!(copyValue ?? text, label.toLowerCase()),
              icon: const Icon(Icons.content_copy_rounded,
                  size: 20, color: AppColors.blueDark),
            ),
        ]),
      ),
      const Divider(height: 1, color: AppColors.line),
    ]);
  }
}
