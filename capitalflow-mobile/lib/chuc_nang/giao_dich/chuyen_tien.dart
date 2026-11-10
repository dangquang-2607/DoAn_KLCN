import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../ha_tang/api.dart';
import '../../dung_chung/giao_dien/kieu_danh_muc.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import '../vi/quet_qr.dart';

/// Chuyển tiền giữa các ví với tra cứu người nhận và bước xác nhận riêng.
class TransferScreen extends StatefulWidget {
  const TransferScreen({super.key, this.fromWalletId, this.initialTarget});

  final String? fromWalletId;
  final String? initialTarget;

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final _amount = TextEditingController();
  final _target = TextEditingController();
  final _note = TextEditingController();

  String? _fromId;
  Recipient? _recipient;
  String? _targetError;
  String? _amountError;
  String _lookupValue = '';
  bool _fillCode = false;
  bool _retryLookup = false;
  bool _lookingUp = false;
  bool _reviewing = false;
  bool _preparing = false;
  Timer? _debounce;
  int _lookupVersion = 0;

  Wallet? _source(AppData data) =>
      _fromId == null ? data.wallets.firstOrNull : data.walletById(_fromId);

  bool _sameWallet(Wallet? from) =>
      from != null && _recipient?.walletId == from.id;

  @override
  void initState() {
    super.initState();
    _fromId = widget.fromWalletId;
    final initial = widget.initialTarget?.trim();
    if (initial != null && initial.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _selectTarget(initial);
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _target.dispose();
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  void _selectTarget(String value) {
    _target.clear();
    _startLookup(value, fillCode: true, immediately: true);
  }

  void _startLookup(String input,
      {bool immediately = false, bool fillCode = false}) {
    _debounce?.cancel();
    final version = ++_lookupVersion;
    final value = input.trim();
    final shouldLookup = value.isNotEmpty &&
        (immediately ||
            isCapitalFlowQr(value) ||
            _completeTarget.hasMatch(value));
    setState(() {
      _lookupValue = value;
      _fillCode = fillCode;
      _recipient = null;
      _targetError = null;
      _retryLookup = false;
      _lookingUp = shouldLookup;
    });
    if (!shouldLookup) return;
    if (immediately) {
      unawaited(_resolve(value, version, fillCode));
    } else {
      _debounce = Timer(const Duration(milliseconds: 500),
          () => _resolve(value, version, fillCode));
    }
  }

  static final _completeTarget = RegExp(
    r'^(?:CF-[A-Z0-9]{8}|[^\s@]+@[^\s@]+\.[^\s@]+|[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12})$',
    caseSensitive: false,
  );

  Future<void> _resolve(String value, int version, bool fillCode) async {
    try {
      final resolved =
          await context.read<AppData>().finance.resolveRecipient(value);
      if (!mounted || version != _lookupVersion) return;
      if (fillCode) _target.text = resolved.receiveCode ?? '';
      setState(() {
        _recipient = resolved;
        _lookingUp = false;
      });
    } catch (error) {
      if (!mounted || version != _lookupVersion) return;
      setState(() {
        _targetError = errorText(error);
        _retryLookup = error is ApiException && error.uncertain;
        _lookingUp = false;
      });
    }
  }

  Future<void> _scanQr() async {
    FocusScope.of(context).unfocus();
    final value = await pushScreen<String>(
        context, const QrScanScreen(pickOnly: true, transferOnly: true));
    if (value != null && mounted) _selectTarget(value);
  }

  Future<void> _chooseSource() async {
    final data = context.read<AppData>();
    final wallet = await pickWallet(
      context,
      wallets: data.wallets,
      selectedId: _source(data)?.id,
      title: 'Chuyển từ ví',
    );
    if (wallet == null || !mounted) return;
    setState(() {
      _fromId = wallet.id;
      _amountError = null;
    });
  }

  Future<void> _chooseOwnWallet() async {
    final data = context.read<AppData>();
    final wallet = await pickWallet(
      context,
      wallets: data.wallets,
      excludeId: _source(data)?.id,
      title: 'Chuyển đến ví của bạn',
    );
    if (wallet != null && mounted) _selectTarget(wallet.id);
  }

  Future<void> _review() async {
    final appData = context.read<AppData>();
    final from = _source(appData);
    final recipient = _recipient;
    if (_reviewing ||
        _lookingUp ||
        from == null ||
        recipient == null ||
        _sameWallet(from)) {
      return;
    }
    final amount = moneyInput(_amount.text);
    final value = num.tryParse(amount ?? '');
    if (amount == null || value == null || value <= 0) {
      setState(() => _amountError = 'Nhập số tiền hợp lệ, lớn hơn 0.');
      return;
    }
    if (value > from.balance) {
      setState(() => _amountError = 'Số dư ví không đủ để chuyển.');
      return;
    }

    final version = _lookupVersion;
    final api = appData.finance.api;
    final session = (api.config.apiRoot, api.tokens.epoch);
    FocusScope.of(context).unfocus();
    setState(() {
      _reviewing = true;
      _preparing = true;
    });
    try {
      var note = _note.text.trim();
      if (note.isEmpty) {
        final auth = context.read<AuthController>();
        if (auth.profile == null) await auth.refreshProfile();
        if (!mounted) return;
        note = _defaultNote(auth.profile?.fullName);
      }
      if (version != _lookupVersion) return;
      if (note.length > 200) {
        showSnack('Nội dung chuyển tiền vượt quá 200 ký tự.', error: true);
        return;
      }
      setState(() => _preparing = false);
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _TransferReviewDialog(
          from: from,
          recipient: recipient,
          amount: amount,
          note: note,
          onConfirm: () {
            if (session != (api.config.apiRoot, api.tokens.epoch)) {
              throw ApiException('Phiên đã thay đổi. Hãy mở lại màn hình.',
                  statusCode: 401);
            }
            return appData.finance.transferBetweenWallets(
              fromWalletId: from.id,
              toWalletId: recipient.walletId,
              amount: amount,
              note: note,
            );
          },
        ),
      );
      if (confirmed != true || !mounted) return;
      await appData.markChanged();
      if (!mounted) return;
      showSnack(
          'Đã chuyển ${editMoney(amount)} ₫ tới ${recipient.recipientName}.');
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) showSnack(errorText(error), error: true);
    } finally {
      if (mounted) {
        setState(() {
          _reviewing = false;
          _preparing = false;
        });
      }
    }
  }

