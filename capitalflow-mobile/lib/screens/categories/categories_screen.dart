import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/category_style.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';

/// Quản lý danh mục thu – chi. Danh mục hệ thống chỉ xem; danh mục cá nhân được
/// tạo, sửa, ẩn và gắn từ khóa để phục vụ tự động phân loại giao dịch.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  String _type = 'EXPENSE';
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    final appData = context.read<AppData>();
    setState(() {
      _loading = !appData.loaded;
      _error = null;
    });
    try {
      await appData.refreshLookups();
      if (mounted) setState(() => _loading = false);
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = errorText(error);
        });
      }
    }
  }

  Future<void> _openForm([FinanceCategory? category]) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => _CategoryForm(existing: category, initialType: _type),
    );
  }

  Future<void> _delete(FinanceCategory category) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Ẩn danh mục?',
      message: 'Danh mục "${category.name}" sẽ không còn hiển thị khi tạo giao dịch mới. '
          'Các giao dịch cũ vẫn giữ nguyên phân loại.',
      confirmLabel: 'Ẩn danh mục',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    try {
      await appData.finance.deleteCategory(category.id);
      await appData.markChanged();
      showSnack('Đã ẩn danh mục "${category.name}".');
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  void _showActions(FinanceCategory category) {
    showPickerSheet<void>(
      context,
      title: category.name,
      children: (sheetContext) => [
        SheetOption(
          title: 'Chỉnh sửa danh mục',
          leading: const Icon(Icons.edit_outlined, color: AppColors.ink),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _openForm(category);
          },
        ),
        SheetOption(
          title: 'Ẩn danh mục',
          leading: const Icon(Icons.visibility_off_outlined, color: AppColors.danger),
          onTap: () {
            Navigator.of(sheetContext).pop();
            _delete(category);
          },
        ),
      ],
    );
  }

  Widget _tile(FinanceCategory category) {
    final keywords = (category.keywords ?? '').trim();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        onTap: category.isSystem ? null : () => _showActions(category),
        child: Row(
          children: [
            CategoryAvatar(icon: category.icon, color: category.color, name: category.name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    category.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  if (keywords.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Từ khóa: $keywords',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                    ),
                  ],
                ],
              ),
            ),
            if (category.isSystem)
              const Icon(Icons.lock_outline, size: 18, color: AppColors.muted)
            else
              const Icon(Icons.more_horiz, color: AppColors.muted),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appData = context.watch<AppData>();
    final categories = appData.categoriesOf(_type);
    final mine = categories.where((category) => !category.isSystem).toList();
    final system = categories.where((category) => category.isSystem).toList();

    Widget content;
    if (_loading) {
      content = const LoadingView();
    } else if (_error != null && categories.isEmpty) {
      content = ErrorView(message: _error!, onRetry: _refresh);
    } else {
      content = RefreshIndicator(
        onRefresh: _refresh,
        color: AppColors.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            const SectionHeader('Danh mục của bạn'),
            if (mine.isEmpty)
              AppCard(
                onTap: _openForm,
                child: const Text(
                  'Chưa có danh mục riêng. Chạm để tạo danh mục và gắn từ khóa giúp hệ thống tự phân loại giao dịch.',
                  style: TextStyle(fontSize: 13.5, height: 1.4, color: AppColors.muted),
                ),
              ),
            for (final category in mine) _tile(category),
            const SectionHeader('Danh mục hệ thống'),
            if (system.isEmpty)
              const AppCard(
                child: Text(
                  'Chưa có danh mục hệ thống. Quản trị viên có thể thêm từ cổng quản trị web.',
                  style: TextStyle(fontSize: 13.5, height: 1.4, color: AppColors.muted),
                ),
              ),
            for (final category in system) _tile(category),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar('Danh mục thu – chi'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openForm,
        icon: const Icon(Icons.add),
        label: const Text('Thêm danh mục'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SegmentedChoice<String>(
              options: const [MapEntry('EXPENSE', 'Danh mục chi'), MapEntry('INCOME', 'Danh mục thu')],
              value: _type,
              onChanged: (value) => setState(() => _type = value),
              colorOf: (value) => value == 'INCOME' ? AppColors.success : AppColors.danger,
            ),
          ),
          Expanded(child: content),
        ],
      ),
    );
  }
}

