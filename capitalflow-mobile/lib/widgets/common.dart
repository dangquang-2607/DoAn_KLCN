import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/category_style.dart';
import '../core/theme.dart';

/// Các thành phần giao diện dùng chung, theo ngôn ngữ thiết kế của bản web.

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<ScaffoldMessengerState> appMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

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
  return Navigator.of(context)
      .push<T>(MaterialPageRoute<T>(builder: (_) => screen));
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
      title: Text(title),
      content: Text(message),
      actionsPadding:
          const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.md),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child:
              Text(cancelLabel, style: const TextStyle(color: AppColors.muted)),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(
            confirmLabel,
            style: TextStyle(
                color: danger ? AppColors.danger : AppColors.blue,
                fontWeight: FontWeight.w700),
          ),
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
      borderRadius: BorderRadius.circular(Radii.sm),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  return InputDecoration(
    labelText: label,
    hintText: hint,
    helperText: helper,
    helperMaxLines: 2,
    prefixIcon:
        icon == null ? null : Icon(icon, size: 20, color: AppColors.subtle),
    suffixIcon: suffix,
    filled: true,
    fillColor: AppColors.surface,
    isDense: true,
    contentPadding:
        const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.md),
    labelStyle: const TextStyle(color: AppColors.muted, fontSize: 15),
    floatingLabelStyle:
        const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w600),
    hintStyle: const TextStyle(color: AppColors.subtle, fontSize: 15),
    counterText: '',
    border: border(AppColors.line),
    enabledBorder: border(AppColors.line),
    focusedBorder: border(AppColors.blue, 1.6),
    errorBorder: border(AppColors.danger),
    focusedErrorBorder: border(AppColors.danger, 1.6),
  );
}

/// Thanh tiêu đề thống nhất của các màn hình con.
PreferredSizeWidget appBar(String title,
    {List<Widget>? actions, PreferredSizeWidget? bottom}) {
  return AppBar(
    title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
    titleSpacing: Space.screen,
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

/// Thẻ nền trắng bo góc — khối nội dung cơ bản (lớp "30%" của hệ màu).
///
/// Viền mảnh 1px (đen 5%) và bóng khuếch tán nhẹ thay cho elevation mặc định.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(Space.md),
    this.onTap,
    this.color,
    this.radius = Radii.md,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: shape,
        border: Border.all(color: AppColors.hairline),
        boxShadow: AppShadows.soft,
      ),
      child: Material(
        type: MaterialType.transparency,
        borderRadius: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: shape,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Tiêu đề một nhóm nội dung (18sp, w600), có thể kèm nút hành động bên phải.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title,
      {super.key, this.actionLabel, this.onAction, this.accent});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Màu vạch nhấn nhỏ bên trái tiêu đề (để phân biệt các nhóm bằng màu).
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (accent != null) ...[
            Container(
              width: 4,
              height: 18,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color.lerp(accent!, Colors.white, 0.25)!, accent!],
                ),
                borderRadius: BorderRadius.circular(Radii.pill),
              ),
            ),
            const SizedBox(width: Space.xs),
          ],
          Expanded(
            child: Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.section),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: Space.xs),
                minimumSize: const Size(48, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(actionLabel!),
                  const SizedBox(width: 2),
                  const Icon(Icons.chevron_right_rounded, size: 18),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Nút biểu tượng 48×48 trên nền màu nhạt (chuông thông báo, cài đặt...).
class TintedIconButton extends StatelessWidget {
  const TintedIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.badgeCount = 0,
    this.color = AppColors.ink,
    this.background = AppColors.surface,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final int badgeCount;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(Radii.sm + 2);
    final button = DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: radius,
        border: Border.all(color: AppColors.hairline),
        boxShadow: AppShadows.soft,
      ),
      child: Material(
        type: MaterialType.transparency,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: 48,
            height: 48,
            child: Center(
              child: Badge(
                isLabelVisible: badgeCount > 0,
                label: Text(badgeCount > 99 ? '99+' : '$badgeCount'),
                backgroundColor: AppColors.danger,
                child: Icon(icon, size: 22, color: color),
              ),
            ),
          ),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(Space.xxl),
        child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 3)),
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
    return _StateMessage(
      icon: Icons.cloud_off_rounded,
      tint: AppColors.warning,
      title: 'Không tải được dữ liệu',
      message: message,
      action: onRetry == null
          ? null
          : OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 20),
              label: const Text('Thử lại'),
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
    return _StateMessage(
      icon: icon,
      tint: AppColors.blue,
      title: title,
      message: message,
      action: actionLabel != null && onAction != null
          ? FilledButton(onPressed: onAction, child: Text(actionLabel!))
          : null,
    );
  }
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.icon,
    required this.tint,
    required this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final Color tint;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: Space.xxl, vertical: Space.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(Radii.lg),
              ),
              child: Icon(icon, size: 32, color: tint),
            ),
            const SizedBox(height: Space.md),
            Text(title,
                textAlign: TextAlign.center,
                style: AppText.cardTitle.copyWith(fontSize: 16)),
            if (message != null) ...[
              const SizedBox(height: Space.xs),
              Text(message!,
                  textAlign: TextAlign.center,
                  style: AppText.caption.copyWith(fontSize: 14)),
            ],
            if (action != null) ...[
              const SizedBox(height: Space.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Nút chính chiếm toàn bộ chiều ngang (cao 56), có trạng thái đang xử lý.
///
/// Bóng màu khuếch tán nhẹ thay cho elevation mặc định, thu nhỏ 2% khi nhấn để
/// người dùng cảm nhận được phản hồi, và mờ đi khi bị vô hiệu hóa.
class PrimaryButton extends StatefulWidget {
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
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = !widget.loading && widget.onPressed != null;
    final color = widget.danger ? AppColors.danger : AppColors.blue;
    final radius = BorderRadius.circular(16);
    return Listener(
      onPointerDown: enabled ? (_) => _setPressed(true) : null,
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: radius,
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: color.withValues(alpha: _pressed ? 0.18 : 0.28),
                      blurRadius: _pressed ? 10 : 18,
                      offset: Offset(0, _pressed ? 3 : 8),
                    ),
                  ]
                : null,
          ),
          child: FilledButton(
            onPressed: widget.loading ? null : widget.onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: color,
              disabledBackgroundColor:
                  widget.loading ? color : color.withValues(alpha: 0.38),
              shape: RoundedRectangleBorder(borderRadius: radius),
              textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.1),
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: widget.loading
                  ? const SizedBox(
                      key: ValueKey('loading'),
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.6, color: Colors.white),
                    )
                  : Row(
                      key: const ValueKey('label'),
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.icon != null) ...[
                          Icon(widget.icon, size: 20),
                          const SizedBox(width: 8)
                        ],
                        Flexible(
                            child: Text(widget.label,
                                overflow: TextOverflow.ellipsis)),
                      ],
                    ),
            ),
          ),
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
        borderRadius: BorderRadius.circular(Radii.sm),
        side: const BorderSide(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding:
              const EdgeInsets.fromLTRB(Space.md, Space.sm, Space.xs, Space.sm),
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
                    Text(label,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                    const SizedBox(height: 2),
                    Text(
                      hasValue ? value! : placeholder,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight:
                            hasValue ? FontWeight.w600 : FontWeight.w400,
                        color: hasValue ? AppColors.ink : AppColors.subtle,
                      ),
                    ),
                  ],
                ),
              ),
              if (hasValue && onClear != null)
                IconButton(
                  onPressed: onClear,
                  icon:
                      const Icon(Icons.close, size: 18, color: AppColors.muted),
                  tooltip: 'Bỏ chọn',
                )
              else
                const Padding(
                  padding: EdgeInsets.all(12),
                  child:
                      Icon(Icons.expand_more, size: 22, color: AppColors.muted),
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
  const StatusChip(this.label,
      {super.key, required this.color, this.background});

  final String label;
  final Color color;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: Space.xs, vertical: Space.xxs),
      decoration: BoxDecoration(
        color: background ?? color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(Radii.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
            color: color),
      ),
    );
  }
}

