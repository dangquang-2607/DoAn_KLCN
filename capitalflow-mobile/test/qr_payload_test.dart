// Nhận diện nội dung QR nhận tiền CapitalFlow (cùng định dạng backend sinh ở /wallets/{id}/receive).
import 'package:capitalflow_mobile/screens/accounts/qr_scan_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('chỉ nhận QR chuyển tiền CapitalFlow, bỏ qua QR khác', () {
    expect(isCapitalFlowQr('capitalflow://transfer?v=1&wallet_id=9f602616-7442-49e3-a7fc-f9b3f2fd8faa'), isTrue);
    expect(isCapitalFlowQr('  CapitalFlow://transfer?v=1&wallet_id=abc  '), isTrue);
    expect(isCapitalFlowQr('https://example.com/pay?id=1'), isFalse);
    expect(isCapitalFlowQr('00020101021238570010A000000727'), isFalse);
    expect(isCapitalFlowQr('demo@example.com'), isFalse);
  });
}
