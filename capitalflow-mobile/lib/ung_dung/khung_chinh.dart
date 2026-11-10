import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../dung_chung/giao_dien/chu_de.dart';
import '../dung_chung/giao_dien/thanh_phan.dart';
import '../chuc_nang/ngan_sach/danh_sach.dart';
import '../chuc_nang/tong_quan/tong_quan.dart';
import 'tab_chinh.dart';
import '../chuc_nang/hoa_don/danh_sach.dart';
import '../chuc_nang/tai_khoan/tai_khoan.dart';
import '../chuc_nang/giao_dich/bieu_mau.dart';
import '../chuc_nang/giao_dich/so_thu_chi.dart';

/// Thanh tab dạng viên bo tròn, nút "+" nổi ở giữa để mở thao tác nhanh.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell>
    with SingleTickerProviderStateMixin {
  final Set<int> _visited = {HomeTabs.dashboard};

  /// Tab vừa rời đi, để nội dung tab mới trượt vào từ đúng phía.
  int _previousTab = HomeTabs.dashboard;
  int _currentTab = HomeTabs.dashboard;
  final GlobalKey _stackKey = GlobalKey();
  final GlobalKey _addKey = GlobalKey();
  late final AnimationController _fan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 480),
    reverseDuration: const Duration(milliseconds: 280),
  )..addStatusListener((_) => setState(() {}));

  /// Vị trí nút "+" trong khung, làm tâm cho các cánh quạt xòe ra.
  Rect? _anchor;
  bool _selectingTransactions = false;

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
    if (!mounted) return;
    setState(() {
      _visited.add(homeTab.value);
      _previousTab = _currentTab;
      _currentTab = homeTab.value;
    });
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
                ),
                TransactionsScreen(
                  onSelectionModeChanged: (selecting) =>
                      setState(() => _selectingTransactions = selecting),
                ),
                const BudgetsScreen(),
                const MoreScreen(),
              ]
                  .asMap()
                  .entries
                  .map((entry) => TickerMode(
                        enabled: entry.key == index,
                        child: _visited.contains(entry.key)
                            ? _TabTransition(
                                active: entry.key == index,
                                fromRight: _previousTab < index,
                                child: entry.value,
                              )
                            : const SizedBox.shrink(),
                      ))
                  .toList(),
            ),
            bottomNavigationBar:
                index == HomeTabs.transactions && _selectingTransactions
                    ? null
                    : _FloatingNavBar(
                        selectedIndex: index,
                        onSelected: (value) {
                          if (value != index) HapticFeedback.selectionClick();
                          homeTab.value = value;
                        },
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

/// Nội dung tab mờ dần vào và trượt nhẹ theo hướng chuyển tab. Không dựng lại [child]
/// nên IndexedStack vẫn giữ nguyên trạng thái (vị trí cuộn, bộ lọc) của từng tab.
class _TabTransition extends StatefulWidget {
  const _TabTransition(
      {required this.active, required this.fromRight, required this.child});

  final bool active;
  final bool fromRight;
  final Widget child;

  @override
  State<_TabTransition> createState() => _TabTransitionState();
}

class _TabTransitionState extends State<_TabTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
    value: 1,
  );
  late final Animation<double> _curve =
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);

  @override
  void initState() {
    super.initState();
    // Tab mở lần đầu cũng chạy hiệu ứng, trừ tab khởi đầu của ứng dụng.
    if (widget.active && homeTab.value != HomeTabs.dashboard) _play();
  }

  @override
  void didUpdateWidget(covariant _TabTransition oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) _play();
  }

  void _play() {
    final features =
        WidgetsBinding.instance.platformDispatcher.accessibilityFeatures;
    if (!features.disableAnimations) _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final begin = Offset(widget.fromRight ? 0.04 : -0.04, 0);
    return FadeTransition(
      opacity: _curve,
      child: SlideTransition(
        position: _curve.drive(Tween<Offset>(begin: begin, end: Offset.zero)),
        child: widget.child,
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

const List<_FanAction> _fanActions = [
  _FanAction(Icons.edit_note_rounded, 'Ghi thu chi', AppColors.danger,
      TransactionFormScreen()),
  _FanAction(
    Icons.document_scanner_rounded,
    'Chụp hóa đơn',
    AppColors.blue,
    InvoicesScreen(startAction: InvoiceStartAction.camera),
  ),
  _FanAction(
    Icons.receipt_long_rounded,
    'Quét hóa đơn OCR',
    AppColors.amber,
    InvoicesScreen(startAction: InvoiceStartAction.chooseSource),
  ),
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
  static const double _startAngle = 150;
  static const double _endAngle = 30;

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
            maxLines: 2,
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
  _NavItemData(
      Icons.home_outlined, Icons.home_rounded, 'Tổng quan', AppColors.blue),
  _NavItemData(Icons.account_balance_wallet_outlined,
      Icons.account_balance_wallet_rounded, 'Giao dịch', AppColors.blue),
  _NavItemData(
      Icons.style_outlined, Icons.style_rounded, 'Ngân sách', AppColors.blue),
  _NavItemData(Icons.person_outline_rounded, Icons.person_rounded, 'Tài khoản',
      AppColors.blue),
];

const double _addGap = Space.xxs;
const double _addWidth = 60;
const double _pillHeight = 28;
const double _navButtonHeight = 68;

/// Khoảng từ đỉnh nút tab tới viên chỉ báo/biểu tượng.
const double _navButtonTop = 6;

/// Viên nền trượt giữa các tab, đi phía sau nút "+".
class _NavIndicator extends StatelessWidget {
  const _NavIndicator({required this.selectedIndex, required this.width});

  final int selectedIndex;
  final double width;

  @override
  Widget build(BuildContext context) {
    final cell = (width - _addWidth - 2 * _addGap) / 4;
    final center = selectedIndex < 2
        ? cell * (selectedIndex + 0.5)
        : width - cell * (3.5 - selectedIndex);
    return LayoutBuilder(
      builder: (context, constraints) => Stack(
        children: [
          AnimatedPositioned(
            duration: Duration(
                milliseconds:
                    MediaQuery.disableAnimationsOf(context) ? 0 : 340),
            curve: Curves.easeOutBack,
            left: center - cell / 2 + Space.xxs,
            top: Space.xxs,
            width: cell - Space.xs,
            height: constraints.maxHeight - Space.xs,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(Radii.pill),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Nền viên bo tròn bao cả nhãn tab, chừa chỗ cho nút tròn nhô lên ở giữa.
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
    final height = _navButtonHeight +
        ((MediaQuery.textScalerOf(context).scale(11.5) - 11.5) * 2)
            .clamp(0.0, 24.0);
    Widget item(int i) => Expanded(
          child: _NavButton(
            data: _navItems[i],
            selected: selectedIndex == i,
            onTap: () => onSelected(i),
            height: height,
          ),
        );

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: Space.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Space.sm),
        child: SizedBox(
          height: height + Space.md,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: height,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(Radii.pill),
                    boxShadow: AppShadows.floating,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(Radii.pill),
                    child: Padding(
                      padding:
                          const EdgeInsets.symmetric(horizontal: Space.xxs),
                      child: LayoutBuilder(
                          builder: (context, constraints) => Stack(
                                fit: StackFit.expand,
                                children: [
                                  _NavIndicator(
                                      selectedIndex: selectedIndex,
                                      width: constraints.maxWidth),
                                  Row(children: [
                                    item(0),
                                    item(1),
                                    const SizedBox(
                                        width: _addWidth + 2 * _addGap),
                                    item(2),
                                    item(3),
                                  ]),
                                ],
                              )),
                    ),
                  ),
                ),
              ),
              Align(
                  alignment: Alignment.topCenter,
                  child: _AddButton(key: addKey, onTap: onAdd)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton(
      {required this.data,
      required this.selected,
      required this.onTap,
      required this.height});

  final _NavItemData data;
  final bool selected;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final color = selected ? data.color : AppColors.ink;
    return Semantics(
      selected: selected,
      button: true,
      label: data.label,
      child: PressScale(
        scale: 0.92,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.pill),
          child: SizedBox(
            height: height,
            child: Column(
              children: [
                const SizedBox(height: _navButtonTop),
                SizedBox(
                  height: _pillHeight,
                  child: AnimatedScale(
                    scale: selected ? 1.12 : 1,
                    duration: const Duration(milliseconds: 320),
                    curve: Curves.easeOutBack,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        selected ? data.selectedIcon : data.icon,
                        key: ValueKey<bool>(selected),
                        size: 22,
                        color: color,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: Space.xxs),
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: color,
                    height: 1.1,
                  ),
                  child: Text(
                    data.label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
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
      child: PressScale(
        scale: 0.9,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.blue,
            shape: BoxShape.circle,
            boxShadow: AppShadows.soft,
          ),
          child: Material(
            type: MaterialType.transparency,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox(
                width: _addWidth,
                height: _addWidth,
                child: Transform.rotate(
                  angle: Curves.easeOutBack.transform(turns) * math.pi * 3 / 4,
                  child: const Icon(Icons.add_rounded,
                      size: 34, color: Colors.white),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
