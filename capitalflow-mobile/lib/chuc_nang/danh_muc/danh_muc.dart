import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/kieu_danh_muc.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../ha_tang/api.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

/// Quản lý danh mục thu – chi. Danh mục hệ thống chỉ xem; danh mục cá nhân được
/// tạo, sửa, ẩn và gắn từ khóa để phục vụ tự động phân loại giao dịch.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  String _type = 'EXPENSE';
  bool _archived = false;
  List<FinanceCategory> _archivedItems = [];
  Json? _quota;
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
      final results = await Future.wait<dynamic>([
        appData.finance.categories(status: 'archived'),
        appData.finance.categoryLimits(),
      ]);
      if (mounted) {
        setState(() {
          _archivedItems = results[0] as List<FinanceCategory>;
          _quota = results[1] as Json;
          _loading = false;
        });
      }
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
    final savedType = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => _CategoryForm(existing: category, initialType: _type),
    );
    if (!mounted) return;
    if (savedType != null) {
      setState(() {
        _type = savedType;
        _archived = false;
      });
    }
    await _refresh();
  }

  Future<void> _delete(FinanceCategory category) async {
    final confirmed = await confirmDialog(
      context,
      title: 'Ẩn danh mục?',
      message:
          'Danh mục "${category.name}" sẽ không còn hiển thị khi tạo giao dịch mới. '
          'Các giao dịch cũ vẫn giữ nguyên phân loại.',
      confirmLabel: 'Ẩn danh mục',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final appData = context.read<AppData>();
    try {
      await appData.finance.deleteCategory(category.id);
      await appData.markChanged();
      await _refresh();
      showSnack('Đã ẩn danh mục "${category.name}".');
    } catch (error) {
      showSnack(errorText(error), error: true);
    }
  }

  Future<void> _restore(FinanceCategory category) async {
    if (!await confirmDialog(context,
        title: 'Khôi phục danh mục?',
        message: 'Dùng lại danh mục "${category.name}" với thông tin đã lưu?',
        confirmLabel: 'Khôi phục')) {
      return;
    }
    if (!mounted) return;
    final data = context.read<AppData>();
    try {
      await data.finance.restoreCategory(category.id);
      await data.markChanged();
      await _refresh();
      showSnack('Đã khôi phục danh mục.');
    } catch (e) {
      showSnack(errorText(e), error: true);
    }
  }

  Future<void> _permanentlyDelete(FinanceCategory category) async {
    if (category.isSystem || !category.canPermanentlyDelete) return;
    if (!await confirmDialog(context,
        title: 'Xóa vĩnh viễn danh mục?',
        message:
            'Xóa vĩnh viễn "${category.name}"? Số danh mục cá nhân sẽ giảm một. Bạn không thể hoàn tác thao tác này.',
        confirmLabel: 'Xóa vĩnh viễn',
        danger: true)) {
      return;
    }
    if (!mounted) return;
    final data = context.read<AppData>();
    try {
      await data.finance.permanentlyDeleteCategory(category.id);
      await data.markChanged();
      await _refresh();
      showSnack('Đã xóa vĩnh viễn danh mục.');
    } catch (error) {
      showSnack(errorText(error), error: true);
      await _refresh();
    }
  }

  void _showActions(FinanceCategory category) {
    showPickerSheet<void>(
      context,
      title: category.name,
      children: (sheetContext) => [
        if (!_archived)
          SheetOption(
            title: 'Chỉnh sửa danh mục',
            leading: const Icon(Icons.edit_outlined, color: AppColors.ink),
            onTap: () {
              Navigator.of(sheetContext).pop();
              _openForm(category);
            },
          ),
        if (_archived)
          SheetOption(
            title: 'Khôi phục danh mục',
            leading: const Icon(Icons.restore, color: AppColors.blue),
            onTap: () {
              Navigator.of(sheetContext).pop();
              _restore(category);
            },
          )
        else
          SheetOption(
            title: 'Ẩn danh mục',
            leading: const Icon(Icons.visibility_off_outlined,
                color: AppColors.danger),
            onTap: () {
              Navigator.of(sheetContext).pop();
              _delete(category);
            },
          ),
        if (category.canPermanentlyDelete && !category.isSystem)
          SheetOption(
            title: 'Xóa vĩnh viễn',
            leading: const Icon(Icons.delete_forever_outlined,
                color: AppColors.danger),
            onTap: () {
              Navigator.of(sheetContext).pop();
              _permanentlyDelete(category);
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
            CategoryAvatar(
                icon: category.icon,
                color: category.color,
                name: category.name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    category.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  if (keywords.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Từ khóa: $keywords',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.muted),
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
    final categories = _archived
        ? _archivedItems.where((c) => c.type == _type).toList()
        : appData.categoriesOf(_type);
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
          padding: const EdgeInsets.fromLTRB(16, 4, 16, Space.xl),
          children: [
            if (mine.isNotEmpty) const SectionHeader('Danh mục của bạn'),
            if (mine.isEmpty && _archived)
              const AppCard(
                child: Text(
                  'Chưa có danh mục đã ẩn.',
                  style: TextStyle(
                      fontSize: 13.5, height: 1.4, color: AppColors.muted),
                ),
              ),
            for (final category in mine) _tile(category),
            if (!_archived) const SectionHeader('Danh mục hệ thống'),
            if (system.isEmpty && !_archived)
              const AppCard(
                child: Text(
                  'Chưa có danh mục hệ thống. Quản trị viên có thể thêm từ cổng quản trị web.',
                  style: TextStyle(
                      fontSize: 13.5, height: 1.4, color: AppColors.muted),
                ),
              ),
            for (final category in system) _tile(category),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: appBar(
        context,
        'Danh mục',
        addAction: PillAddButton(label: 'Thêm danh mục', onPressed: _openForm),
      ),
      body: Column(
        children: [
          if (_quota?['can_create'] == false)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: InfoBanner(
                message:
                    'Đã đạt hạn mức tạo thêm. Bạn vẫn dùng được danh mục cũ. Xóa vĩnh viễn danh mục chưa sử dụng để có thêm chỗ.',
              ),
            ),
          if (_error != null && categories.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: InfoBanner(message: _error!, color: AppColors.danger),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SegmentedChoice<String>(
              options: const [
                MapEntry('EXPENSE', 'Danh mục chi'),
                MapEntry('INCOME', 'Danh mục thu')
              ],
              value: _type,
              onChanged: (value) => setState(() => _type = value),
              colorOf: (value) =>
                  value == 'INCOME' ? AppColors.success : AppColors.danger,
            ),
          ),
          SwitchListTile(
              title: const Text('Danh mục đã ẩn'),
              value: _archived,
              onChanged: (v) => setState(() => _archived = v)),
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
      _icon =
          categoryIconData(existing.icon) == null ? 'package' : existing.icon!;
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
      if (mounted) navigator.pop(_type);
    } catch (error) {
      if (error is ApiException &&
          error.code == 'CATEGORY_ARCHIVED' &&
          mounted) {
        final id = (error.detail['category'] as Map?)?['id']?.toString();
        final restore = await confirmDialog(context,
            title: 'Danh mục đã bị ẩn',
            message:
                'Khôi phục danh mục cùng tên và áp dụng biểu tượng, màu, từ khóa bạn vừa nhập?',
            confirmLabel: 'Khôi phục');
        if (restore && id != null) {
          try {
            await appData.finance.restoreCategory(id, metadata: {
              'icon': _icon,
              'color': _color,
              'keywords': _keywords.text
            });
            await appData.markChanged();
            if (mounted) navigator.pop(_type);
          } catch (e) {
            showSnack(errorText(e), error: true);
          }
        }
      } else {
        showSnack(errorText(error), error: true);
      }
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 0, 20, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  PillBackButton(
                    onPressed:
                        _saving ? null : () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(width: Space.xxs),
                  Expanded(
                    child: Text(
                      editing
                          ? 'Chỉnh sửa danh mục'
                          : 'Thêm danh mục ${_type == 'INCOME' ? 'thu' : 'chi'}',
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: Space.xs),
                  CategoryAvatar(
                      icon: _icon, color: _color, name: _name.text, size: 40),
                ],
              ),
              const SizedBox(height: 14),
              if (!editing) ...[
                SegmentedChoice<String>(
                  options: const [
                    MapEntry('EXPENSE', 'Chi tiêu'),
                    MapEntry('INCOME', 'Thu nhập')
                  ],
                  value: _type,
                  onChanged: (value) => setState(() => _type = value),
                  colorOf: (value) =>
                      value == 'INCOME' ? AppColors.success : AppColors.danger,
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _name,
                maxLength: 100,
                textCapitalization: TextCapitalization.sentences,
                decoration:
                    fieldDecoration('Tên danh mục', icon: Icons.label_outline),
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
                  helper:
                      'Cách nhau bằng dấu phẩy. Giao dịch có diễn giải chứa từ khóa sẽ được gợi ý vào danh mục này.',
                ),
              ),
              const SizedBox(height: 14),
              const Text('Màu sắc',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.muted)),
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
                            color: _color == option.key
                                ? AppColors.ink
                                : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                        child: _color == option.key
                            ? const Icon(Icons.check,
                                size: 16, color: Colors.white)
                            : null,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              const Text('Biểu tượng',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.muted)),
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
                            color: _icon == option.key
                                ? categoryColor(_color)
                                : const Color(0xFFF1F4F8),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            option.value,
                            size: 20,
                            color: _icon == option.key
                                ? Colors.white
                                : AppColors.muted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              PrimaryButton(
                  label: editing ? 'Lưu thay đổi' : 'Thêm danh mục',
                  loading: _saving,
                  onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
