import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/category_style.dart';
import '../core/theme.dart';

/// Các thành phần giao diện dùng chung, theo ngôn ngữ thiết kế của bản web.

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> appMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Hiện thông báo ngắn ở cuối màn hình.
void showSnack(String message, {bool error = false}) {
  final messenger = appMessengerKey.currentState;
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.danger : AppColors.ink,
        duration: Duration(seconds: error ? 5 : 3),
      ),
    );
}

/// Chuyển mọi lỗi thành câu thông báo tiếng Việt an toàn để hiển thị.
String errorText(Object error) {
  if (error is ApiException) return error.message;
  return 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.';
}

/// Mở một màn hình mới và chờ kết quả trả về (nếu có).
Future<T?> pushScreen<T>(BuildContext context, Widget screen) {
  return Navigator.of(context).push<T>(MaterialPageRoute<T>(builder: (_) => screen));
}

/// Hộp thoại xác nhận; trả `true` khi người dùng đồng ý.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Đồng ý',
  String cancelLabel = 'Hủy',
  bool danger = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
      content: Text(message, style: const TextStyle(fontSize: 14.5, height: 1.45, color: AppColors.muted)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(cancelLabel, style: const TextStyle(color: AppColors.muted)),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(confirmLabel, style: TextStyle(color: danger ? AppColors.danger : AppColors.blue)),
        ),
      ],
    ),
  );
  return result == true;
}

/// Kiểu ô nhập liệu thống nhất cho mọi biểu mẫu.
InputDecoration fieldDecoration(
  String label, {
  String? hint,
  IconData? icon,
  Widget? suffix,
  String? helper,
}) {
  OutlineInputBorder border(Color color, [double width = 1]) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  return InputDecoration(
    labelText: label,
    hintText: hint,
    helperText: helper,
    helperMaxLines: 2,
    prefixIcon: icon == null ? null : Icon(icon, size: 20, color: AppColors.muted),
    suffixIcon: suffix,
    filled: true,
    fillColor: AppColors.surface,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    labelStyle: const TextStyle(color: AppColors.muted, fontSize: 14.5),
    floatingLabelStyle: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w600),
    hintStyle: const TextStyle(color: Color(0xFF9AA5B8), fontSize: 14.5),
    counterText: '',
    border: border(AppColors.line),
    enabledBorder: border(AppColors.line),
    focusedBorder: border(AppColors.blue, 1.6),
    errorBorder: border(AppColors.danger),
    focusedErrorBorder: border(AppColors.danger, 1.6),
  );
}

/// Thanh tiêu đề thống nhất của các màn hình con.
PreferredSizeWidget appBar(String title, {List<Widget>? actions, PreferredSizeWidget? bottom}) {
  return AppBar(
    title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink)),
    backgroundColor: AppColors.background,
    foregroundColor: AppColors.ink,
    surfaceTintColor: Colors.transparent,
    scrolledUnderElevation: 0,
    elevation: 0,
    centerTitle: false,
    actions: actions,
    bottom: bottom,
  );
}

/// Thẻ nền trắng bo góc — khối nội dung cơ bản.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(16);
    return Material(
      color: color ?? AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: radius, side: const BorderSide(color: AppColors.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Tiêu đề một nhóm nội dung, có thể kèm nút hành động bên phải.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink)),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(actionLabel!),
            ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
      ),
    );
  }
}

/// Trạng thái lỗi kèm nút thử lại.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 44, color: AppColors.muted),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14.5, height: 1.45, color: AppColors.muted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Thử lại'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Trạng thái chưa có dữ liệu, gợi ý hành động tiếp theo.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: const BoxDecoration(color: AppColors.soft, shape: BoxShape.circle),
              child: Icon(icon, size: 30, color: AppColors.blue),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.ink),
            ),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, height: 1.45, color: AppColors.muted),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 18),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Nút chính chiếm toàn bộ chiều ngang, có trạng thái đang xử lý.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
    this.danger = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: danger ? FilledButton.styleFrom(backgroundColor: AppColors.danger) : null,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.6, color: Colors.white),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
                ],
              ),
      ),
    );
  }
}

