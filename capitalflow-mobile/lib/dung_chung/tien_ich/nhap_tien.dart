import 'package:flutter/services.dart';

/// Exact API decimal strings. Doubles are only used for charts/estimates.
String? moneyInput(String text, {int fractionDigits = 2}) {
  final clean = text.trim();
  if (!RegExp(r'^\d[\d.]*(,\d*)?$').hasMatch(clean)) return null;
  final parts = clean.split(',');
  if (parts[0].contains('.') &&
      !RegExp(r'^\d{1,3}(\.\d{3})+$').hasMatch(parts[0])) {
    return null;
  }
  final integer =
      parts[0].replaceAll('.', '').replaceFirst(RegExp(r'^0+(?=\d)'), '');
  final fraction = parts.length == 2 ? parts[1] : '';
  if (integer.length > 17 || fraction.length > fractionDigits) return null;
  return fraction.isEmpty ? integer : '$integer.$fraction';
}

String editMoney(Object? value) {
  if (value == null) return '';
  final text = value.toString().replaceFirst('-', '');
  final match = RegExp(r'^(\d+)(?:\.(\d+))?$').firstMatch(text);
  if (match == null) return text;
  final integer =
      match[1]!.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  final fraction = (match[2] ?? '').replaceFirst(RegExp(r'0+$'), '');
  return fraction.isEmpty ? integer : '$integer,$fraction';
}

class MoneyInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.isEmpty) return newValue;
    // A keystroke changes the length of an existing thousands group, e.g.
    // 1.000 -> 1.0005. Regroup the digits, but reject ambiguous pasted text.
    final wasGrouped =
        oldValue.text.contains('.') && moneyInput(oldValue.text) != null;
    final oneEdit = (newValue.text.length - oldValue.text.length).abs() == 1;
    final sameSeparators = '.'.allMatches(newValue.text).length <=
        '.'.allMatches(oldValue.text).length;
    // Some Android decimal keyboards send a dot instead of a comma.
    final enteredDecimal = !oldValue.text.contains(',') &&
        oldValue.text.isNotEmpty &&
        newValue.text == '${oldValue.text}.';
    final edited = enteredDecimal ? '${oldValue.text},' : newValue.text;
    final input = wasGrouped && oneEdit && sameSeparators
        ? edited.replaceAll('.', '')
        : edited;
    final canonical = moneyInput(input);
    // Reject invalid/oversized input; never silently truncate or remove decimals.
    if (canonical == null) return oldValue;
    final parts = edited.split(',');
    final integer = editMoney(canonical.split('.').first);
    final formatted = integer + (parts.length == 2 ? ',${parts[1]}' : '');
    return TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length));
  }
}

BigInt moneyCents(String canonical) {
  final parts = canonical.split('.');
  return BigInt.parse(parts[0]) * BigInt.from(100) +
      BigInt.parse((parts.length > 1 ? parts[1] : '').padRight(2, '0'));
}

String centsMoney(BigInt cents) =>
    '${cents ~/ BigInt.from(100)}.${(cents % BigInt.from(100)).toString().padLeft(2, '0')}';
