import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../widgets/common.dart';
import 'budgets/budgets_screen.dart';
import 'dashboard_screen.dart';
import 'home_tabs.dart';
import 'invoices/invoices_screen.dart';
import 'more_screen.dart';
import 'transactions/transaction_form_screen.dart';
import 'transactions/transactions_screen.dart';
import 'transactions/transfer_screen.dart';

/// Khung chính sau khi đăng nhập: bốn tab ở thanh điều hướng dưới và nút "+" thao tác nhanh.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final Set<int> _visited = {HomeTabs.dashboard};
  @override
  void initState() {
    super.initState();
    homeTab.value = HomeTabs.dashboard;
    homeTab.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    homeTab.removeListener(_onTabChanged);
    super.dispose();
  }

  void _onTabChanged() {
    if (mounted) setState(() => _visited.add(homeTab.value));
  }

  void _openQuickActions() {
    showPickerSheet<void>(
      context,
      title: 'Thao tác nhanh',
      children: (sheetContext) {
        void run(Widget screen) {
          Navigator.of(sheetContext).pop();
          pushScreen<bool>(context, screen);
        }

        return [
          SheetOption(
            title: 'Ghi khoản chi',
            subtitle: 'Nhập thủ công một khoản chi tiêu',
            leading: const IconBadge(
                icon: Icons.north_east, color: AppColors.danger, size: 40),
            onTap: () =>
                run(const TransactionFormScreen(initialType: 'EXPENSE')),
          ),
          SheetOption(
            title: 'Ghi khoản thu',
            subtitle: 'Lương, thưởng, hoàn tiền...',
            leading: const IconBadge(
                icon: Icons.south_west, color: AppColors.success, size: 40),
            onTap: () =>
                run(const TransactionFormScreen(initialType: 'INCOME')),
          ),
          SheetOption(
            title: 'Chụp hóa đơn',
            subtitle: 'AI nhận dạng cửa hàng, sản phẩm, tổng tiền, VAT',
            leading: const IconBadge(
                icon: Icons.photo_camera_outlined,
                color: AppColors.blue,
                size: 40),
            onTap: () => run(
                const InvoicesScreen(startAction: InvoiceStartAction.camera)),
          ),
          SheetOption(
            title: 'Tải hóa đơn từ thư viện',
            subtitle: 'Chọn ảnh hóa đơn có sẵn trong máy',
            leading: const IconBadge(
                icon: Icons.photo_library_outlined,
                color: AppColors.amber,
                size: 40),
            onTap: () => run(
                const InvoicesScreen(startAction: InvoiceStartAction.gallery)),
          ),
          SheetOption(
            title: 'Chuyển tiền giữa ví',
            subtitle: 'Không tính vào thu/chi',
            leading: const IconBadge(
                icon: Icons.swap_horiz, color: AppColors.muted, size: 40),
            onTap: () => run(const TransferScreen()),
          ),
        ];
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final index = homeTab.value;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: index,
        children: <Widget>[
          DashboardScreen(
            onOpenTransactions: () => homeTab.value = HomeTabs.transactions,
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
      floatingActionButton:
          index == HomeTabs.dashboard || index == HomeTabs.transactions
              ? FloatingActionButton(
                  onPressed: _openQuickActions,
                  tooltip: 'Thao tác nhanh',
                  child: const Icon(Icons.add, size: 28),
                )
              : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => homeTab.value = value,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Tổng quan',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Giao dịch',
          ),
          NavigationDestination(
            icon: Icon(Icons.pie_chart_outline),
            selectedIcon: Icon(Icons.pie_chart),
            label: 'Ngân sách',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'Thêm',
          ),
        ],
      ),
    );
  }
}
