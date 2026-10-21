import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';
import 'common.dart';

/// Một dòng giao dịch trong lịch sử: biểu tượng danh mục, diễn giải, ví và số tiền.
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
      return const IconBadge(icon: Icons.swap_horiz, color: AppColors.blue);
    }
    if (txn.kind == 'ADJUSTMENT') {
      return const IconBadge(icon: Icons.tune, color: AppColors.muted);
    }
    final current = category;
    if (current != null) {
      return CategoryAvatar(icon: current.icon, color: current.color, name: current.name);
    }
    return IconBadge(
      icon: txn.isIncome ? Icons.south_west : Icons.north_east,
      color: txn.isIncome ? AppColors.success : AppColors.danger,
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
    if (showDate) parts.add(formatDate(txn.date));
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final amountColor = txn.isIncome ? AppColors.success : AppColors.ink;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        child: Row(
          children: [
            _leading(),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    txn.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          _subtitle(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                        ),
                      ),
                      if (txn.source == 'OCR') ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.document_scanner_outlined, size: 13, color: AppColors.blue),
                      ],
                      if (txn.categoryWasAuto) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.auto_awesome, size: 13, color: AppColors.amber),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
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
