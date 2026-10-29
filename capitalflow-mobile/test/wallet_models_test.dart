// Kiểm thử đọc dữ liệu của luồng ví độc lập và sổ thu chi (đồng bộ với bản web).
// Dữ liệu mẫu theo đúng định dạng backend trả về ở /wallets và /bookkeeping.
import 'package:capitalflow_mobile/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ví độc lập: số dư dạng chuỗi, ví mặc định và mã nhận tiền', () {
    final wallet = Wallet.fromJson({
      'id': 'w1',
      'name': 'Ví mặc định',
      'balance': '1250000.00',
      'currency': 'VND',
      'is_active': true,
      'is_default': true,
      'receive_code': 'demo@example.com',
      'demo': true,
    });
    expect(wallet.balance, 1250000);
    expect(wallet.isDefault, isTrue);
    expect(wallet.accountType, 'WALLET');
    expect(wallet.receiveCode, 'demo@example.com');
  });

  test('lịch sử ví: thanh toán gắn khoản ghi sổ và cờ tính vào chi tiêu', () {
    final page = WalletHistoryPage.fromJson({
      'total': 2,
      'page': 1,
      'page_size': 20,
      'items': [
        {
          'id': 'e1',
          'operation_id': 'op1',
          'kind': 'PAYMENT',
          'amount': '-300000.00',
          'balance_after': '950000.00',
          'created_at': '2026-10-28T03:00:00',
          'merchant_name': 'EVN',
          'bill_reference': 'DIEN-2026-10',
          'bookkeeping_id': 't1',
          'recorded_amount': '250000.00',
          'include_in_reports': false,
          'category_name': 'Hóa đơn',
        },
        {
          'id': 'e2',
          'operation_id': 'op2',
          'kind': 'TOPUP',
          'amount': '500000.00',
          'balance_after': '1250000.00',
          'created_at': '2026-10-27T03:00:00',
        },
      ],
    });
    final payment = page.items.first;
    expect(page.total, 2);
    expect(payment.isPayment, isTrue);
    expect(payment.isIncoming, isFalse);
    expect(payment.amount, -300000);
    expect(payment.recordedAmount, 250000);
    expect(payment.includeInReports, isFalse);
    expect(payment.label, 'Thanh toán hóa đơn');
    expect(page.items.last.isIncoming, isTrue);
    expect(page.items.last.bookkeepingId, isNull);
  });

  test('sổ thu chi: khoản không gắn ví và khoản từ thanh toán ví', () {
    final manual = Txn.fromJson({
      'id': 't0',
      'user_id': 'u1',
      'account_id': null,
      'amount': '-45000.00',
      'type': 'EXPENSE',
      'source': 'MANUAL',
      'kind': 'NORMAL',
      'transaction_date': '2026-10-28',
      'description': 'Cà phê',
      'note': null,
      'wallet_entry_id': null,
      'include_in_reports': true,
    });
    expect(manual.accountId, isNull);
    expect(manual.fromWalletPayment, isFalse);
    expect(manual.editable, isTrue);

    final paid = Txn.fromJson({
      'id': 't1',
      'amount': '-250000.00',
      'type': 'EXPENSE',
      'source': 'WALLET',
      'kind': 'NORMAL',
      'transaction_date': '2026-10-28',
      'description': 'EVN · DIEN-2026-10',
      'wallet_entry_id': 'e1',
      'include_in_reports': false,
    });
    expect(paid.fromWalletPayment, isTrue);
    expect(paid.includeInReports, isFalse);
    expect(paid.sourceLabel, 'Thanh toán ví');
  });

  test('ngân hàng liên kết và khoản thanh toán cần đối chiếu', () {
    final link = BankLink.fromJson({
      'id': 'l1',
      'provider': 'VCB',
      'account_number_masked': '*******123',
      'is_active': true,
      'expires_at': '2027-01-26T00:00:00',
      'status': 'CONNECTED',
    });
    expect(link.connected, isTrue);
    expect(link.statusLabel, 'Đã liên kết');

    final provider = BankProvider.fromJson('MOMO', {
      'name': 'MoMo',
      'demo_number': '0901234567',
      'label': 'Số điện thoại đăng ký MoMo',
      'hint': 'MoMo: nhập 10 chữ số',
    });
    expect(provider.code, 'MOMO');
    expect(provider.demoNumber, '0901234567');

    final candidate = PaymentCandidate.fromJson({
      'wallet_entry_id': 'e1',
      'transaction_id': 't1',
      'merchant_name': 'EVN',
      'bill_reference': 'DIEN-2026-10',
      'paid_amount': '300000.00',
      'created_at': '2026-10-28T03:00:00',
    });
    expect(candidate.walletEntryId, 'e1');
    expect(candidate.paidAmount, 300000);
  });
}