  String _defaultNote(String? fullName) {
    var name = fullName?.trim() ?? '';
    if (name.isEmpty) name = 'Người dùng CapitalFlow';
    // Giữ cùng giới hạn UTF-16 với web và API, kể cả tên có emoji.
    if (name.length > 188) {
      name =
          name.substring(0, 188).replaceFirst(RegExp(r'[\uD800-\uDBFF]$'), '');
    }
    return '$name chuyển tiền';
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final from = _source(appData);
    final hasOtherWallets = appData.wallets.any((w) => w.id != from?.id);
    final canReview = from != null &&
        _recipient != null &&
        !_sameWallet(from) &&
        !_lookingUp &&
        _amount.text.trim().isNotEmpty &&
        !_reviewing;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(context, 'Chuyển tiền'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: IgnorePointer(
                    ignoring: _reviewing,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(
                          Space.md, Space.xs, Space.md, Space.md),
                      children: [
                        PickerField(
                          label: 'Từ ví',
                          value: from == null
                              ? null
                              : '${from.name} · ${formatMoney(from.balance, keepSign: true)}',
                          placeholder: 'Chọn ví',
                          leading: from == null
                              ? null
                              : IconBadge(
                                  icon: walletIcon(from.accountType),
                                  color: walletColor(from.accountType),
                                  size: 36),
                          icon: Icons.account_balance_wallet_outlined,
                          onTap: _chooseSource,
                        ),
                        const SizedBox(height: Space.sm),
                        TextField(
                          controller: _target,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autocorrect: false,
                          maxLength: 512,
                          onChanged: _startLookup,
                          decoration: fieldDecoration(
                            'Mã người nhận',
                            icon: Icons.person_outline_rounded,
                            hint: 'Nhập email hoặc mã ví CF-…',
                            suffix: IconButton(
                              tooltip: 'Quét mã QR',
                              onPressed: _scanQr,
                              icon: const Icon(Icons.qr_code_scanner_rounded,
                                  color: AppColors.blueDark),
                            ),
                          ).copyWith(counterText: ''),
                        ),
                        _recipientStatus(from),
                        if (hasOtherWallets)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              onPressed: _chooseOwnWallet,
                              icon: const Icon(Icons.swap_horiz_rounded,
                                  size: 18),
                              label: const Text('Chọn một ví khác của bạn'),
                            ),
                          ),
                        const SizedBox(height: Space.md),
                        TextField(
                          controller: _amount,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          inputFormatters: [ThousandsInputFormatter()],
                          textInputAction: TextInputAction.next,
                          onChanged: (_) => setState(() => _amountError = null),
                          style: moneyStyle.copyWith(
                              fontSize: 20, color: AppColors.ink),
                          decoration: fieldDecoration(
                            'Số tiền chuyển (₫)',
                            icon: Icons.payments_outlined,
                            helper: from == null
                                ? null
                                : 'Số dư khả dụng: ${formatMoney(from.balance)}',
                          ).copyWith(
                            errorText: _amountError,
                            floatingLabelBehavior: FloatingLabelBehavior.always,
                          ),
                        ),
                        const SizedBox(height: Space.xs),
                        AmountChips(
                          controller: _amount,
                          max: from?.balance,
                          onChanged: () => setState(() => _amountError = null),
                        ),
                        const SizedBox(height: Space.md),
                        TextField(
                          controller: _note,
                          maxLength: 200,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: fieldDecoration(
                            'Nội dung chuyển tiền (tùy chọn)',
                            helper:
                                'Để trống để dùng tên của bạn kèm “chuyển tiền”.',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      Space.md, Space.xxs, Space.md, Space.sm),
                  child: PrimaryButton(
                    label: 'Chuyển tiền',
                    loading: _preparing,
                    onPressed: canReview ? _review : null,
                    icon: Icons.arrow_forward_rounded,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _recipientStatus(Wallet? from) {
    final recipient = _recipient;
    final error =
        _sameWallet(from) ? 'Ví nhận phải khác ví gửi.' : _targetError;
    if (!_lookingUp && error == null && recipient == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: Space.xs),
      child: Semantics(
        liveRegion: true,
        child: _lookingUp
            ? const Text('Đang tìm người nhận…',
                style: TextStyle(color: AppColors.muted))
            : error != null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(error,
                          style: const TextStyle(color: AppColors.danger)),
                      if (_retryLookup)
                        TextButton(
                          onPressed: () => _startLookup(_lookupValue,
                              fillCode: _fillCode, immediately: true),
                          child: const Text('Thử lại'),
                        ),
                    ],
                  )
                : DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.successSoft,
                      borderRadius: BorderRadius.circular(Radii.sm),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(Space.sm),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_outline_rounded,
                              color: Color(0xFF047857), size: 20),
                          const SizedBox(width: Space.xs),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(recipient!.recipientName,
                                    style: AppText.cardTitle),
                                if (recipient.walletName.isNotEmpty)
                                  Text(
                                      recipient.isOwn
                                          ? '${recipient.walletName} · Ví của bạn'
                                          : recipient.walletName,
                                      style: const TextStyle(
                                          color: AppColors.muted)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
      ),
    );
  }
}

class _TransferReviewDialog extends StatefulWidget {
  const _TransferReviewDialog({
    required this.from,
    required this.recipient,
    required this.amount,
    required this.note,
    required this.onConfirm,
  });

