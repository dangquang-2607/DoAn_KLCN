import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import 'the_qr_nhan.dart';

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
      _ReceiveQrPanel(info: info, isDefault: wallet.isDefault),
    ],
  );
}

class _ReceiveQrPanel extends StatefulWidget {
  const _ReceiveQrPanel({required this.info, required this.isDefault});

  final ReceiveInfo info;
  final bool isDefault;

  @override
  State<_ReceiveQrPanel> createState() => _ReceiveQrPanelState();
}

class _ReceiveQrPanelState extends State<_ReceiveQrPanel> {
  final _cardKey = GlobalKey();
  bool _saving = false;

  Future<void> _saveImage() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      final card = _cardKey.currentContext?.findRenderObject();
      if (card is! RenderRepaintBoundary || card.size.isEmpty) {
        throw StateError('Không tìm thấy ảnh QR.');
      }
      final image = await card.toImage(pixelRatio: 1080 / card.size.width);
      final ByteData? png;
      try {
        png = await image.toByteData(format: ui.ImageByteFormat.png);
      } finally {
        image.dispose();
      }
      if (!mounted) return;
      if (png == null) throw StateError('Không tạo được ảnh QR.');
      await const MethodChannel('capitalflow/files').invokeMethod<void>(
        'saveQrImage',
        {'bytes': png.buffer.asUint8List(png.offsetInBytes, png.lengthInBytes)},
      );
      if (mounted) showSnack('Đã lưu ảnh QR vào bộ sưu tập.');
    } on PlatformException catch (error) {
      if (mounted) {
        showSnack(error.message ?? 'Không lưu được ảnh QR. Vui lòng thử lại.',
            error: true);
      }
    } catch (_) {
      if (mounted) {
        showSnack('Không lưu được ảnh QR. Vui lòng thử lại.', error: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: ReceiveQrCard.width),
              child: RepaintBoundary(
                key: _cardKey,
                child: FittedBox(child: ReceiveQrCard(info: widget.info)),
              ),
            ),
          ),
          const SizedBox(height: Space.sm),
          PrimaryButton(
            label: 'Tải ảnh QR',
            icon: Icons.download_rounded,
            loading: _saving,
            onPressed: _saveImage,
          ),
          const SizedBox(height: Space.sm),
          ReceiveCopyBox(
            label: widget.isDefault
                ? 'Email nhận tiền vào ví mặc định'
                : 'Mã ví để nhận tiền',
            value: widget.info.receiveCode,
          ),
        ],
      ),
    );
  }
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
                Text(label,
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.muted)),
                const SizedBox(height: 2),
                SelectableText(value,
                    style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Sao chép',
            icon:
                const Icon(Icons.copy_rounded, size: 20, color: AppColors.blue),
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