class _CategoryForm extends StatefulWidget {
  const _CategoryForm({this.existing, required this.initialType});

  final FinanceCategory? existing;
  final String initialType;

  @override
  State<_CategoryForm> createState() => _CategoryFormState();
}

class _CategoryFormState extends State<_CategoryForm> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _keywords = TextEditingController();

  late String _type;
  String _icon = 'package';
  String _color = 'cobalt';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _type = existing?.type ?? widget.initialType;
    if (existing != null) {
      _name.text = existing.name;
      _keywords.text = existing.keywords ?? '';
      _icon = categoryIconData(existing.icon) == null ? 'package' : existing.icon!;
      _color = existing.color ?? 'cobalt';
    } else {
      _icon = _type == 'INCOME' ? 'wallet' : 'shopping-bag';
      _color = _type == 'INCOME' ? 'green' : 'orange';
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _keywords.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showSnack('Vui lòng nhập tên danh mục.', error: true);
      return;
    }
    final appData = context.read<AppData>();
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    try {
      final existing = widget.existing;
      if (existing == null) {
        await appData.finance.createCategory(
          name: name,
          type: _type,
          icon: _icon,
          color: _color,
          keywords: _keywords.text,
        );
        showSnack('Đã thêm danh mục "$name".');
      } else {
        await appData.finance.updateCategory(
          existing.id,
          name: name,
          icon: _icon,
          color: _color,
          keywords: _keywords.text,
        );
        showSnack('Đã cập nhật danh mục.');
      }
      await appData.markChanged();
      navigator.pop();
    } catch (error) {
      showSnack(errorText(error), error: true);
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  CategoryAvatar(icon: _icon, color: _color, name: _name.text, size: 46),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục ${_type == 'INCOME' ? 'thu' : 'chi'}',
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (!editing) ...[
                SegmentedChoice<String>(
                  options: const [MapEntry('EXPENSE', 'Chi tiêu'), MapEntry('INCOME', 'Thu nhập')],
                  value: _type,
                  onChanged: (value) => setState(() => _type = value),
                  colorOf: (value) => value == 'INCOME' ? AppColors.success : AppColors.danger,
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _name,
                maxLength: 100,
                textCapitalization: TextCapitalization.sentences,
                decoration: fieldDecoration('Tên danh mục', icon: Icons.label_outline),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _keywords,
                maxLength: 1000,
                minLines: 1,
                maxLines: 3,
                decoration: fieldDecoration(
                  'Từ khóa tự phân loại',
                  icon: Icons.auto_awesome,
                  hint: 'highlands, cà phê, trà sữa',
                  helper: 'Cách nhau bằng dấu phẩy. Giao dịch có diễn giải chứa từ khóa sẽ được gợi ý vào danh mục này.',
                ),
              ),
              const SizedBox(height: 14),
              const Text('Màu sắc', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.muted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final option in categoryColors)
                    GestureDetector(
                      onTap: () => setState(() => _color = option.key),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: option.value,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _color == option.key ? AppColors.ink : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                        child: _color == option.key ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              const Text('Biểu tượng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.muted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final option in categoryIcons)
                    Tooltip(
                      message: option.label,
                      child: GestureDetector(
                        onTap: () => setState(() => _icon = option.key),
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: _icon == option.key ? categoryColor(_color) : const Color(0xFFF1F4F8),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            option.value,
                            size: 20,
                            color: _icon == option.key ? Colors.white : AppColors.muted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              PrimaryButton(label: editing ? 'Lưu thay đổi' : 'Thêm danh mục', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
