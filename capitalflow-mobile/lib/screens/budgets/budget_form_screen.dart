import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';
import '../../widgets/pickers.dart';

const Map<String, String> budgetPeriodLabels = {
  'WEEKLY': 'Hàng tuần',
  'MONTHLY': 'Hàng tháng',
  'YEARLY': 'Hàng năm',
  'CUSTOM': 'Tùy chỉnh',
};

/// Tạo hoặc chỉnh sửa ngân sách theo tháng (hoặc tuần/năm/tùy chỉnh) cho toàn bộ
/// chi tiêu hay cho một danh mục chi cụ thể.
class BudgetFormScreen extends StatefulWidget {
  const BudgetFormScreen({super.key, this.existing});

  final BudgetProgress? existing;

  @override
  State<BudgetFormScreen> createState() => _BudgetFormScreenState();
}

class _BudgetFormScreenState extends State<BudgetFormScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _limit = TextEditingController();

  String _period = 'MONTHLY';
  String? _categoryId;
  late DateTime _start;
  late DateTime _end;
  double _warning = 80;
  bool _saving = false;
  bool _nameEdited = false;

  bool get _editing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _name.text = existing.name;
      _nameEdited = true;
      _limit.text = groupThousands(existing.amountLimit.round().toString());
      _period = budgetPeriodLabels.containsKey(existing.periodType) ? existing.periodType : 'CUSTOM';
      _categoryId = existing.categoryId;
      _start = existing.startDate;
      _end = existing.endDate;
      _warning = existing.warningPercent.clamp(50, 100).toDouble();
    } else {
      _applyPeriod('MONTHLY');
      _name.text = _suggestedName();
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _limit.dispose();
    super.dispose();
  }

  /// Tính ngày bắt đầu/kết thúc của kỳ hiện tại theo loại kỳ hạn.
  void _applyPeriod(String period) {
    final now = DateTime.now();
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
      categories: appData.categoriesOf('EXPENSE'),
      selectedId: _categoryId,
      title: 'Phạm vi ngân sách',
      noneLabel: 'Tất cả chi tiêu',
      noneHint: 'Một hạn mức chung cho mọi khoản chi trong kỳ',
    );
    if (choice == null || !mounted) return;
    setState(() {
      _categoryId = choice.category?.id;
      _refreshSuggestedName();
    });
  }

  Future<void> _chooseDate({required bool start}) async {
    final picked = await pickDate(context, initial: start ? _start : _end);
    if (picked == null || !mounted) return;
    setState(() {
      _period = 'CUSTOM';
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
    final limit = parseAmountInput(_limit.text);
    if (name.isEmpty) {
      showSnack('Vui lòng nhập tên ngân sách.', error: true);
      return;
    }
    if (limit <= 0) {
      showSnack('Vui lòng nhập hạn mức lớn hơn 0.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final existing = widget.existing;
      if (existing == null) {
        await appData.finance.createBudget(
          name: name,
          amountLimit: limit,
          periodType: _period,
          startDate: _start,
          endDate: _end,
          warningPercent: _warning.round(),
          categoryId: _categoryId,
        );
        showSnack('Đã tạo ngân sách "$name".');
      } else {
        await appData.finance.updateBudget(
          existing.id,
          name: name,
          amountLimit: limit,
          periodType: _period,
          startDate: _start,
          endDate: _end,
          warningPercent: _warning.round(),
        );
        showSnack('Đã cập nhật ngân sách.');
      }
      await appData.markChanged();
      navigator.pop(true);
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final category = appData.categoryById(_categoryId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(_editing ? 'Sửa ngân sách' : 'Ngân sách mới'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                children: [
                  TextField(
                    controller: _limit,
                    autofocus: !_editing,
                    keyboardType: TextInputType.number,
                    inputFormatters: [ThousandsInputFormatter()],
                    style: moneyStyle.copyWith(fontSize: 22, color: AppColors.ink),
                    decoration: fieldDecoration('Hạn mức chi tiêu (₫)', icon: Icons.flag_outlined),
                  ),
                  const SizedBox(height: 12),
                  PickerField(
                    label: 'Phạm vi áp dụng',
                    value: category?.name ?? 'Tất cả chi tiêu',
                    leading: category == null
                        ? const IconBadge(icon: Icons.all_inclusive, color: AppColors.blue, size: 36)
                        : CategoryAvatar(icon: category.icon, color: category.color, name: category.name, size: 36),
                    onTap: _editing ? null : _chooseCategory,
                  ),
                  if (_editing)
                    const Padding(
                      padding: EdgeInsets.only(top: 6, left: 4),
                      child: Text(
                        'Phạm vi không đổi được sau khi tạo. Hãy tạo ngân sách mới nếu cần danh mục khác.',
                        style: TextStyle(fontSize: 12, color: AppColors.muted),
                      ),
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
                          label: 'Từ ngày',
                          value: formatDate(_start),
                          onTap: () => _chooseDate(start: true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: PickerField(
                          label: 'Đến ngày',
                          value: formatDate(_end),
                          onTap: () => _chooseDate(start: false),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _name,
                    maxLength: 150,
                    onChanged: (_) => _nameEdited = true,
                    decoration: fieldDecoration('Tên ngân sách', icon: Icons.label_outline),
                  ),
                  const SizedBox(height: 12),
                  AppCard(
                    padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.notifications_active_outlined, size: 20, color: AppColors.amber),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Cảnh báo khi dùng tới ${_warning.round()}% hạn mức',
                                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                        Slider(
                          value: _warning,
                          min: 50,
                          max: 100,
                          divisions: 10,
                          label: '${_warning.round()}%',
                          activeColor: AppColors.amber,
                          onChanged: (value) => setState(() => _warning = value),
                        ),
                        const Padding(
                          padding: EdgeInsets.only(right: 8, bottom: 8),
                          child: Text(
                            'Khi chi tiêu chạm ngưỡng này hoặc vượt hạn mức, điện thoại sẽ nhận thông báo nhắc nhở.',
                            style: TextStyle(fontSize: 12.5, height: 1.4, color: AppColors.muted),
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
                label: _editing ? 'Lưu thay đổi' : 'Tạo ngân sách',
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
