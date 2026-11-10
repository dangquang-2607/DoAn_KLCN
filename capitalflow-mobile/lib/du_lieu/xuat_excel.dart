import 'dart:convert';
import 'dart:math' as math;

import 'package:archive/archive.dart';
import 'package:excel/excel.dart';
import 'package:flutter/foundation.dart' show compute;
import 'package:flutter/services.dart';
import 'package:xml/xml.dart';

import 'mo_hinh.dart';

const _headers = [
  'Ngày',
  'Loại',
  'Tài khoản',
  'Danh mục',
  'Số tiền',
  'Tiền tệ',
  'Diễn giải',
  'Ghi chú',
  'Nguồn',
  'Nghiệp vụ',
];
const _widths = [16.0, 16.0, 26.0, 24.0, 26.0, 12.0, 52.0, 40.0, 22.0, 23.0];
final _decimalAmount = RegExp(r'^-?\d+(?:\.\d{1,2})?$');
final _nonDigit = RegExp(r'[^0-9]');

BigInt _cents(Object? value) {
  final text = '$value'.trim();
  if (!_decimalAmount.hasMatch(text)) {
    throw const FormatException('Số tiền xuất không hợp lệ.');
  }
  final parts = text.replaceFirst('-', '').split('.');
  final result = BigInt.parse(parts[0]) * BigInt.from(100) +
      BigInt.parse(parts.length == 1 ? '0' : parts[1].padRight(2, '0'));
  return text.startsWith('-') ? -result : result;
}

String _decimal(BigInt cents) {
  final absolute = cents.abs();
  final fraction = absolute % BigInt.from(100);
  return '${cents.isNegative ? '-' : ''}${absolute ~/ BigInt.from(100)}'
      '${fraction == BigInt.zero ? '' : '.${fraction.toString().padLeft(2, '0')}'}';
}

CellValue _moneyCell(BigInt cents) {
  final text = _decimal(cents);
  return text
              .replaceAll(_nonDigit, '')
              .replaceFirst(RegExp(r'^0+'), '')
              .length <=
          15
      ? DoubleCellValue(double.parse(text))
      : TextCellValue(text);
}

NumFormat _moneyFormat(String currency, BigInt cents) => NumFormat.custom(
    formatCode: currency != 'VND' || cents % BigInt.from(100) != BigInt.zero
        ? '#,##0.00;[Red](#,##0.00);"—"'
        : '#,##0;[Red](#,##0);"—"');
const _typeLabels = {'INCOME': 'Thu nhập', 'EXPENSE': 'Chi tiêu'};
const _sourceLabels = {
  'WALLET': 'Thanh toán ví',
  'MANUAL': 'Nhập thủ công',
  'OCR': 'Hóa đơn AI',
  'XML': 'Hóa đơn điện tử',
  'BANK': 'Ngân hàng',
  'IMPORT': 'Nhập dữ liệu',
  'SYSTEM': 'Hệ thống',
};
const _kindLabels = {
  'NORMAL': 'Thu/chi',
  'TRANSFER': 'Chuyển khoản',
  'ADJUSTMENT': 'Điều chỉnh số dư',
};

