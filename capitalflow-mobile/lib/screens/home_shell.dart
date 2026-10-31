import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';
import '../widgets/common.dart';
import 'accounts/qr_scan_screen.dart';
import 'budgets/budgets_screen.dart';
import 'dashboard_screen.dart';
import 'home_tabs.dart';
import 'invoices/invoices_screen.dart';
import 'more_screen.dart';
import 'transactions/transaction_form_screen.dart';
import 'transactions/transactions_screen.dart';
import 'transactions/transfer_screen.dart';

/// Khung chính sau khi đăng nhập: thanh điều hướng nổi dạng kính mờ với bốn tab và
/// nút "+" thao tác nhanh ở giữa (một nút hành động duy nhất cho toàn bộ ứng dụng).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell>
    with SingleTickerProviderStateMixin {
  final Set<int> _visited = {HomeTabs.dashboard};
  final GlobalKey _stackKey = GlobalKey();
  final GlobalKey _addKey = GlobalKey();
  late final AnimationController _fan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 480),
    reverseDuration: const Duration(milliseconds: 280),
  )..addStatusListener((_) => setState(() {}));

  /// Vị trí nút "+" trong khung, làm tâm cho các cánh quạt xòe ra.
  Rect? _anchor;

  bool get _fanOpen =>
      _fan.status == AnimationStatus.forward ||
      _fan.status == AnimationStatus.completed;

  @override
  void initState() {
    super.initState();
    homeTab.value = HomeTabs.dashboard;
    homeTab.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    homeTab.removeListener(_onTabChanged);
    _fan.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (mounted) setState(() => _visited.add(homeTab.value));
  }

  void _toggleFan() {
    if (_fanOpen) {
      _fan.reverse();
      return;
    }
    final button = _addKey.currentContext?.findRenderObject() as RenderBox?;
    final stack = _stackKey.currentContext?.findRenderObject() as RenderBox?;
    if (button == null || stack == null) return;
    _anchor = button.localToGlobal(Offset.zero, ancestor: stack) & button.size;
    HapticFeedback.lightImpact();
    _fan.forward();
  }

  void _runAction(Widget screen) {
    _fan.reverse();
    pushScreen<bool>(context, screen);
  }

  @override
  Widget build(BuildContext context) {
    final index = homeTab.value;
    return PopScope(
      canPop: !_fanOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _fan.reverse();
      },
      child: Stack(
        key: _stackKey,
        children: [
          Scaffold(
            backgroundColor: AppColors.background,
            body: IndexedStack(
              index: index,
              children: [
                DashboardScreen(
                  onOpenTransactions: () =>
                      homeTab.value = HomeTabs.transactions,
                  onOpenBudgets: () => homeTab.value = HomeTabs.budgets,
                ),
                const TransactionsScreen(),
                const BudgetsScreen(),
                const MoreScreen(),
              ]
                  .asMap()
                  .entries
                  .map((entry) => TickerMode(
                        enabled: entry.key == index,
                        child: _visited.contains(entry.key)
                            ? entry.value
                            : const SizedBox.shrink(),
                      ))
                  .toList(),
            ),
            bottomNavigationBar: _FloatingNavBar(
              selectedIndex: index,
              onSelected: (value) => homeTab.value = value,
              onAdd: _toggleFan,
              addKey: _addKey,
            ),
          ),
          if (!_fan.isDismissed && _anchor != null)
            Positioned.fill(
              child: Material(
                type: MaterialType.transparency,
                child: _FanMenu(
                  animation: _fan,
                  anchor: _anchor!,
                  onClose: _fan.reverse,
                  onSelect: _runAction,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu thao tác nhanh dạng cánh quạt
// ─────────────────────────────────────────────────────────────────────────────

class _FanAction {
  const _FanAction(this.icon, this.label, this.color, this.screen);

  final IconData icon;
  final String label;
  final Color color;
  final Widget screen;
}

// Ghi thu và ghi chi gộp thành một nút (chọn loại thu/chi ngay trong form);
// nút "Quét QR" ở giữa mở máy quét QR CapitalFlow để chuyển tiền.
const List<_FanAction> _fanActions = [
  _FanAction(Icons.edit_note_rounded, 'Ghi thu chi', AppColors.danger,
      TransactionFormScreen()),
  _FanAction(
    Icons.document_scanner_rounded,
    'Chụp hóa đơn',
    AppColors.blue,
    InvoicesScreen(startAction: InvoiceStartAction.camera),
  ),
  _FanAction(Icons.qr_code_scanner_rounded, 'Quét QR', AppColors.success,
      QrScanScreen()),
  _FanAction(
    Icons.photo_library_rounded,
    'Ảnh hóa đơn',
    AppColors.amber,
    InvoicesScreen(startAction: InvoiceStartAction.gallery),
  ),
  _FanAction(Icons.swap_horiz_rounded, 'Chuyển ví', AppPalette.violet,
      TransferScreen()),
];

/// Lớp phủ mờ với các nút thao tác xòe ra theo hình cánh quạt quanh nút "+".
/// Mỗi nút bắt đầu từ tâm nút "+", vừa bay ra theo bán kính vừa quay tới góc của nó,
/// lần lượt nối tiếp nhau để tạo cảm giác cánh quạt đang mở.
class _FanMenu extends StatelessWidget {
  const _FanMenu(
      {required this.animation,
      required this.anchor,
      required this.onClose,
      required this.onSelect});

  final Animation<double> animation;
  final Rect anchor;
  final VoidCallback onClose;
  final ValueChanged<Widget> onSelect;

  static const double _itemSize = 56;
  static const double _labelWidth = 84;

  /// Góc mở của cánh quạt (độ, tính từ trục ngang, ngược chiều kim đồng hồ).
  static const double _startAngle = 165;
  static const double _endAngle = 15;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final radius = math.min(140.0, width / 2 - 40);
    final center = anchor.center;
    final count = _fanActions.length;

    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = animation.value;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onClose,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 6 * t, sigmaY: 6 * t),
                  child: ColoredBox(
                      color: AppColors.ink.withValues(alpha: 0.45 * t)),
                ),
              ),
            ),
            // Nền hình quạt mở dần từ giữa ra hai bên.
            Positioned.fill(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: _FanBackdropPainter(
                    center: center,
                    radius: radius + _itemSize * 0.9,
                    progress: Curves.easeOutCubic.transform(t),
                  ),
                ),
              ),
            ),
            for (var i = 0; i < count; i++)
              _blade(i, count, t, center, radius, width),
            Positioned.fromRect(
              rect: anchor,
              child: _AddButton(onTap: onClose, turns: t),
            ),
          ],
        );
      },
    );
  }

  Widget _blade(int i, int count, double t, Offset center, double radius,
      double screenWidth) {
    // Mỗi cánh xuất hiện trễ hơn cánh trước một chút.
    const stagger = 0.07;
    final begin = i * stagger;
    final span = 1 - stagger * (count - 1);
    final local = ((t - begin) / span).clamp(0.0, 1.0);
    final spread = Curves.easeOutBack.transform(local);
    final fade = Curves.easeOut.transform(local);

    final target = _startAngle - (_startAngle - _endAngle) * i / (count - 1);
    final angle = (90 + (target - 90) * Curves.easeOutCubic.transform(local)) *
        math.pi /
        180;
    final distance = radius * spread;
    final dx = (center.dx + distance * math.cos(angle))
        .clamp(_labelWidth / 2, screenWidth - _labelWidth / 2)
        .toDouble();
    final dy = center.dy - distance * math.sin(angle);
    final action = _fanActions[i];

    return Positioned(
      left: dx - _labelWidth / 2,
      top: dy - _itemSize / 2,
      width: _labelWidth,
      child: IgnorePointer(
        ignoring: t < 0.6,
        child: Opacity(
          opacity: fade,
          child: Transform.scale(
            scale: 0.4 + 0.6 * fade,
            alignment: Alignment.topCenter,
            child: Transform.rotate(
              angle: (1 - fade) * -math.pi / 2,
              child: _FanButton(
                  action: action, onTap: () => onSelect(action.screen)),
            ),
          ),
        ),
      ),
    );
  }
}

