import 'package:flutter/material.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import 'chi_tiet.dart';
import 'bieu_mau.dart';

/// Reuse the ledger flow, including wallet edit restrictions, from reports.
Future<void> openTransaction(BuildContext context, Txn txn) async {
  final edit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => TransactionDetailDialog(txn: txn));
  if (!context.mounted || edit != true) return;
  await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
            insetPadding: const EdgeInsets.symmetric(
                horizontal: Space.sm, vertical: Space.md),
            constraints: const BoxConstraints(maxWidth: 520),
            clipBehavior: Clip.antiAlias,
            child: TransactionFormScreen(existing: txn),
          ));
}
