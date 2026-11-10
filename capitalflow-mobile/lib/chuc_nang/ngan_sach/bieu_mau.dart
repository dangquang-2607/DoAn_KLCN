import '../goi_dich_vu/goi_dich_vu.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import 'chu_ky.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import 'chi_tiet.dart';

const Map<String, String> budgetPeriodLabels = {
  'WEEKLY': 'Hàng tuần',
  'MONTHLY': 'Hàng tháng',
  'YEARLY': 'Hàng năm',
  'CUSTOM': 'Tùy chỉnh',
};

/// Tạo hoặc chỉnh sửa ngân sách theo tháng (hoặc tuần/năm/tùy chỉnh) cho toàn bộ
/// chi tiêu hay cho một danh mục chi cụ thể.
class BudgetFormScreen extends StatefulWidget {
  const BudgetFormScreen({super.key, this.existing, this.reuse});

  final BudgetProgress? existing;
  final BudgetProgress? reuse;

  @override
  State<BudgetFormScreen> createState() => _BudgetFormScreenState();
}

class _BudgetFormScreenState extends State<BudgetFormScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _limit = TextEditingController();
  final TextEditingController _warningInput = TextEditingController();

  String _period = 'MONTHLY';
  String? _categoryId;
  late DateTime _start;
  late DateTime _end;
  double _warning = 80;
  DateTime? _recurrenceEnd;
  bool _autoRenew = false;
  String _effectiveFrom = 'NEXT';
  bool _saving = false;
  bool _nameEdited = false;
  String? _initialLimitText;
  num? _initialLimit;
  bool _needsScope = false;
  String? _error;

  bool get _recurring => widget.existing?.isRecurring ?? (_period != 'CUSTOM');
  bool get _editing => widget.existing != null;
  DateTime get _nextStart =>
      DateUtils.addDaysToDate(widget.existing!.endDate, 1);
  bool get _hasNext => _autoRenew && _nextStart.year <= 9999;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _nameEdited = true;
      _period = budgetPeriodLabels.containsKey(existing.periodType)
          ? existing.periodType
          : 'CUSTOM';
      _categoryId = existing.categoryId;
      _start = existing.appliesFrom ?? existing.startDate;
      _recurrenceEnd = existing.recurrenceEndDate;
      _end = existing.endDate;
      _autoRenew = existing.autoRenews;
      if (!existing.isRecurring || !_hasNext) _effectiveFrom = 'CURRENT';
      _loadEditValues(existing, _effectiveFrom, preserveChanges: false);
    } else {
      _applyPeriod('MONTHLY');
      _name.text = _suggestedName();
      final reuse = widget.reuse;
      if (reuse != null) {
        _name.text = reuse.name;
        _nameEdited = true;
        _limit.text = editMoney(reuse.raw['amount_limit'] ?? reuse.amountLimit);
        _warning = reuse.warningPercent.clamp(1, 100).toDouble();
        _applyPeriod(reuse.periodType);
        final categories = context.read<AppData>().categories;
        if (categories.any((c) =>
            c.id == reuse.categoryId && c.isActive && c.type == 'EXPENSE')) {
          _categoryId = reuse.categoryId;
        } else if (reuse.categoryId != null) {
          _needsScope = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              showSnack(
                  'Danh mục cũ đã ẩn. Hãy chọn phạm vi mới trước khi lưu.');
            }
          });
        }
        // Start after the original configuration, avoiding overlap with its final period.
        final after = (reuse.recurrenceEndDate ?? reuse.endDate)
            .add(const Duration(days: 1));
        if (!_start.isAfter(after)) _start = after;
        if (_end.isBefore(_start)) _end = _start;
      }
    }
    final source = widget.reuse;
    if (source != null && existing == null) {
      _initialLimitText = _limit.text;
      _initialLimit = source.amountLimit;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _limit.dispose();
    _warningInput.dispose();
    super.dispose();
  }

  /// Tính ngày bắt đầu/kết thúc của kỳ hiện tại theo loại kỳ hạn.
  void _applyPeriod(String period) {
    final now = budgetToday();
    final today = DateTime(now.year, now.month, now.day);
    _period = period;
    switch (period) {
      case 'WEEKLY':
        _start = today.subtract(Duration(days: today.weekday - 1));
        _end = _start.add(const Duration(days: 6));
        break;
      case 'YEARLY':
        _start = DateTime(today.year, 1, 1);
        _end = DateTime(today.year, 12, 31);
        break;
      case 'CUSTOM':
        // Giữ nguyên khoảng ngày đang chọn để người dùng tự chỉnh.
        break;
      default:
        _start = DateTime(today.year, today.month, 1);
        _end = DateTime(today.year, today.month + 1, 0);
        break;
    }
  }

  String _suggestedName() {
    final category = context.read<AppData>().categoryById(_categoryId);
    final scope = category?.name ?? 'Chi tiêu';
    switch (_period) {
      case 'WEEKLY':
        return '$scope tuần này';
      case 'YEARLY':
        return '$scope năm ${_start.year}';
      case 'CUSTOM':
        return scope;
      default:
        return '$scope tháng ${_start.month}/${_start.year}';
    }
  }

  void _refreshSuggestedName() {
    if (!_nameEdited) _name.text = _suggestedName();
  }

  Future<void> _choosePeriod() async {
    final picked = await pickOption<String>(
      context,
      title: 'Kỳ hạn ngân sách',
      options: budgetPeriodLabels.entries.toList(),
      selected: _period,
    );
    if (picked == null || !mounted) return;
    setState(() {
      _applyPeriod(picked);
      _refreshSuggestedName();
    });
  }

  Future<void> _chooseCategory() async {
    final appData = context.read<AppData>();
    final choice = await pickCategory(
      context,
      categories:
          appData.categoriesOf('EXPENSE').where((c) => c.isActive).toList(),
      selectedId: _categoryId,
      title: 'Phạm vi ngân sách',
      noneLabel: 'Tất cả chi tiêu',
      noneHint: 'Một hạn mức chung cho mọi khoản chi trong kỳ',
    );
    if (choice == null || !mounted) return;
    setState(() {
      _categoryId = choice.category?.id;
      _needsScope = false;
      _refreshSuggestedName();
    });
  }

  Future<void> _chooseDate({required bool start}) async {
    final picked = await pickDate(context, initial: start ? _start : _end);
    if (picked == null || !mounted) return;
    setState(() {
      if (!_recurring) _period = widget.existing?.periodType ?? 'CUSTOM';
      if (start) {
        _start = picked;
        if (_end.isBefore(_start)) _end = _start;
      } else {
        _end = picked;
        if (_end.isBefore(_start)) _start = _end;
      }
      _refreshSuggestedName();
    });
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final num limit = _limit.text == _initialLimitText && _initialLimit != null
        ? _initialLimit!
        : parseAmountInput(_limit.text);
    if (_needsScope) {
      showSnack('Vui lòng chọn phạm vi; danh mục cũ không còn hoạt động.',
          error: true);
      return;
    }
    if (_saving) return;
    if (widget.existing?.isCompleted == true) {
      showSnack('Lịch sử chỉ có thể xem.', error: true);
      return;
    }
    if (_editing && name.isEmpty) {
      _showError('Vui lòng nhập tên ngân sách.');
      return;
    }
    if (limit <= 0) {
      _showError('Vui lòng nhập hạn mức lớn hơn 0.');
      return;
    }
    final warning = _editing ? _enteredWarning : _warning;
    if (warning == null ||
        !warning.isFinite ||
        warning < 0.01 ||
        warning > 100) {
      _showError('Nhập ngưỡng cảnh báo từ 0,01 đến 100%.');
      return;
    }
    FocusScope.of(context).unfocus();
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await BudgetLifecycleRepository(appData.finance.api).save(
        BudgetDraft(
            name: name,
            amount: limit,
            amountExact: moneyInput(_limit.text),
            warning: warning,
            period: _period,
            start: _start,
            end: _end,
            categoryId: _categoryId,
            recurrenceEnd: _recurrenceEnd,
            autoRenew: _editing && _recurring ? _autoRenew : null,
            effectiveFrom: _effectiveFrom),
        existing: widget.existing,
      );
      showSnack(_editing ? 'Đã lưu thay đổi ngân sách.' : 'Đã tạo ngân sách.');
      await appData.markChanged();
      if (mounted) navigator.pop(true);
    } catch (error) {
      if (mounted && !await showQuotaLimit(context, error)) {
        _showError(errorText(error));
      }
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showError(String message) {
    if (_editing) setState(() => _error = message);
    showSnack(message, error: true);
  }

  double? get _enteredWarning {
    final text = _warningInput.text.trim();
    if (!RegExp(r'^\d+(?:[,.]\d{1,2})?$').hasMatch(text)) return null;
    return double.tryParse(text.replaceAll(',', '.'));
  }

  String _percent(num value) =>
      value.toStringAsFixed(value % 1 == 0 ? 0 : 2).replaceAll('.', ',');

  String _nameFor(BudgetProgress b, String timing) =>
      timing == 'CURRENT' ? b.name : b.configuredName ?? b.name;
  double _warningFor(BudgetProgress b, String timing) => timing == 'CURRENT'
      ? b.warningPercent
      : b.configuredWarningPercent ?? b.warningPercent;

  void _loadEditValues(BudgetProgress budget, String timing,
      {bool preserveChanges = true}) {
    final current = timing == 'CURRENT';
    final nextAmount = current
        ? budget.amountLimit
        : budget.configuredAmountLimit ?? budget.amountLimit;
    final nextLimitText = editMoney(current
        ? budget.raw['amount_limit'] ?? nextAmount
        : budget.raw['configured_amount_limit'] ??
            budget.raw['amount_limit'] ??
            nextAmount);
    if (!preserveChanges || _name.text == _nameFor(budget, _effectiveFrom)) {
      _name.text = _nameFor(budget, timing);
    }
    if (!preserveChanges || _limit.text == _initialLimitText) {
      _limit.text = nextLimitText;
    }
    if (!preserveChanges ||
        _enteredWarning == _warningFor(budget, _effectiveFrom)) {
      _warningInput.text = _percent(_warningFor(budget, timing));
    }
    _initialLimitText = nextLimitText;
    _initialLimit = nextAmount;
    _effectiveFrom = timing;
  }

  Widget _editDialog(BudgetProgress budget, FinanceCategory? category) {
    final buttonLabel = TextStyle(
        fontFamily: Theme.of(context).textTheme.labelLarge?.fontFamily);
    final next = _recurring && _effectiveFrom == 'NEXT';
    final amount = parseAmountInput(_limit.text);
    final warning = _enteredWarning;
    final validWarning = warning != null && warning >= 0.01 && warning <= 100;
    final draftValid = amount > 0 && validWarning;
    final previewLimit = next ? budget.amountLimit : amount;
    final previewWarning = next ? budget.warningPercent : warning;
    final previewValid = previewLimit > 0 &&
        previewWarning != null &&
        previewWarning > 0 &&
        previewWarning <= 100;
    final usage = previewValid ? budget.spent / previewLimit * 100 : 0.0;
    final changedDates =
        !_recurring && (_start != budget.startDate || _end != budget.endDate);
    final (status, color) = !previewValid
        ? ('Chưa đủ thông tin', AppColors.muted)
        : usage > 100
            ? ('Vượt hạn mức', AppColors.danger)
            : usage >= previewWarning
                ? ('Đạt ngưỡng cảnh báo', AppColors.warning)
                : ('Dưới ngưỡng cảnh báo', AppColors.blue);
    return BudgetDialog(
      title: 'Chỉnh sửa ngân sách',
      busy: _saving,
      footer: Row(children: [
        OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).pop(),
            child: Text('Hủy', style: buttonLabel)),
        const SizedBox(width: Space.xs),
        Expanded(
            child: FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(
              _saving
                  ? 'Đang lưu…'
                  : next
                      ? 'Lưu cho kỳ tiếp theo'
                      : 'Lưu và áp dụng ngay',
              textAlign: TextAlign.center,
              style: buttonLabel),
        )),
      ]),
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) ...[
          InfoBanner(message: _error!, color: AppColors.danger),
          const SizedBox(height: Space.sm)
        ],
        Text(
            '${budgetScope(budget, category)} · ${budgetPeriodLabels[_period] ?? _period} · Từ ${formatDate(_start)}',
            style: AppText.caption),
        const SizedBox(height: Space.sm),
        TextField(
            controller: _name,
            enabled: !_saving,
            maxLength: 150,
            decoration: fieldDecoration('Tên ngân sách')),
        if (_recurring) ...[
          const SizedBox(height: Space.sm),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Tự chuyển kỳ', style: AppText.cardTitle),
            subtitle: Text(
              _autoRenew
                  ? 'Tiếp tục ngân sách khi sang kỳ mới.'
                  : 'Kết thúc sau ngày ${formatDate(budget.endDate)}.',
              style: AppText.caption,
            ),
            value: _autoRenew,
            onChanged: _saving
                ? null
                : (value) => setState(() {
                      _autoRenew = value;
                      if (!value && _effectiveFrom == 'NEXT') {
                        _loadEditValues(budget, 'CURRENT');
                      }
                    }),
          ),
          const SizedBox(height: Space.sm),
          const Text('Áp dụng thay đổi khi nào?', style: AppText.cardTitle),
          const SizedBox(height: Space.xs),
          _timingChoice(budget, 'CURRENT', 'Áp dụng ngay',
              'Tính lại kỳ đang xem', Icons.bolt_outlined),
          const SizedBox(height: Space.xs),
          _timingChoice(
              budget,
              'NEXT',
              'Từ kỳ tiếp theo',
              _hasNext
                  ? 'Bắt đầu ${formatDate(_nextStart)}'
                  : 'Không còn kỳ tiếp theo',
              Icons.schedule_outlined,
              available: _hasNext),
        ],
        const SizedBox(height: Space.md),
        TextField(
          controller: _limit,
          enabled: !_saving,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [ThousandsInputFormatter()],
          decoration: fieldDecoration(
                  _recurring ? 'Hạn mức mỗi kỳ' : 'Hạn mức chi tiêu')
              .copyWith(suffixText: '₫'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: Space.md),
        TextField(
          controller: _warningInput,
          enabled: !_saving,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: fieldDecoration('Cảnh báo khi chi đến (%)'),
          onChanged: (_) => setState(() {}),
        ),
        Slider(
            value: (warning ?? 1).clamp(1, 100).toDouble(),
            min: 1,
            max: 100,
            divisions: 99,
            onChanged: _saving
                ? null
                : (value) =>
                    setState(() => _warningInput.text = _percent(value))),
        Row(children: [
          const Icon(Icons.notifications_active_outlined,
              size: 18, color: AppColors.muted),
          const SizedBox(width: Space.xs),
          Expanded(
              child: Text(
                  draftValid
                      ? 'Cảnh báo từ ${formatMoney(amount * warning / 100)}'
                      : 'Nhập hạn mức và ngưỡng cảnh báo',
                  style: AppText.cardTitle)),
        ]),
        const SizedBox(height: Space.xs),
        Wrap(spacing: Space.xs, children: [
          for (final value in [50, 80, 90])
            ChoiceChip(
                label: Text('$value%', style: buttonLabel),
                showCheckmark: false,
                selected: warning == value,
                onSelected: _saving
                    ? null
                    : (_) => setState(() => _warningInput.text = '$value')),
        ]),
        const SizedBox(height: Space.md),
        Container(
          decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(Radii.sm)),
          padding: const EdgeInsets.all(Space.sm),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (changedDates) ...[
              const Text('Khoảng ngày đã thay đổi', style: AppText.cardTitle),
              Text('${formatDate(_start)} – ${formatDate(_end)}',
                  style: AppText.caption),
              const Text('Chi tiêu và cảnh báo sẽ được tính lại khi lưu.',
                  style: AppText.caption),
            ] else ...[
              Wrap(
                  spacing: Space.xs,
                  runSpacing: Space.xxs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(next ? 'Kỳ này giữ nguyên' : 'Kỳ đang xem sau khi lưu',
                        style: AppText.cardTitle),
                    StatusChip(status, color: color),
                  ]),
              const SizedBox(height: Space.xs),
              Text(
                  '${formatMoney(budget.spent)} / ${previewValid ? formatMoney(previewLimit) : '—'}',
                  style: AppText.cardTitle),
              const SizedBox(height: Space.xs),
              Stack(alignment: Alignment.center, children: [
                ProgressBar(value: usage / 100, color: color),
                if (previewValid)
                  Align(
                      alignment: Alignment(previewWarning / 50 - 1, 0),
                      child: Container(
                          width: 3, height: 14, color: AppColors.ink)),
              ]),
              const SizedBox(height: Space.xs),
              Text(
                  previewValid
                      ? 'Đã dùng ${usage.round()}% · Ngưỡng ${_percent(previewWarning)}%'
                      : 'Chưa đủ thông tin',
                  style: AppText.caption),
              if (next) ...[
                const SizedBox(height: Space.xs),
                Text('Từ ${formatDate(_nextStart)}', style: AppText.cardTitle),
                Text(
                    draftValid
                        ? '${formatMoney(amount)} / kỳ · Cảnh báo ${_percent(warning)}%'
                        : 'Nhập cấu hình cho kỳ tiếp theo.',
                    style: AppText.caption),
              ],
            ],
          ]),
        ),
        if (!_recurring) ...[
          const SizedBox(height: Space.md),
          PickerField(
              label: 'Từ ngày',
              value: formatDate(_start),
              onTap: _saving ? null : () => _chooseDate(start: true)),
          const SizedBox(height: Space.xs),
          PickerField(
              label: 'Đến ngày',
              value: formatDate(_end),
              onTap: _saving ? null : () => _chooseDate(start: false)),
        ],
      ]),
    );
  }

  Widget _timingChoice(BudgetProgress budget, String value, String title,
      String subtitle, IconData icon,
      {bool available = true}) {
    final selected = _effectiveFrom == value;
    final color = !available
        ? AppColors.muted
        : selected
            ? AppColors.blue
            : AppColors.ink;
    final radius = BorderRadius.circular(Radii.sm);
    return Semantics(
      selected: selected,
      child: Material(
        color: selected
            ? AppColors.blue.withValues(alpha: 0.07)
            : AppColors.surface,
        shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: BorderSide(
                color: selected ? AppColors.blue : AppColors.line,
                width: selected ? 2 : 1)),
        child: InkWell(
          borderRadius: radius,
          onTap: !available || _saving || selected
              ? null
              : () => setState(() => _loadEditValues(budget, value)),
          child: Padding(
            padding: const EdgeInsets.all(Space.sm),
            child: Row(children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: Space.sm),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(title,
                        style: AppText.cardTitle.copyWith(color: color)),
                    Text(subtitle, style: AppText.caption),
                  ])),
              if (selected) Icon(Icons.check_rounded, color: color, size: 20),
            ]),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final category = appData.categoryById(_categoryId);
    if (widget.existing case final budget?) {
      return _editDialog(budget, category);
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(context, 'Ngân sách mới'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  TextField(
                    controller: _limit,
                    autofocus: true,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [ThousandsInputFormatter()],
                    style:
                        moneyStyle.copyWith(fontSize: 22, color: AppColors.ink),
                    decoration: fieldDecoration('Hạn mức chi tiêu (₫)',
                        icon: Icons.flag_outlined),
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Phạm vi áp dụng',
                    value: category?.name ?? 'Tất cả chi tiêu',
                    leading: category == null
                        ? const IconBadge(
                            icon: Icons.all_inclusive,
                            color: AppColors.blue,
                            size: 36)
                        : CategoryAvatar(
                            icon: category.icon,
                            color: category.color,
                            name: category.name,
                            size: 36),
                    onTap: _chooseCategory,
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Kỳ hạn',
                    value: budgetPeriodLabels[_period] ?? _period,
                    icon: Icons.autorenew,
                    onTap: _choosePeriod,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: PickerField(
                          label: _recurring ? 'Bắt đầu áp dụng' : 'Từ ngày',
                          value: formatDate(_start),
                          onTap: () => _chooseDate(start: true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: PickerField(
                          label: _recurring ? 'Kết thúc áp dụng' : 'Đến ngày',
                          value: _recurring
                              ? (_recurrenceEnd == null
                                  ? 'Không giới hạn'
                                  : formatDate(_recurrenceEnd!))
                              : formatDate(_end),
                          onTap: _recurring
                              ? null
                              : () => _chooseDate(start: false),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _name,
                    maxLength: 150,
                    onChanged: (_) => _nameEdited = true,
                    decoration: fieldDecoration('Tên ngân sách',
                        icon: Icons.label_outline),
                  ),
                  const SizedBox(height: 12),
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.notifications_active_outlined,
                                size: 20, color: AppColors.amber),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Cảnh báo khi dùng tới ${_warning.round()}% hạn mức',
                                style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                        Slider(
                          value: _warning,
                          min: 1,
                          max: 100,
                          divisions: 99,
                          label: '${_warning.round()}%',
                          activeColor: AppColors.amber,
                          onChanged: (value) =>
                              setState(() => _warning = value),
                        ),
                        const Padding(
                          padding: EdgeInsets.only(right: 8, bottom: 8),
                          child: Text(
                            'Khi chi tiêu chạm ngưỡng này hoặc vượt hạn mức, điện thoại sẽ nhận thông báo nhắc nhở.',
                            style: TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: AppColors.muted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: PrimaryButton(
                label: 'Tạo ngân sách',
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