/// Ô chọn giá trị (ví, danh mục, ngày...) trông như ô nhập liệu; chạm để mở bộ chọn.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.onTap,
    this.value,
    this.placeholder = 'Chạm để chọn',
    this.icon,
    this.leading,
    this.onClear,
  });

  final String label;
  final String? value;
  final String placeholder;
  final IconData? icon;
  final Widget? leading;
  final VoidCallback? onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null && value!.isNotEmpty;
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
          child: Row(
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 12)],
              if (leading == null && icon != null) ...[
                Icon(icon, size: 20, color: AppColors.muted),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                    const SizedBox(height: 2),
                    Text(
                      hasValue ? value! : placeholder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: hasValue ? FontWeight.w600 : FontWeight.w400,
                        color: hasValue ? AppColors.ink : const Color(0xFF9AA5B8),
                      ),
                    ),
                  ],
                ),
              ),
              if (hasValue && onClear != null)
                IconButton(
                  onPressed: onClear,
                  icon: const Icon(Icons.close, size: 18, color: AppColors.muted),
                  tooltip: 'Bỏ chọn',
                )
              else
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.expand_more, size: 22, color: AppColors.muted),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nhãn trạng thái nhỏ có màu.
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, required this.color, this.background});

  final String label;
  final Color color;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

/// Thanh tiến độ bo tròn (dùng cho ngân sách).
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.value, required this.color, this.height = 8});

  /// Tỷ lệ 0.0 – 1.0 (giá trị ngoài khoảng được kẹp lại).
  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final safe = value.isFinite ? value.clamp(0.0, 1.0).toDouble() : 0.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Stack(
        children: [
          Container(height: height, color: const Color(0xFFE9EDF3)),
          FractionallySizedBox(
            widthFactor: safe,
            child: Container(height: height, color: color),
          ),
        ],
      ),
    );
  }
}

/// Biểu tượng tròn của danh mục (icon chuẩn, emoji hoặc chữ cái đầu).
class CategoryAvatar extends StatelessWidget {
  const CategoryAvatar({super.key, this.icon, this.color, this.name, this.size = 42});

  final String? icon;
  final String? color;
  final String? name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final background = categoryColor(color);
    final iconData = categoryIconData(icon);
    Widget content;
    if (iconData != null) {
      content = Icon(iconData, size: size * 0.5, color: Colors.white);
    } else if (icon != null && icon!.isNotEmpty && icon!.runes.first > 255) {
      // Danh mục do quản trị viên đặt biểu tượng bằng emoji.
      content = Text(icon!, style: TextStyle(fontSize: size * 0.46));
    } else {
      final label = (name ?? '').trim();
      content = label.isEmpty
          ? Icon(Icons.inventory_2, size: size * 0.5, color: Colors.white)
          : Text(
              label.substring(0, 1).toUpperCase(),
              style: TextStyle(fontSize: size * 0.42, fontWeight: FontWeight.w700, color: Colors.white),
            );
    }
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(size * 0.3)),
      child: content,
    );
  }
}

/// Biểu tượng vuông bo góc với màu nền nhạt.
class IconBadge extends StatelessWidget {
  const IconBadge({super.key, required this.icon, required this.color, this.size = 42});

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Icon(icon, size: size * 0.5, color: color),
    );
  }
}

/// Khung bảng chọn trượt từ dưới lên, có tiêu đề và nội dung cuộn được.
Future<T?> showPickerSheet<T>(
  BuildContext context, {
  required String title,
  required List<Widget> Function(BuildContext sheetContext) children,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    builder: (sheetContext) {
      final maxHeight = MediaQuery.of(sheetContext).size.height * 0.72;
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: 12),
                  children: children(sheetContext),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// Một dòng lựa chọn trong bảng chọn.
class SheetOption extends StatelessWidget {
  const SheetOption({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.leading,
    this.selected = false,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: leading,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontSize: 15, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: AppColors.ink),
      ),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
      trailing: trailing ?? (selected ? const Icon(Icons.check_circle, color: AppColors.blue) : null),
    );
  }
}

/// Bộ chọn hai lựa chọn Thu/Chi dạng thanh trượt.
class SegmentedChoice<T> extends StatelessWidget {
  const SegmentedChoice({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.colorOf,
  });

  /// Cặp (giá trị, nhãn hiển thị).
  final List<MapEntry<T, String>> options;
  final T value;
  final ValueChanged<T> onChanged;
  final Color Function(T value)? colorOf;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: const Color(0xFFE9EDF3), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          for (final option in options)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(option.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: option.key == value ? AppColors.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(
                    option.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: option.key == value ? FontWeight.w700 : FontWeight.w500,
                      color: option.key == value ? (colorOf?.call(option.key) ?? AppColors.blue) : AppColors.muted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Dải thông báo trong trang (cảnh báo, gợi ý, lỗi nhẹ).
class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.message, this.icon = Icons.info_outline, this.color = AppColors.blue});

  final String message;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: TextStyle(fontSize: 13.5, height: 1.4, color: color)),
          ),
        ],
      ),
    );
  }
}