/// Thanh tiến độ bo tròn (dùng cho ngân sách).
class ProgressBar extends StatelessWidget {
  const ProgressBar(
      {super.key, required this.value, required this.color, this.height = 8});

  /// Tỷ lệ 0.0 – 1.0 (giá trị ngoài khoảng được kẹp lại).
  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final safe = value.isFinite ? value.clamp(0.0, 1.0).toDouble() : 0.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Radii.pill),
      child: Stack(
        children: [
          Container(height: height, color: AppColors.surfaceMuted),
          TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: safe),
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOutCubic,
            builder: (context, factor, _) => FractionallySizedBox(
              widthFactor: factor,
              child: Container(
                height: height,
                decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(Radii.pill)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Biểu tượng tròn của danh mục (icon chuẩn, emoji hoặc chữ cái đầu).
class CategoryAvatar extends StatelessWidget {
  const CategoryAvatar(
      {super.key, this.icon, this.color, this.name, this.size = 42});

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
              style: TextStyle(
                  fontSize: size * 0.42,
                  fontWeight: FontWeight.w700,
                  color: Colors.white),
            );
    }
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(size >= 40 ? Radii.sm : Radii.chip),
      ),
      child: content,
    );
  }
}

/// Biểu tượng vuông bo góc với màu nền nhạt.
class IconBadge extends StatelessWidget {
  const IconBadge(
      {super.key, required this.icon, required this.color, this.size = 42});

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
        borderRadius: BorderRadius.circular(size >= 40 ? Radii.sm : Radii.chip),
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
    useSafeArea: true,
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
                padding: const EdgeInsets.fromLTRB(
                    Space.screen, 0, Space.screen, Space.sm),
                child: Text(title, style: AppText.section),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.only(bottom: Space.md),
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
      contentPadding: const EdgeInsets.symmetric(
          horizontal: Space.screen, vertical: Space.xxs),
      minTileHeight: 64,
      selected: selected,
      selectedTileColor: AppColors.soft.withValues(alpha: 0.5),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
            fontSize: 15,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: AppColors.ink),
      ),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.caption),
      trailing: trailing ??
          (selected
              ? const Icon(Icons.check_circle_rounded, color: AppColors.blue)
              : null),
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
      decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(Radii.md)),
      child: Row(
        children: [
          for (final option in options)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(option.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  constraints: const BoxConstraints(minHeight: 44),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: option.key == value
                        ? AppColors.surface
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(Radii.sm),
                    boxShadow: option.key == value ? AppShadows.soft : null,
                  ),
                  child: Text(
                    option.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: option.key == value
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: option.key == value
                          ? (colorOf?.call(option.key) ?? AppColors.blue)
                          : AppColors.muted,
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
  const InfoBanner(
      {super.key,
      required this.message,
      this.icon = Icons.info_outline,
      this.color = AppColors.blue});

  final String message;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Space.sm),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(Radii.sm),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: Space.xs),
          Expanded(
            child: Text(message,
                style: TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    fontWeight: FontWeight.w500,
                    color: color)),
          ),
        ],
      ),
    );
  }
}
