import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

/// Ghi nhận giao dịch thủ công (thu hoặc chi) và chỉnh sửa giao dịch đã có.
///
/// Khi người dùng gõ diễn giải mà chưa chọn danh mục, ứng dụng hỏi backend để gợi ý
/// danh mục tự động (dựa trên lịch sử phân loại và từ khóa của danh mục).
class TransactionFormScreen extends StatefulWidget {
  const TransactionFormScreen({super.key, this.existing, this.initialType = 'EXPENSE'});

  final Txn? existing;
  final String initialType;

  @override
  State<TransactionFormScreen> createState() => _TransactionFormScreenState();
}

class _TransactionFormScreenState extends State<TransactionFormScreen> {
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _description = TextEditingController();
  final TextEditingController _note = TextEditingController();

  late String _type;
  late DateTime _date;
  String? _walletId;
  String? _categoryId;
  bool _saving = false;

  Timer? _suggestTimer;
  CategorySuggestion? _suggestion;
  int _suggestRequest = 0;

  bool get _editing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final appData = context.read<AppData>();
    final existing = widget.existing;
    if (existing != null) {
      _type = existing.type;
      _date = existing.date;
      _walletId = existing.accountId;
      _categoryId = existing.categoryId;
      _amount.text = groupThousands(existing.absAmount.round().toString());
      _description.text = existing.description;
      _note.text = existing.note ?? '';
    } else {
      _type = widget.initialType;
      final now = DateTime.now();
      _date = DateTime(now.year, now.month, now.day);
      if (appData.wallets.isNotEmpty) _walletId = appData.wallets.first.id;
    }
    if (!appData.loaded) {
      appData.refreshLookups().then((_) {
        if (!mounted) return;
        setState(() {
          if (_walletId == null && appData.wallets.isNotEmpty) _walletId = appData.wallets.first.id;
        });
      }).catchError((Object _) {});
    }
  }

  @override
  void dispose() {
    _suggestTimer?.cancel();
    _amount.dispose();
    _description.dispose();
    _note.dispose();
    super.dispose();
  }

  void _setType(String type) {
    if (type == _type) return;
    setState(() {
      _type = type;
      // Danh mục thu và chi tách riêng nên phải chọn lại khi đổi loại giao dịch.
      _categoryId = null;
      _suggestion = null;
    });
    _scheduleSuggestion();
  }

  void _scheduleSuggestion() {
    _suggestTimer?.cancel();
    if (_categoryId != null) return;
    final text = _description.text.trim();
    if (text.length < 2) {
      if (_suggestion != null) setState(() => _suggestion = null);
      return;
    }
    _suggestTimer = Timer(const Duration(milliseconds: 600), _fetchSuggestion);
  }

  Future<void> _fetchSuggestion() async {
    final request = ++_suggestRequest;
    final appData = context.read<AppData>();
    try {
      final suggestion = await appData.finance.suggestCategory(
        type: _type,
        description: _description.text.trim(),
        note: _note.text.trim(),
      );
      if (!mounted || request != _suggestRequest || _categoryId != null) return;
      setState(() => _suggestion = suggestion.categoryId == null ? null : suggestion);
    } catch (_) {
      // Gợi ý chỉ là tiện ích; lỗi mạng không cản việc nhập giao dịch.
    }
  }

  Future<void> _chooseWallet() async {
    final appData = context.read<AppData>();
    final wallet = await pickWallet(context, wallets: appData.wallets, selectedId: _walletId);
    if (wallet != null && mounted) setState(() => _walletId = wallet.id);
  }

  Future<void> _chooseCategory() async {
    final appData = context.read<AppData>();
    final choice = await pickCategory(
      context,
      categories: appData.categoriesOf(_type),
      selectedId: _categoryId,
    );
    if (choice == null || !mounted) return;
    setState(() {
      _categoryId = choice.category?.id;
      if (_categoryId != null) _suggestion = null;
    });
    if (_categoryId == null) _scheduleSuggestion();
  }

  Future<void> _chooseDate() async {
    final picked = await pickDate(context, initial: _date, last: DateTime.now().add(const Duration(days: 366)));
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _save() async {
    final amount = parseAmountInput(_amount.text);
    if (amount <= 0) {
      showSnack('Vui lòng nhập số tiền lớn hơn 0.', error: true);
      return;
    }
    final walletId = _walletId;
    if (walletId == null) {
      showSnack('Vui lòng chọn ví cho giao dịch.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final description = _description.text.trim();
      final note = _note.text.trim();
      final existing = widget.existing;
      if (existing == null) {
        final created = await appData.finance.createTransaction(
          accountId: walletId,
          type: _type,
          amount: amount,
          date: _date,
          description: description,
          categoryId: _categoryId,
          note: note,
        );
        final autoCategory = created.categoryWasAuto ? appData.categoryById(created.categoryId)?.name : null;
        showSnack(
          autoCategory == null
              ? 'Đã ghi ${_type == 'INCOME' ? 'khoản thu' : 'khoản chi'} ${formatMoney(amount)}.'
              : 'Đã ghi giao dịch và tự phân loại vào "$autoCategory".',
        );
      } else {
        await appData.finance.updateTransaction(
          existing.id,
          accountId: walletId,
          type: _type,
          amount: amount,
          date: _date,
          description: description,
          categoryId: _categoryId,
          note: note,
        );
        showSnack('Đã cập nhật giao dịch.');
      }
      await appData.markChanged();
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final existing = widget.existing;
    if (existing == null) return;
    final confirmed = await confirmDialog(
      context,
      title: 'Xóa giao dịch?',
      message: 'Số dư ví sẽ được hoàn lại như trước khi ghi giao dịch này.',
      confirmLabel: 'Xóa',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      await appData.finance.deleteTransaction(existing.id);
      await appData.markChanged();
      showSnack('Đã xóa giao dịch và hoàn số dư.');
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final wallet = appData.walletById(_walletId);
    final category = appData.categoryById(_categoryId);
    final isIncome = _type == 'INCOME';
    final accent = isIncome ? AppColors.success : AppColors.danger;
    final suggestion = _suggestion;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(
        _editing ? 'Sửa giao dịch' : 'Giao dịch mới',
        actions: [
          if (_editing)
            IconButton(
              onPressed: _saving ? null : _delete,
              icon: const Icon(Icons.delete_outline, color: AppColors.danger),
              tooltip: 'Xóa giao dịch',
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  SegmentedChoice<String>(
                    options: const [MapEntry('EXPENSE', 'Khoản chi'), MapEntry('INCOME', 'Khoản thu')],
                    value: _type,
                    onChanged: _setType,
                    colorOf: (value) => value == 'INCOME' ? AppColors.success : AppColors.danger,
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Số tiền', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(isIncome ? '+' : '−', style: moneyStyle.copyWith(fontSize: 30, color: accent)),
                            const SizedBox(width: 6),
                            Expanded(
                              child: TextField(
                                controller: _amount,
                                autofocus: !_editing,
                                keyboardType: TextInputType.number,
                                inputFormatters: [ThousandsInputFormatter()],
                                style: moneyStyle.copyWith(fontSize: 30, color: accent),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  hintText: '0',
                                  hintStyle: TextStyle(color: Color(0xFFB8C1D1)),
                                  isCollapsed: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                                ),
                              ),
                            ),
                            Text('₫', style: moneyStyle.copyWith(fontSize: 22, color: AppColors.muted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _description,
                    maxLength: 255,
                    textCapitalization: TextCapitalization.sentences,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => _scheduleSuggestion(),
                    decoration: fieldDecoration(
                      'Diễn giải',
                      icon: Icons.edit_note,
                      hint: isIncome ? 'Ví dụ: Lương tháng 10' : 'Ví dụ: Cà phê Highlands',
                    ),
                  ),
                  if (suggestion != null && _categoryId == null) ...[
                    const SizedBox(height: 8),
                    _SuggestionCard(
                      suggestion: suggestion,
                      onApply: () => setState(() {
                        _categoryId = suggestion.categoryId;
                        _suggestion = null;
                      }),
                    ),
                  ],
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Ví',
                    value: wallet == null ? null : '${wallet.name} · ${formatMoney(wallet.balance, keepSign: true)}',
                    placeholder: appData.wallets.isEmpty ? 'Chưa có ví — hãy tạo ví trước' : 'Chọn ví',
                    leading: wallet == null
                        ? null
                        : IconBadge(
                            icon: walletIcon(wallet.accountType),
                            color: walletColor(wallet.accountType),
                            size: 36,
                          ),
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: _chooseWallet,
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Danh mục',
                    value: category?.name,
                    placeholder: 'Không phân loại (tự gợi ý)',
                    leading: category == null
                        ? null
                        : CategoryAvatar(icon: category.icon, color: category.color, name: category.name, size: 36),
                    icon: Icons.sell_outlined,
                    onTap: _chooseCategory,
                    onClear: () {
                      setState(() => _categoryId = null);
                      _scheduleSuggestion();
                    },
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Ngày giao dịch',
                    value: formatDate(_date),
                    icon: Icons.event_outlined,
                    onTap: _chooseDate,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _note,
                    maxLength: 1000,
                    minLines: 2,
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: fieldDecoration('Ghi chú (không bắt buộc)', icon: Icons.notes),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: _editing ? 'Lưu thay đổi' : 'Lưu giao dịch',
                loading: _saving,
                onPressed: _save,
                icon: Icons.check,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  const _SuggestionCard({required this.suggestion, required this.onApply});

  final CategorySuggestion suggestion;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    final percent = (suggestion.confidence * 100).round();
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3DDA3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, size: 18, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Gợi ý danh mục: ${suggestion.categoryName ?? ''} ($percent%)',
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.warning),
                ),
                Text(
                  suggestion.autoApply
                      ? 'Sẽ tự áp dụng khi lưu nếu bạn không chọn danh mục.'
                      : suggestion.reason,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.warning),
                ),
              ],
            ),
          ),
          TextButton(onPressed: onApply, child: const Text('Áp dụng')),
        ],
      ),
    );
  }
}
