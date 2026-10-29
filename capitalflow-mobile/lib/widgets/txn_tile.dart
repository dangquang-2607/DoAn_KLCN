import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';
import 'common.dart';

/// Một dòng trong sổ thu chi: biểu tượng danh mục, diễn giải, nguồn ghi sổ và số tiền.
class TxnTile extends StatelessWidget {
  const TxnTile({
    super.key,
    required this.txn,
    this.category,
    this.wallet,
    this.onTap,
    this.showDate = false,
  });

  final Txn txn;
  final FinanceCategory? category;
  final Wallet? wallet;
  final VoidCallback? onTap;
  final bool showDate;

  Widget _leading() {
    if (txn.kind == 'TRANSFER') {
      return const IconBadge(
          icon: Icons.swap_horiz_rounded, color: AppColors.blue, size: 44);
    }
    if (txn.kind == 'ADJUSTMENT') {
      return const IconBadge(
          icon: Icons.tune_rounded, color: AppColors.muted, size: 44);
    }
    final current = category;
    if (current != null) {
      return CategoryAvatar(
          icon: current.icon,
          color: current.color,
          name: current.name,
          size: 44);
    }
    return IconBadge(
      icon: txn.isIncome ? Icons.south_west_rounded : Icons.north_east_rounded,
      color: txn.isIncome ? AppColors.success : AppColors.danger,
      size: 44,
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
        ? AppColors.subtle
        : txn.isIncome
            ? AppColors.success
            : AppColors.ink;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: Space.md, vertical: Space.sm),
        child: Row(
          children: [
            _leading(),
            const SizedBox(width: Space.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    txn.title,
                    maxLines: 1,
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
            Text(
              formatSigned(txn.absAmount, income: txn.isIncome),
              style: moneyStyle.copyWith(fontSize: 15, color: amountColor),
            ),
          ],
        ),
      ),
    );
  }
}