class _FanButton extends StatelessWidget {
  const _FanButton({required this.action, required this.onTap});

  final _FanAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            button: true,
            label: action.label,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                boxShadow: AppShadows.accent(action.color),
              ),
              child: Material(
                type: MaterialType.transparency,
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: onTap,
                  child: SizedBox(
                    width: _FanMenu._itemSize,
                    height: _FanMenu._itemSize,
                    child: Center(
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                            color: action.color.withValues(alpha: 0.12),
                            shape: BoxShape.circle),
                        child: Icon(action.icon, size: 22, color: action.color),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            action.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              shadows: [Shadow(color: Color(0x66000000), blurRadius: 6)],
            ),
          ),
        ],
      ),
    );
  }
}

/// Vẽ nửa hình quạt mờ phía sau các nút, quét từ giữa sang hai bên theo tiến độ mở.
class _FanBackdropPainter extends CustomPainter {
  _FanBackdropPainter(
      {required this.center, required this.radius, required this.progress});

  final Offset center;
  final double radius;
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final rect = Rect.fromCircle(
        center: center, radius: radius * (0.6 + 0.4 * progress));
    final sweep = math.pi * progress;
    final start = -math.pi / 2 - sweep / 2;
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.white.withValues(alpha: 0.22 * progress),
          Colors.white.withValues(alpha: 0.04 * progress),
        ],
      ).createShader(rect);
    canvas.drawArc(rect, start, sweep, true, paint);

    // Các đường gân như nan quạt.
    final rib = Paint()
      ..color = Colors.white.withValues(alpha: 0.10 * progress)
      ..strokeWidth = 1;
    const ribs = 6;
    for (var i = 0; i <= ribs; i++) {
      final a = start + sweep * i / ribs;
      canvas.drawLine(center,
          center + Offset(math.cos(a), math.sin(a)) * rect.width / 2, rib);
    }
  }

  @override
  bool shouldRepaint(covariant _FanBackdropPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.center != center ||
      oldDelegate.radius != radius;
}