  final Wallet from;
  final Recipient recipient;
  final String amount;
  final String note;
  final Future<void> Function() onConfirm;

  @override
  State<_TransferReviewDialog> createState() => _TransferReviewDialogState();
}

class _TransferReviewDialogState extends State<_TransferReviewDialog> {
  bool _sending = false;
  String? _error;

  Future<void> _confirm() async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.onConfirm();
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = errorText(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: !_sending,
        child: AlertDialog(
          insetPadding: const EdgeInsets.symmetric(
              horizontal: Space.md, vertical: Space.xl),
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          scrollable: true,
          title: const Text('Kiểm tra thông tin chuyển tiền',
              style: AppText.section),
          content: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('${editMoney(widget.amount)} ₫',
                  style: AppText.heroMetric.copyWith(color: AppColors.ink)),
              const SizedBox(height: Space.md),
              _ReviewLine('Ví gửi', widget.from.name),
              _ReviewLine('Người nhận', widget.recipient.recipientName),
              if (widget.recipient.walletName.isNotEmpty)
                _ReviewLine('Ví nhận', widget.recipient.walletName),
              if (widget.recipient.receiveCode case final code?)
                _ReviewLine('Mã ví / email', code),
              _ReviewLine('Nội dung', widget.note),
              if (_error != null) ...[
                const SizedBox(height: Space.sm),
                Semantics(
                    liveRegion: true,
                    child:
                        InfoBanner(message: _error!, color: AppColors.danger)),
              ],
            ],
          ),
          actions: [
            PillBackButton(
              onPressed: _sending ? null : () => Navigator.of(context).pop(),
            ),
            FilledButton(
              onPressed: _sending ? null : _confirm,
              child: Text(_sending ? 'Đang chuyển…' : 'Xác nhận'),
            ),
          ],
        ),
      );
}

class _ReviewLine extends StatelessWidget {
  const _ReviewLine(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: Space.xs),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
                flex: 2,
                child: Text(label,
                    style: const TextStyle(color: AppColors.muted))),
            const SizedBox(width: Space.xs),
            Expanded(
                flex: 3,
                child: Text(value,
                    style: AppText.cardTitle, textAlign: TextAlign.end)),
          ],
        ),
      );
}
