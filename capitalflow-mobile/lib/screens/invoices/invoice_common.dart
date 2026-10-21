import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Nhãn và màu của từng trạng thái xử lý hóa đơn — khớp với bản web.
class InvoiceStatusStyle {
  const InvoiceStatusStyle(this.label, this.color, this.icon);

  final String label;
  final Color color;
  final IconData icon;
}

InvoiceStatusStyle invoiceStatusStyle(String status) {
  switch (status) {
    case 'UPLOADED':
      return const InvoiceStatusStyle(
          'Chờ quét', AppColors.muted, Icons.hourglass_empty);
    case 'PROCESSING':
      return const InvoiceStatusStyle(
          'Đang quét AI', AppColors.blue, Icons.autorenew);
    case 'REVIEW_REQUIRED':
      return const InvoiceStatusStyle(
          'Cần kiểm tra', AppColors.warning, Icons.fact_check_outlined);
    case 'CONFIRMED':
      return const InvoiceStatusStyle(
          'Đã ghi sổ', AppColors.success, Icons.check_circle_outline);
    case 'FAILED':
      return const InvoiceStatusStyle(
          'Quét lỗi', AppColors.danger, Icons.error_outline);
    default:
      return InvoiceStatusStyle(status, AppColors.muted, Icons.help_outline);
  }
}

class InvoiceStatusChip extends StatelessWidget {
  const InvoiceStatusChip(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final style = invoiceStatusStyle(status);
    return StatusChip(style.label, color: style.color);
  }
}

/// Giới hạn kích thước tệp hóa đơn của backend.
const int maxInvoiceBytes = 10 * 1024 * 1024;

/// Nhận diện định dạng thật của tệp bằng chữ ký đầu tệp, giống cách backend kiểm tra,
/// để đặt đúng phần mở rộng khi tải lên. Trả `null` nếu định dạng không được hỗ trợ.
String? detectInvoiceExtension(List<int> bytes, String originalName) {
  bool startsWith(List<int> signature, [int offset = 0]) {
    if (bytes.length < offset + signature.length) return false;
    for (var i = 0; i < signature.length; i++) {
      if (bytes[offset + i] != signature[i]) return false;
    }
    return true;
  }

  if (startsWith(const [0xFF, 0xD8, 0xFF])) return 'jpg';
  if (startsWith(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
    return 'png';
  }
  if (startsWith(const [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(const [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  if (startsWith(const [0x25, 0x50, 0x44, 0x46, 0x2D])) return 'pdf';
  if (originalName.toLowerCase().endsWith('.xml')) {
    // Bỏ qua BOM UTF-8 và khoảng trắng đầu tệp rồi kiểm tra ký tự mở thẻ XML.
    var index = 0;
    if (startsWith(const [0xEF, 0xBB, 0xBF])) index = 3;
    while (index < bytes.length &&
        (bytes[index] == 0x20 ||
            bytes[index] == 0x09 ||
            bytes[index] == 0x0D ||
            bytes[index] == 0x0A)) {
      index++;
    }
    if (index < bytes.length && bytes[index] == 0x3C) return 'xml';
  }
  return null;
}

/// Tạo tên tệp an toàn khi tải lên: giữ tên gốc (đã lược ký tự lạ) và gắn đúng phần mở rộng.
String invoiceUploadName(String originalName, String extension) {
  var base = originalName.trim();
  final slash = base.lastIndexOf(RegExp(r'[\\/]'));
  if (slash >= 0) base = base.substring(slash + 1);
  final dot = base.lastIndexOf('.');
  if (dot > 0) base = base.substring(0, dot);
  base = base.replaceAll(RegExp(r'[^A-Za-z0-9._\- ]'), '_').trim();
  if (base.isEmpty) base = 'hoa-don';
  if (base.length > 80) base = base.substring(0, 80);
  return '$base.$extension';
}
