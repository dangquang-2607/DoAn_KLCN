import 'package:flutter/services.dart';

/// Chuyển giá trị số từ API (Decimal dạng chuỗi, int hoặc double) sang double.
double asDouble(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

int asInt(dynamic value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value.toString()) ?? 0;
}

String? asText(dynamic value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

/// Chèn dấu chấm phân tách hàng nghìn theo cách viết tiếng Việt: 1250000 → 1.250.000.
String groupThousands(String digits) {
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    final remaining = digits.length - i;
    buffer.write(digits[i]);
    if (remaining > 1 && remaining % 3 == 1) buffer.write('.');
  }
  return buffer.toString();
}

/// Định dạng tiền VND; mặc định hiển thị giá trị tuyệt đối kèm ký hiệu ₫.
String formatMoney(num value, {bool symbol = true, bool keepSign = false}) {
  final rounded = value.round();
  final negative = rounded < 0;
  final text = groupThousands(rounded.abs().toString());
  final sign = keepSign && negative ? '-' : '';
  return symbol ? '$sign$text ₫' : '$sign$text';
}

/// Số tiền có dấu theo loại giao dịch: +1.000 ₫ cho thu, -1.000 ₫ cho chi.
String formatSigned(num value, {required bool income}) {
  return '${income ? '+' : '-'}${formatMoney(value.abs())}';
}

/// Dạng rút gọn cho trục biểu đồ: 1,2 tr · 3,5 tỷ · 850 k.
String formatCompact(num value) {
  final v = value.abs().toDouble();
  String trim(double number) {
    final text = number.toStringAsFixed(1);
    return (text.endsWith('.0') ? text.substring(0, text.length - 2) : text).replaceAll('.', ',');
  }

  if (v >= 1000000000) return '${trim(v / 1000000000)} tỷ';
  if (v >= 1000000) return '${trim(v / 1000000)} tr';
  if (v >= 1000) return '${trim(v / 1000)} k';
  return v.round().toString();
}

String _two(int value) => value.toString().padLeft(2, '0');

/// dd/MM/yyyy
String formatDate(DateTime? date) {
  if (date == null) return '—';
  return '${_two(date.day)}/${_two(date.month)}/${date.year}';
}

/// dd/MM/yyyy HH:mm
String formatDateTime(DateTime? date) {
  if (date == null) return '—';
  return '${formatDate(date)} ${_two(date.hour)}:${_two(date.minute)}';
}

/// yyyy-MM-dd theo giờ địa phương — định dạng ngày mà API yêu cầu.
String isoDate(DateTime date) => '${date.year}-${_two(date.month)}-${_two(date.day)}';

/// Đọc ngày dạng `yyyy-MM-dd` thành ngày địa phương (không lệch múi giờ).
DateTime? parseApiDate(dynamic value) {
  if (value == null) return null;
  final text = value.toString();
  if (text.length < 10) return null;
  final year = int.tryParse(text.substring(0, 4));
  final month = int.tryParse(text.substring(5, 7));
  final day = int.tryParse(text.substring(8, 10));
  if (year == null || month == null || day == null) return null;
  return DateTime(year, month, day);
}

/// Đọc mốc thời gian từ API. Backend lưu UTC; chuỗi không kèm múi giờ được hiểu là UTC.
DateTime? parseApiDateTime(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  if (text.isEmpty) return null;
  final hasZone = text.endsWith('Z') || RegExp(r'[+-]\d\d:\d\d$').hasMatch(text);
  final parsed = DateTime.tryParse(hasZone ? text : '${text}Z');
  return parsed?.toLocal();
}

/// "vừa xong", "5 phút trước", "2 giờ trước", "hôm qua" hoặc ngày cụ thể.
String relativeTime(DateTime? time) {
  if (time == null) return '';
  final diff = DateTime.now().difference(time);
  if (diff.inSeconds < 45) return 'vừa xong';
  if (diff.inMinutes < 60) return '${diff.inMinutes < 1 ? 1 : diff.inMinutes} phút trước';
  if (diff.inHours < 24) return '${diff.inHours} giờ trước';
  if (diff.inDays == 1) return 'hôm qua';
  if (diff.inDays < 7) return '${diff.inDays} ngày trước';
  return formatDate(time);
}

const List<String> _weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

/// Nhãn nhóm ngày trong lịch sử giao dịch: "Hôm nay", "Hôm qua" hoặc "Thứ Ba, 06/10/2026".
String dayHeading(DateTime date) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Hôm nay';
  if (diff == 1) return 'Hôm qua';
  return '${_weekdays[date.weekday - 1]}, ${formatDate(date)}';
}

/// Đọc số tiền người dùng nhập (có dấu chấm phân tách) thành số nguyên đồng.
int parseAmountInput(String text) {
  final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return 0;
  return int.tryParse(digits) ?? 0;
}

/// Tự chèn dấu phân tách hàng nghìn khi người dùng gõ số tiền.
class ThousandsInputFormatter extends TextInputFormatter {
  ThousandsInputFormatter({this.maxDigits = 15});

  final int maxDigits;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    digits = digits.replaceFirst(RegExp(r'^0+(?=\d)'), '');
    if (digits.length > maxDigits) digits = digits.substring(0, maxDigits);
    if (digits.isEmpty) return const TextEditingValue(text: '');
    final formatted = groupThousands(digits);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Chỉ cho nhập số thập phân dùng dấu chấm (số lượng mặt hàng trên hóa đơn).
class DecimalInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final text = newValue.text.replaceAll(',', '.');
    if (text.isEmpty || RegExp(r'^\d{0,12}(\.\d{0,4})?$').hasMatch(text)) {
      return newValue.copyWith(text: text);
    }
    return oldValue;
  }
}