Uint8List _exportXlsx(({List<Json> rows, String title, String scope}) report) {
  final book = Excel.createExcel();
  book.rename(book.getDefaultSheet()!, 'CapitalFlow');
  final sheet = book['CapitalFlow'];
  final amounts = report.rows.map((row) => _cents(row['amount'])).toList();
  final currencies = report.rows
      .map((row) => '${row['currency'] ?? 'VND'}')
      .toSet()
      .toList()
    ..sort();
  final headerRow = math.max(9, 7 + currencies.length);
  if (headerRow + report.rows.length > 1048576) {
    throw const FormatException(
        'Dữ liệu vượt giới hạn Excel. Hãy chọn khoảng ngày ngắn hơn.');
  }
  final summaries = <String, List<BigInt>>{};
  final fixed = <String>{};
  for (final currency in currencies) {
    final sums = [BigInt.zero, BigInt.zero];
    for (var i = 0; i < report.rows.length; i++) {
      final row = report.rows[i];
      if ('${row['currency'] ?? 'VND'}' != currency ||
          row['include_in_reports'] == false ||
          (row['kind'] != null && row['kind'] != 'NORMAL')) {
        continue;
      }
      if (row['type'] == 'INCOME') {
        sums[0] += amounts[i];
      } else if (row['type'] == 'EXPENSE') {
        sums[1] -= amounts[i];
      } else {
        continue;
      }
      if (_moneyCell(amounts[i]) is TextCellValue) {
        fixed.add(currency);
      }
    }
    summaries[currency] = [...sums, sums[0] - sums[1]];
    if (summaries[currency]!
        .any((value) => _moneyCell(value) is TextCellValue)) {
      fixed.add(currency);
    }
  }
  final formulaCache = <String, String>{};
  final ink = ExcelColor.fromHexString('FF243047');
  final muted = ExcelColor.fromHexString('FF516078');
  final stripe = ExcelColor.fromHexString('FFF3F5F8');
  final body = CellStyle(
      fontFamily: 'Arial',
      fontSize: 11,
      fontColorHex: ink,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText);

  for (var i = 0; i < _widths.length; i++) {
    sheet.setColumnWidth(i, _widths[i]);
  }
  sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('J2'),
      customValue: TextCellValue(report.title));
  sheet.cell(CellIndex.indexByString('A2')).cellStyle =
      body.copyWith(boldVal: true, fontSizeVal: 17);
  sheet.setRowHeight(1, 32);
  sheet.merge(CellIndex.indexByString('A3'), CellIndex.indexByString('J3'),
      customValue:
          TextCellValue('${report.scope} · ${report.rows.length} giao dịch'));
  sheet.cell(CellIndex.indexByString('A3')).cellStyle =
      body.copyWith(fontColorHexVal: muted);
  sheet.setRowHeight(2, 25);
  final note =
      'Tổng thu/chi theo từng loại tiền, không gồm chuyển khoản, điều chỉnh và các khoản đã tắt tính thu chi.'
      '${fixed.isNotEmpty || amounts.any((v) => _moneyCell(v) is TextCellValue) ? ' Số tiền dài được lưu dạng văn bản để giữ chính xác. Nhóm có số tiền hoặc tổng quá lớn dùng tổng cố định tại thời điểm xuất, không tự tính lại khi sửa dòng.' : ''}';
  sheet.merge(CellIndex.indexByString('A4'), CellIndex.indexByString('J4'),
      customValue: TextCellValue(note));
  sheet.cell(CellIndex.indexByString('A4')).cellStyle =
      body.copyWith(fontColorHexVal: muted);
  sheet.setRowHeight(3, note.length > 180 ? 44 : 28);
  sheet.setRowHeight(headerRow - 1, 28);

  final header = body.copyWith(
      boldVal: true,
      fontColorHexVal: ExcelColor.white,
      backgroundColorHexVal: ink,
      horizontalAlignVal: HorizontalAlign.Center);
  for (final (column, label)
      in ['Tiền tệ', 'Tổng thu', 'Tổng chi', 'Thu trừ chi'].indexed) {
    sheet.cell(CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 4))
      ..value = TextCellValue(label)
      ..cellStyle = header;
  }
  if (currencies.isEmpty) {
    sheet.cell(CellIndex.indexByString('A6')).value =
        TextCellValue('Không có giao dịch trong phạm vi đã chọn.');
  }
  for (final (index, currency) in currencies.indexed) {
    final row = index + 6;
    sheet.cell(CellIndex.indexByString('A$row'))
      ..value = TextCellValue(currency)
      ..cellStyle = body;
    final criteria =
        '\$F\$${headerRow + 1}:\$F\$${headerRow + report.rows.length},A$row,\$J\$${headerRow + 1}:\$J\$${headerRow + report.rows.length},"Thu/chi"';
    final expressions = [
      'ROUND(SUMIFS(\$E\$${headerRow + 1}:\$E\$${headerRow + report.rows.length},\$B\$${headerRow + 1}:\$B\$${headerRow + report.rows.length},"Thu nhập",$criteria),2)',
      '-ROUND(SUMIFS(\$E\$${headerRow + 1}:\$E\$${headerRow + report.rows.length},\$B\$${headerRow + 1}:\$B\$${headerRow + report.rows.length},"Chi tiêu",$criteria),2)',
      'ROUND(B$row-C$row,2)',
    ];
    for (final (i, total) in summaries[currency]!.indexed) {
      final cellIndex =
          CellIndex.indexByColumnRow(columnIndex: i + 1, rowIndex: row - 1);
      final value = _moneyCell(total);
      sheet.cell(cellIndex)
        ..value =
            fixed.contains(currency) ? value : FormulaCellValue(expressions[i])
        ..cellStyle = body.copyWith(
            horizontalAlignVal: HorizontalAlign.Right,
            numberFormat: value is TextCellValue
                ? NumFormat.standard_0
                : _moneyFormat(currency, total));
      if (!fixed.contains(currency)) {
        formulaCache['${String.fromCharCode(66 + i)}$row'] = _decimal(total);
      }
    }
  }
  for (var i = 0; i < _headers.length; i++) {
    sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: i, rowIndex: headerRow - 1))
      ..value = TextCellValue(_headers[i])
      ..cellStyle = header;
  }

  final dateFormat = NumFormat.custom(formatCode: 'dd/mm/yyyy');
  for (final (index, row) in report.rows.indexed) {
    final rowIndex = headerRow + index;
    final style =
        index.isEven ? body.copyWith(backgroundColorHexVal: stripe) : body;
    final dateText = '${row['transaction_date'] ?? row['date'] ?? ''}';
    final date = DateTime.tryParse(dateText);
    final hasDate = date != null && date.year >= 1900;
    final kind = '${row['kind'] ?? 'NORMAL'}';
    final type = '${row['type'] ?? ''}';
    final source = '${row['origin'] ?? row['source'] ?? ''}';
    final values = <CellValue>[
      hasDate ? DateCellValue.fromDateTime(date) : TextCellValue(dateText),
      TextCellValue(_typeLabels[type] ?? type),
      TextCellValue('${row['account_name'] ?? ''}'),
      TextCellValue(
          '${row['category_name'] ?? row['category'] ?? 'Không phân loại'}'),
      _moneyCell(amounts[index]),
      TextCellValue('${row['currency'] ?? 'VND'}'),
      TextCellValue('${row['description'] ?? ''}'),
      TextCellValue('${row['note'] ?? ''}'),
      TextCellValue(_sourceLabels[source] ?? source),
      TextCellValue(row['include_in_reports'] == false
          ? 'Không tính thu chi'
          : _kindLabels[kind] ?? kind),
    ];

    var lines = 1;
    for (final (column, value) in values.indexed) {
      final format = switch (value) {
        DateCellValue() => dateFormat,
        DoubleCellValue() =>
          _moneyFormat('${row['currency'] ?? 'VND'}', amounts[index]),
        _ => NumFormat.standard_0,
      };
      sheet.cell(
          CellIndex.indexByColumnRow(columnIndex: column, rowIndex: rowIndex))
        ..value = value
        ..cellStyle = style.copyWith(
          numberFormat: format,
          horizontalAlignVal:
              column == 4 ? HorizontalAlign.Right : HorizontalAlign.Left,
        );
      if (value is TextCellValue) {
        final wrapped = value.toString().split('\n').fold(
            0,
            (count, line) =>
                count +
                math.max(
                    1, (line.runes.length / (_widths[column] - 2)).ceil()));
        lines = math.max(lines, wrapped);
      }
    }
    sheet.setRowHeight(
        rowIndex, math.min(409, math.max(26, lines * 15 + 8)).toDouble());
  }
  return _addWorksheetView(
      book.encode()!, report.rows.length, headerRow, formulaCache);
}

