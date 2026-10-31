import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/app_data.dart';
import '../../widgets/common.dart';

/// Ví nhận tiền mặc định: ví mặc định (nhận qua email), nếu chưa tải được thì ví đầu tiên.
Wallet? receivingWallet(List<Wallet> wallets) {
  for (final wallet in wallets) {
    if (wallet.isDefault && wallet.isActive) return wallet;
  }
  return wallets.isEmpty ? null : wallets.first;
}

/// Bảng "Nhận tiền vào ví": mã QR CapitalFlow, email/mã ví nhận tiền — giống bản web.
/// Người gửi quét QR (hoặc nhập email/mã ví) ở mục Chuyển tiền, kiểm tra tên rồi xác nhận.
Future<void> showReceiveMoney(BuildContext context, Wallet wallet) async {
  final appData = context.read<AppData>();
  ReceiveInfo info;
  try {
    info = await appData.finance.receiveInfo(wallet.id);
  } catch (error) {
    showSnack(errorText(error), error: true);
    return;
  }
  if (!context.mounted) return;
  await showPickerSheet<void>(
    context,
    title: 'Nhận tiền vào ví',
    children: (sheetContext) => [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(info.recipientName,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text(info.walletName,
                style: const TextStyle(fontSize: 13.5, color: AppColors.muted)),
            const SizedBox(height: 14),
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(Radii.md),
                  border: Border.all(color: AppColors.hairline),
                ),
                child: QrImageView(
                  data: info.qrPayload,
                  size: 200,
                  backgroundColor: Colors.white,
                  semanticsLabel: 'Mã QR nhận tiền vào ${info.walletName}',
                ),
              ),
            ),
            const SizedBox(height: 14),
            ReceiveCopyBox(
              label: wallet.isDefault
                  ? 'Email nhận tiền vào ví mặc định'
                  : 'Mã ví để nhận tiền',
              value: info.receiveCode,
            ),
            const SizedBox(height: 10),
            ReceiveCopyBox(label: 'Nội dung QR CapitalFlow', value: info.qrPayload),
            const SizedBox(height: 12),
            const Text(
              'Người gửi quét mã QR này (hoặc nhập email/mã ví) ở mục Chuyển tiền, '
              'kiểm tra tên người nhận rồi xác nhận số tiền.',
              style: TextStyle(fontSize: 12.5, color: AppColors.muted),
            ),
          ],
        ),
      ),
    ],
  );
}

class ReceiveCopyBox extends StatelessWidget {
  const ReceiveCopyBox({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
      decoration: BoxDecoration(
        color: AppColors.soft,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                const SizedBox(height: 2),
                SelectableText(value,
                    style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.ink)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Sao chép',
            icon: const Icon(Icons.copy_rounded, size: 20, color: AppColors.blue),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: value));
              showSnack('Đã sao chép.');
            },
          ),
        ],
      ),
    );
  }
}
