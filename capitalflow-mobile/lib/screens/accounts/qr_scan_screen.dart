import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../transactions/transfer_screen.dart';

/// Nội dung QR nhận tiền do CapitalFlow sinh (cùng định dạng với bản web):
/// `capitalflow://transfer?v=1&wallet_id=<uuid>`. Máy chủ kiểm tra đầy đủ khi xác minh người nhận.
bool isCapitalFlowQr(String value) =>
    value.trim().toLowerCase().startsWith('capitalflow://transfer?');

/// Quét mã QR nhận tiền CapitalFlow bằng camera hoặc từ ảnh trong máy.
///
/// Mặc định quét xong mở màn hình Chuyển tiền với người nhận điền sẵn — người dùng vẫn
/// phải kiểm tra tên người nhận và xác nhận số tiền như khi nhập email/mã ví.
/// Với [pickOnly] = true, màn hình chỉ trả nội dung QR về cho màn hình gọi.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key, this.pickOnly = false});

  final bool pickOnly;

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _handled = false;
  String? _message;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        _accept(value.trim());
        return;
      }
    }
  }

  void _accept(String value) {
    if (_handled || !mounted) return;
    if (!isCapitalFlowQr(value)) {
      setState(() => _message = 'Đây không phải mã QR nhận tiền CapitalFlow.');
      return;
    }
    _handled = true;
    _controller.stop();
    final navigator = Navigator.of(context);
    if (widget.pickOnly) {
      navigator.pop(value);
      return;
    }
    navigator.pushReplacement(MaterialPageRoute<bool>(
        builder: (_) => TransferScreen(initialTarget: value)));
  }

  Future<void> _pickImage() async {
    final image = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (image == null || !mounted) return;
    final capture = await _controller.analyzeImage(image.path);
    if (!mounted) return;
    final value = capture?.barcodes
        .map((barcode) => barcode.rawValue)
        .whereType<String>()
        .firstOrNull;
    if (value == null) {
      setState(() => _message = 'Không tìm thấy mã QR trong ảnh đã chọn.');
      return;
    }
    _accept(value);
  }

  @override
  Widget build(BuildContext context) {
    final message = _message;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Quét mã QR'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Bật/tắt đèn',
            onPressed: _controller.toggleTorch,
            icon: const Icon(Icons.flashlight_on_rounded),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  error.errorCode == MobileScannerErrorCode.permissionDenied
                      ? 'Ứng dụng chưa được cấp quyền camera. Hãy bật quyền camera trong Cài đặt, '
                          'hoặc chọn ảnh có mã QR từ thư viện.'
                      : 'Không mở được camera. Bạn có thể chọn ảnh có mã QR từ thư viện.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 14.5),
                ),
              ),
            ),
          ),
          const IgnorePointer(child: _ScanFrame()),
          Positioned(
            left: Space.screen,
            right: Space.screen,
            bottom: 32,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message != null) ...[
                  InfoBanner(message: message, icon: Icons.error_outline, color: AppColors.danger),
                  const SizedBox(height: 12),
                ],
                const Text(
                  'Đưa mã QR nhận tiền CapitalFlow vào khung để quét.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 14),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: _pickImage,
                  icon: const Icon(Icons.photo_library_rounded),
                  label: const Text('Chọn ảnh có mã QR'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white70),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Khung ngắm ở giữa màn hình, phần ngoài khung được làm tối.
class _ScanFrame extends StatelessWidget {
  const _ScanFrame();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final side = constraints.maxWidth * 0.68;
      return Stack(
        children: [
          ColorFiltered(
            colorFilter: ColorFilter.mode(Colors.black.withValues(alpha: 0.55), BlendMode.srcOut),
            child: Stack(
              children: [
                Container(decoration: const BoxDecoration(color: Colors.transparent, backgroundBlendMode: BlendMode.dstOut)),
                Center(
                  child: Container(
                    width: side,
                    height: side,
                    decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
                  ),
                ),
              ],
            ),
          ),
          Center(
            child: Container(
              width: side,
              height: side,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.blue, width: 3),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
        ],
      );
    });
  }
}
