import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

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
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
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
                actionLabel: 'Liên kết ngân hàng',
                onAction: _link,
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
      appBar: appBar('Ngân hàng của tôi'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _link,
        icon: const Icon(Icons.add_link),
        label: const Text('Liên kết ngân hàng'),
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

  Future<void> _submit() async {
    final provider = _current;
    if (provider == null) return;
    final number = _number.text.replaceAll(RegExp(r'\D'), '');
    if (number != provider.demoNumber) {
      setState(() => _formError = 'Hãy dùng số tài khoản được cấp riêng ${provider.demoNumber} của ${provider.name}.');
      return;
    }
    final finance = context.read<AppData>().finance;
    final navigator = Navigator.of(context);
    setState(() {
      _busy = true;
      _formError = null;
    });
    try {
      final challenge = _challenge;
      if (challenge == null) {
        final requestId = await finance.sendBankOtp(provider: provider.code, accountNumber: number);
        if (!mounted) return;
        setState(() => _challenge = requestId);
        showSnack('Đã gửi mã OTP tới email của bạn.');
        return;
      }
      final otp = _otp.text.trim();
      if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
        setState(() => _formError = 'Mã OTP gồm 6 chữ số.');
        return;
      }
      await finance.linkBank(
        provider: provider.code,
        accountNumber: number,
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
                        _number.clear();
                        _resetChallenge();
                      });
                    }
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _number,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (_) => setState(_resetChallenge),
                  decoration: fieldDecoration(
                    provider?.label ?? 'Số tài khoản',
                    icon: Icons.numbers,
                    helper: provider == null ? null : 'Tài khoản cấp riêng cho bạn: ${provider.demoNumber}',
                    suffix: provider == null
                        ? null
                        : TextButton(
                            onPressed: () => setState(() {
                              _number.text = provider.demoNumber;
                              _resetChallenge();
                            }),
                            child: const Text('Dùng số này'),
                          ),
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
                    decoration: fieldDecoration('Mã OTP trong email', icon: Icons.password),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: _busy ? null : () => setState(_resetChallenge),
                      child: const Text('Gửi mã khác (cách nhau ít nhất 30 giây)'),
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