// The workbook writer does not expose frozen panes or filter ranges.
Uint8List _addWorksheetView(List<int> bytes, int rowCount, int headerRow,
    Map<String, String> formulaCache) {
  final archive = ZipDecoder().decodeBytes(bytes);
  final worksheet = archive.files.singleWhere((file) =>
      file.name.startsWith('xl/worksheets/') && file.name.endsWith('.xml'));
  final document =
      XmlDocument.parse(utf8.decode(worksheet.content as List<int>));
  final root = document.rootElement;
  final view = root.getElement('sheetViews')!.getElement('sheetView')!;
  for (final cell in root.findAllElements('c')) {
    final value = formulaCache[cell.getAttribute('r')];
    if (value != null) cell.getElement('v')!.innerText = value;
  }
  final firstCell = 'A${headerRow + 1}';
  view.setAttribute('showGridLines', '0');
  view.children.insert(
      0,
      XmlElement(XmlName('pane'), [
        XmlAttribute(XmlName('ySplit'), '$headerRow'),
        XmlAttribute(XmlName('topLeftCell'), firstCell),
        XmlAttribute(XmlName('activePane'), 'bottomLeft'),
        XmlAttribute(XmlName('state'), 'frozen'),
      ]));
  view.children.add(XmlElement(XmlName('selection'), [
    XmlAttribute(XmlName('pane'), 'bottomLeft'),
    XmlAttribute(XmlName('activeCell'), firstCell),
    XmlAttribute(XmlName('sqref'), firstCell),
  ]));
  if (rowCount > 0) {
    final afterData = root.children.indexOf(root.getElement('sheetData')!) + 1;
    root.children.insert(
        afterData,
        XmlElement(XmlName('autoFilter'), [
          XmlAttribute(XmlName('ref'), 'A$headerRow:J${headerRow + rowCount}'),
        ]));
  }
  final xml = utf8.encode(document.toXmlString());
  archive.addFile(ArchiveFile(worksheet.name, xml.length, xml));
  final workbook =
      archive.files.singleWhere((file) => file.name == 'xl/workbook.xml');
  final workbookXml =
      XmlDocument.parse(utf8.decode(workbook.content as List<int>));
  final calc = workbookXml.rootElement.getElement('calcPr') ??
      XmlElement(XmlName('calcPr'));
  if (calc.parent == null) {
    workbookXml.rootElement.children.add(calc);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  final metadata = utf8.encode(workbookXml.toXmlString());
  archive.addFile(ArchiveFile(workbook.name, metadata.length, metadata));
  return Uint8List.fromList(ZipEncoder().encode(archive)!);
}

Future<void> shareExcel(
  List<Json> rows, {
  required String name,
  required String title,
  required String scope,
}) async {
  final bytes =
      await compute(_exportXlsx, (rows: rows, title: title, scope: scope));
  await const MethodChannel('capitalflow/files').invokeMethod<void>('share', {
    'name': '$name.xlsx',
    'bytes': bytes,
  });
}
