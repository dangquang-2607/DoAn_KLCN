import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';

/// Ngân hàng của tôi — giống bản web.
///
/// Liên kết dùng chung cho mọi ví (kể cả ví tạo sau này). Mỗi người dùng được
/// cấp sẵn một số tài khoản demo cho từng ngân hàng; liên kết được xác nhận bằng
/// OTP gửi qua email và có hiệu lực 90 ngày.
class BankLinksScreen extends StatefulWidget {
  const BankLinksScreen({super.key});

  @override
  State<BankLinksScreen> createState() => _BankLinksScreenState();
}

class _BankLinksScreenState extends State<BankLinksScreen> {
  List<BankLink> _links = <BankLink>[];
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    try {
      final links = await context.read<AppData>().finance.bankLinks();
      if (!mounted) return;
      setState(() {
        _links = links;
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

  Future<void> _unlink(BankLink link) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Ngắt liên kết ${link.provider}?',
      message: 'Việc nạp/rút qua ngân hàng này sẽ dừng ở tất cả ví.',
      confirmLabel: 'Ngắt liên kết',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busyId = link.id);
    try {
      await context.read<AppData>().finance.unlinkBank(link.id);
      await _reload();
      showSnack('Đã ngắt liên kết ${link.provider}.');
    } catch (error) {
      showSnack(errorText(error), error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _link() async {
    final linked = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => const _LinkBankForm(),
    );
    if (linked == true) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_error != null && _links.isEmpty) {
      body = ErrorView(message: _error!, onRetry: _reload);
    } else {
      body = RefreshIndicator(
        onRefresh: _reload,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, Space.xl),
          children: [
            const InfoBanner(
              message: 'Liên kết dùng chung cho mọi ví. Ngắt liên kết sẽ dừng nạp/rút qua ngân hàng này ở tất cả ví.',
            ),
            const SizedBox(height: 12),
            if (_links.isEmpty)
              EmptyView(
                icon: Icons.account_balance_outlined,
                title: 'Chưa liên kết ngân hàng',
                message: 'Liên kết một lần để nạp và rút tiền cho tất cả ví của bạn.',
              ),
            for (final link in _links)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: AppCard(
                  child: Row(
                    children: [
                      IconBadge(
                        icon: Icons.account_balance,
                        color: link.connected ? AppColors.blue : AppColors.subtle,
                        size: 44,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(link.provider, style: AppText.cardTitle),
                            const SizedBox(height: 2),
                            Text(link.maskedNumber, style: AppText.caption),
                          ],
                        ),
                      ),
                      StatusChip(
                        link.statusLabel,
                        color: link.connected ? AppColors.success : AppColors.muted,
                      ),
                      if (link.connected)
                        IconButton(
                          tooltip: 'Ngắt liên kết',
                          onPressed: _busyId == link.id ? null : () => _unlink(link),
                          icon: const Icon(Icons.link_off, color: AppColors.danger),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(
        context,
        'Ngân hàng của tôi',
        addAction: PillAddButton(label: 'Liên kết ngân hàng', onPressed: _link),
      ),
      body: body,
    );
  }
}

/// Liên kết ngân hàng: chọn ngân hàng → nhập số tài khoản demo → gửi OTP email → xác nhận.
class _LinkBankForm extends StatefulWidget {
  const _LinkBankForm();

  @override
  State<_LinkBankForm> createState() => _LinkBankFormState();
}

class _LinkBankFormState extends State<_LinkBankForm> {
  final TextEditingController _number = TextEditingController();
  final TextEditingController _otp = TextEditingController();

  List<BankProvider> _providers = <BankProvider>[];
  String? _provider;
  String? _challenge;
  bool _loading = true;
  String? _error;
  // Lỗi khi gửi OTP/xác nhận: hiện ngay trong bảng vì snackbar bị bảng che mất.
  String? _formError;
  bool _busy = false;

  /// Số giây còn lại trước khi được gửi lại mã (máy chủ giới hạn 30 giây).
  int _resendIn = 0;
  Timer? _resendTimer;

  BankProvider? get _current {
    for (final provider in _providers) {
      if (provider.code == _provider) return provider;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _number.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _loadProviders() async {
    try {
      final providers = await context.read<AppData>().finance.bankProviders();
      if (!mounted) return;
      setState(() {
        _providers = providers;
        _provider = providers.isEmpty ? null : providers.first.code;
        _number.text = providers.isEmpty ? '' : providers.first.demoNumber;
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

  void _resetChallenge() {
    _challenge = null;
    _otp.clear();
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    _resendIn = 30;
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) timer.cancel();
    });
  }

  Future<void> _sendOtp() async {
    final provider = _current;
    if (provider == null) return;
    final finance = context.read<AppData>().finance;
    setState(() {
      _busy = true;
      _formError = null;
    });
    try {
      final requestId = await finance.sendBankOtp(
          provider: provider.code, accountNumber: provider.demoNumber);
      if (!mounted) return;
      setState(() {
        _challenge = requestId;
        _otp.clear();
        _startResendCountdown();
      });
      showSnack('Đã gửi mã OTP tới email của bạn.');
    } catch (error) {
      if (mounted) setState(() => _formError = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final provider = _current;
    if (provider == null) return;
    final challenge = _challenge;
    if (challenge == null) return _sendOtp();
    final otp = _otp.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      setState(() => _formError = 'Mã OTP gồm 6 chữ số.');
      return;
    }
    final finance = context.read<AppData>().finance;
    final navigator = Navigator.of(context);
    setState(() {
      _busy = true;
      _formError = null;
    });
    try {
      await finance.linkBank(
        provider: provider.code,
        accountNumber: provider.demoNumber,
        otpRequestId: challenge,
        otp: otp,
      );
      showSnack('Đã liên kết ${provider.name}.');
      navigator.pop(true);
    } catch (error) {
      if (mounted) setState(() => _formError = errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = _current;
    final formError = _formError;
    final email = context.read<AuthController>().profile?.email;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Liên kết ngân hàng', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Text(
                'Liên kết một lần để nạp/rút cho tất cả ví. OTP xác nhận liên kết được gửi qua email.',
                style: TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              const SizedBox(height: 14),
              if (_loading)
                const LoadingView()
              else if (_error != null)
                ErrorView(message: _error!, onRetry: _loadProviders)
              else ...[
                PickerField(
                  label: 'Ngân hàng',
                  value: provider?.name,
                  icon: Icons.account_balance_outlined,
                  onTap: () async {
                    final picked = await pickOption<String>(
                      context,
                      title: 'Chọn ngân hàng',
                      options: [for (final p in _providers) MapEntry(p.code, p.name)],
                      selected: _provider,
                    );
                    if (picked != null && mounted) {
                      setState(() {
                        _provider = picked;
                        _number.text = _current?.demoNumber ?? '';
                        _formError = null;
                        _resetChallenge();
                      });
                    }
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _number,
                  readOnly: true,
                  decoration: fieldDecoration(
                    provider?.label ?? 'Số tài khoản',
                    icon: Icons.numbers,
                    helper: 'Tài khoản mô phỏng được cấp riêng cho bạn.',
                  ),
                ),
                if (_challenge != null) ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _otp,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    autofocus: true,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: (value) {
                      if (value.length == 6 && !_busy) _submit();
                    },
                    decoration: fieldDecoration(
                      'Mã OTP gồm 6 số',
                      icon: Icons.password,
                      helper: email == null ? null : 'Mã đã gửi tới $email',
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _busy || _resendIn > 0 ? null : _sendOtp,
                      child: Text(_resendIn > 0 ? 'Gửi lại mã sau ${_resendIn}s' : 'Gửi lại mã'),
                    ),
                  ),
                ],
                if (formError != null) ...[
                  const SizedBox(height: 10),
                  InfoBanner(message: formError, icon: Icons.error_outline, color: AppColors.danger),
                ],
                const SizedBox(height: 12),
                PrimaryButton(
                  label: _challenge == null ? 'Gửi OTP' : 'Xác nhận liên kết',
                  loading: _busy,
                  onPressed: _submit,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
