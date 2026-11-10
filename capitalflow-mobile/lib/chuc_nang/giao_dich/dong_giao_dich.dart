import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';

/// Một dòng trong sổ thu chi: biểu tượng danh mục, diễn giải, nguồn ghi sổ và số tiền.
class TxnTile extends StatelessWidget {
  const TxnTile({
    super.key,
    required this.txn,
    this.category,
    this.wallet,
    this.onTap,
    this.showDate = false,
    this.showSelection = false,
    this.selected,
  });

  final Txn txn;
  final FinanceCategory? category;
  final Wallet? wallet;
  final VoidCallback? onTap;
  final bool showDate;
  final bool showSelection;
  final bool? selected;

  Widget _leading() {
    final size = showSelection ? 36.0 : 44.0;
    if (txn.kind == 'TRANSFER') {
      return IconBadge(
          icon: Icons.swap_horiz_rounded, color: AppColors.blue, size: size);
    }
    if (txn.kind == 'ADJUSTMENT') {
      return IconBadge(
          icon: Icons.tune_rounded, color: AppColors.muted, size: size);
    }
    final current = category;
    if (current != null) {
      return CategoryAvatar(
          icon: current.icon,
          color: current.color,
          name: current.name,
          size: size);
    }
    return IconBadge(
      icon: txn.isIncome ? Icons.south_west_rounded : Icons.north_east_rounded,
      color: txn.isIncome ? AppColors.success : AppColors.danger,
      size: size,
    );
  }

  String _subtitle() {
    final parts = <String>[];
    if (txn.kind == 'TRANSFER') {
      parts.add('Chuyển tiền');
    } else if (txn.kind == 'ADJUSTMENT') {
      parts.add('Điều chỉnh số dư');
    } else {
      parts.add(category?.name ?? 'Chưa phân loại');
    }
    final walletName = wallet?.name;
    if (walletName != null && walletName.isNotEmpty) parts.add(walletName);
    if (txn.fromWalletPayment) parts.add('Thanh toán ví');
    if (!txn.includeInReports) parts.add('Không tính thu chi');
    if (showDate) parts.add(formatDate(txn.date));
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final amountColor = !txn.includeInReports
        ? AppColors.muted
        : txn.isIncome
            ? AppColors.success
            : showSelection
                ? AppColors.danger
                : AppColors.ink;
    final amount = editMoney(txn.raw['amount'] ?? txn.absAmount);
    return Semantics(
      checked: selected,
      enabled: showSelection ? onTap != null : null,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: Space.md, vertical: Space.sm),
          child: Row(
            children: [
              if (showSelection) ...[
                Icon(
                  switch (selected) {
                    true => Icons.check_circle_rounded,
                    false => Icons.radio_button_unchecked_rounded,
                    null => Icons.lock_outline_rounded,
                  },
                  size: 20,
                  color: selected == true ? AppColors.success : AppColors.muted,
                  semanticLabel: selected == null ? 'Không thể xóa' : null,
                ),
                const SizedBox(width: Space.xs),
              ],
              _leading(),
              const SizedBox(width: Space.sm),
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      txn.title,
                      maxLines: showSelection ? 2 : 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.cardTitle,
                    ),
                    const SizedBox(height: Space.xxs),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _subtitle(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.caption,
                          ),
                        ),
                        if (txn.fromWalletPayment) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.account_balance_wallet_outlined,
                              size: 13, color: AppColors.blue),
                        ],
                        if (txn.source == 'OCR') ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.document_scanner_outlined,
                              size: 13, color: AppColors.blue),
                        ],
                        if (txn.categoryWasAuto) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.auto_awesome,
                              size: 13, color: AppColors.amber),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                flex: 2,
                child: Text(
                  '${txn.isIncome ? '+' : '-'}$amount ₫',
                  textAlign: TextAlign.end,
                  style: moneyStyle.copyWith(fontSize: 15, color: amountColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
