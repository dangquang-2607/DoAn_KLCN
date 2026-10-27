// Kiểm thử đơn vị cho các tiện ích định dạng và việc đọc dữ liệu từ API.
// Chạy bằng lệnh:  flutter test

import 'package:capitalflow_mobile/core/app_config.dart';
import 'package:capitalflow_mobile/core/formatters.dart';
import 'package:capitalflow_mobile/models/models.dart';
import 'package:capitalflow_mobile/screens/invoices/invoice_common.dart';
import 'package:capitalflow_mobile/widgets/charts.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Định dạng tiền và ngày', () {
    test('tiền VND dùng dấu chấm phân tách hàng nghìn', () {
      expect(formatMoney(0), '0 ₫');
      expect(formatMoney(999), '999 ₫');
      expect(formatMoney(1250000), '1.250.000 ₫');
      expect(formatMoney(-45000), '45.000 ₫');
      expect(formatMoney(-45000, keepSign: true), '-45.000 ₫');
      expect(formatSigned(45000, income: false), '-45.000 ₫');
      expect(formatSigned(500000, income: true), '+500.000 ₫');
    });

    test('rút gọn số cho trục biểu đồ', () {
      expect(formatCompact(850), '850');
      expect(formatCompact(1200), '1,2 k');
      expect(formatCompact(1500000), '1,5 tr');
      expect(formatCompact(2000000000), '2 tỷ');
    });

    test('đọc số tiền người dùng nhập', () {
      expect(parseAmountInput('1.250.000'), 1250000);
      expect(parseAmountInput(''), 0);
      expect(parseAmountInput('12abc3'), 123);
    });

    test('tự chèn dấu phân tách khi gõ số tiền', () {
      final formatter = ThousandsInputFormatter();
      final result = formatter.formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(text: '0012500'),
      );
      expect(result.text, '12.500');
    });

    test('ngày API không bị lệch múi giờ', () {
      final date = parseApiDate('2026-10-06');
      expect(date, DateTime(2026, 10, 6));
      expect(isoDate(DateTime(2026, 1, 5)), '2026-01-05');
      expect(formatDate(DateTime(2026, 10, 6)), '06/10/2026');
    });

    test('mốc thời gian không kèm múi giờ được hiểu là UTC', () {
      final naive = parseApiDateTime('2026-10-06T11:00:00');
      final zoned = parseApiDateTime('2026-10-06T11:00:00Z');
      expect(naive, isNotNull);
      expect(naive!.toUtc(), DateTime.utc(2026, 10, 6, 11));
      expect(zoned!.toUtc(), DateTime.utc(2026, 10, 6, 11));
    });
  });

  group('Cấu hình máy chủ', () {
    test('chuẩn hóa địa chỉ người dùng nhập', () {
      expect(AppConfig.normalizeBaseUrl('192.168.1.10:8000'),
          'http://192.168.1.10:8000');
      expect(AppConfig.normalizeBaseUrl('http://10.0.2.2:8000/'),
          'http://10.0.2.2:8000');
      expect(AppConfig.normalizeBaseUrl('http://10.0.2.2:8000/api/v1/'),
          'http://10.0.2.2:8000');
      expect(AppConfig.normalizeBaseUrl('  '), AppConfig.defaultBaseUrl);
    });
  });

  group('Đọc dữ liệu API', () {
    test('giao dịch chi có số tiền âm và sửa được', () {
      final txn = Txn.fromJson(<String, dynamic>{
        'id': 't1',
        'account_id': 'a1',
        'category_id': null,
        'amount': '-45000.00',
        'type': 'EXPENSE',
        'source': 'MANUAL',
        'kind': 'NORMAL',
        'transaction_date': '2026-10-06',
        'description': 'Ăn trưa',
        'category_was_auto': false,
      });
      expect(txn.isIncome, isFalse);
      expect(txn.absAmount, 45000);
      expect(txn.editable, isTrue);
      expect(txn.date, DateTime(2026, 10, 6));
    });

    test('giao dịch chuyển tiền không sửa xóa riêng được', () {
      final txn = Txn.fromJson(<String, dynamic>{
        'id': 't2',
        'account_id': 'a1',
        'amount': 100000,
        'type': 'INCOME',
        'source': 'SYSTEM',
        'kind': 'TRANSFER',
        'transaction_date': '2026-10-06',
        'description': '',
      });
      expect(txn.editable, isFalse);
      expect(txn.title, 'Nhận chuyển tiền');
    });

    test('tiến độ ngân sách', () {
      final budget = BudgetProgress.fromJson(<String, dynamic>{
        'budget_id': 'b1',
        'budget_name': 'Ăn uống tháng 10',
        'category_id': 'c1',
        'amount_limit': '1000000.00',
        'period_type': 'MONTHLY',
        'start_date': '2026-10-01',
        'end_date': '2026-10-31',
        'warning_percent': '80.00',
        'is_active': true,
        'spent_amount': '850000.00',
        'remaining_amount': '150000.00',
        'usage_percent': '85.0',
        'progress_status': 'WARNING',
      });
      expect(budget.isWarning, isTrue);
      expect(budget.spent, 850000);
      expect(budget.usagePercent, 85);
    });

    test('báo cáo: sắp xếp danh mục giảm dần và rút gọn nhãn tháng', () {
      final data = AnalyticsData.fromJson(<String, dynamic>{
        'period': {'start_date': '2026-10-01', 'end_date': '2026-10-31'},
        'summary': {
          'income': 5000000.0,
          'expense': 1500000.0,
          'net': 3500000.0
        },
        'previous_summary': {
          'income': 4000000.0,
          'expense': 2000000.0,
          'net': 2000000.0
        },
        'expense_by_category': {'Di chuyển': 500000.0, 'Ăn uống': 1000000.0},
        'trend': [
          {'month': 'Tháng 9/2026', 'income': 4000000.0, 'expense': 2000000.0},
          {'month': 'Tháng 10/2026', 'income': 5000000.0, 'expense': 1500000.0},
        ],
      });
      expect(data.byCategory.first.name, 'Ăn uống');
      expect(data.trend.map((point) => point.label).toList(),
          <String>['T9', 'T10']);
      expect(buildSlices(data.byCategory).length, 2);
    });

    test('thông báo từ web không bị coi là thao tác của máy này', () {
      final notification = AppNotification.fromJson(<String, dynamic>{
        'id': 'n1',
        'type': 'BUDGET_WARNING',
        'severity': 'WARNING',
        'title': 'Sắp chạm hạn mức',
        'body': 'Bạn đã dùng 85% ngân sách',
        'origin': 'SYSTEM',
        'is_read': false,
        'entity_type': 'budget',
        'entity_id': 'b1',
        'created_at': '2026-10-06T11:00:00Z',
      });
      expect(notification.fromThisApp, isFalse);
      expect(notification.isAlert, isTrue);
    });
  });

  group('Tệp hóa đơn', () {
    test('nhận diện định dạng bằng chữ ký đầu tệp', () {
      expect(detectInvoiceExtension(<int>[0xFF, 0xD8, 0xFF, 0xE0], 'anh.heic'),
          'jpg');
      expect(
          detectInvoiceExtension(
              <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'a.bin'),
          'png');
      expect(
          detectInvoiceExtension('%PDF-1.7'.codeUnits, 'hoa-don.pdf'), 'pdf');
      expect(detectInvoiceExtension('  <HDon></HDon>'.codeUnits, 'hoa-don.xml'),
          'xml');
      expect(
          detectInvoiceExtension('xin chao'.codeUnits, 'ghi-chu.txt'), isNull);
    });

    test('tên tệp tải lên an toàn và đúng phần mở rộng', () {
      expect(invoiceUploadName('IMG_0012.HEIC', 'jpg'), 'IMG_0012.jpg');
      expect(invoiceUploadName('/data/cache/hoa don #1.png', 'png'),
          'hoa don _1.png');
      expect(invoiceUploadName('', 'pdf'), 'hoa-don.pdf');
    });
  });
}