class _NavItemData {
  const _NavItemData(this.icon, this.selectedIcon, this.label, this.color);

  final IconData icon;
  final IconData selectedIcon;
  final String label;

  /// Màu khi tab được chọn.
  final Color color;
}

const List<_NavItemData> _navItems = [
  _NavItemData(Icons.space_dashboard_outlined, Icons.space_dashboard_rounded,
      'Tổng quan', AppColors.blue),
  _NavItemData(Icons.receipt_long_outlined, Icons.receipt_long_rounded,
      'Giao dịch', AppColors.blue),
  _NavItemData(Icons.donut_large_outlined, Icons.donut_large_rounded,
      'Ngân sách', AppColors.blue),
  _NavItemData(Icons.grid_view_outlined, Icons.grid_view_rounded, 'Thêm',
      AppColors.blue),
];

/// Thanh điều hướng nổi: nền kính mờ (blur 16), bo 24, bóng khuếch tán.
class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({
    required this.selectedIndex,
    required this.onSelected,
    required this.onAdd,
    required this.addKey,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onAdd;

  /// Khóa của nút "+" để đo vị trí làm tâm cho menu cánh quạt.
  final GlobalKey addKey;

  @override
  Widget build(BuildContext context) {
    Widget item(int i) => Expanded(
          child: _NavButton(
            data: _navItems[i],
            selected: selectedIndex == i,
            onTap: () => onSelected(i),
          ),
        );

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: Space.sm),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.md, 0, Space.md, 0),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.xl),
            boxShadow: AppShadows.floating,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Radii.xl),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: Container(
                height: 72,
                padding: const EdgeInsets.symmetric(horizontal: Space.xs),
                decoration: BoxDecoration(
                  color: AppColors.surface.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(Radii.xl),
                  border: Border.all(color: AppColors.hairline),
                ),
                child: Row(
                  children: [
                    item(0),
                    item(1),
                    Padding(
                      padding:
                          const EdgeInsets.symmetric(horizontal: Space.xxs),
                      child: _AddButton(key: addKey, onTap: onAdd),
                    ),
                    item(2),
                    item(3),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton(
      {required this.data, required this.selected, required this.onTap});

  final _NavItemData data;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? data.color : AppColors.subtle;
    return Semantics(
      selected: selected,
      button: true,
      label: data.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: SizedBox(
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                width: selected ? 48 : 32,
                height: 28,
                decoration: BoxDecoration(
                  color: selected
                      ? data.color.withValues(alpha: 0.12)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(Radii.pill),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: Icon(
                    selected ? data.selectedIcon : data.icon,
                    key: ValueKey<bool>(selected),
                    size: 22,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(height: Space.xxs),
              Text(
                data.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? data.color : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nút "+" ở giữa thanh điều hướng — điểm nhấn màu duy nhất của thanh.
class _AddButton extends StatelessWidget {
  const _AddButton({super.key, required this.onTap, this.turns = 0});

  final VoidCallback onTap;

  /// Tiến độ mở menu (0 → 1): dấu "+" xoay thành dấu "×".
  final double turns;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: turns > 0.5 ? 'Đóng' : 'Thao tác nhanh',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.blue,
          borderRadius: BorderRadius.circular(Radii.md + 2),
          boxShadow: AppShadows.accent(AppColors.blue),
        ),
        child: Material(
          type: MaterialType.transparency,
          borderRadius: BorderRadius.circular(Radii.md + 2),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: 56,
              height: 52,
              child: Transform.rotate(
                angle: Curves.easeOutBack.transform(turns) * math.pi * 3 / 4,
                child: const Icon(Icons.add_rounded,
                    size: 28, color: Colors.white),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
