import 'package:flutter/material.dart';
import '../../core/formatters.dart';
import '../../models/models.dart';

/// Chỉ cho bỏ qua nghi ngờ; trùng chắc chắn luôn dẫn về bản gốc.
Future<String?> reviewInvoiceDuplicates(BuildContext context, Json check) {
  final suspected =
      check['level'] == 'SUSPECTED' && check['can_override'] == true;
  const reasons = {
    'SAME_FILE': 'Nội dung tệp giống nhau',
    'SAME_IDENTITY': 'Trùng mã số thuế, ký hiệu, số hóa đơn và năm',
    'IDENTITY_DATA_CONFLICT':
        'Trùng định danh nhưng ngày hoặc số tiền khác nhau; cần kiểm tra bản gốc',
    'SAME_MERCHANT_DATE_AMOUNT': 'Cùng cửa hàng, ngày và số tiền',
    'SAME_RECEIPT_NUMBER_ADDRESS_DATE_AMOUNT':
        'Cùng số hóa đơn, địa chỉ, ngày và số tiền',
  };
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(suspected ? 'Hóa đơn có thể trùng' : 'Hóa đơn đã tồn tại'),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(suspected
                    ? 'Đối chiếu với hóa đơn dưới đây trước khi ghi thêm khoản chi.'
                    : 'Không thể ghi thêm khoản chi từ hóa đơn trùng. Hãy mở bản gốc.'),
                for (final candidate in asJsonList(check['candidates'])) ...[
                  const Divider(height: 24),
                  Text(asText(candidate['merchant_name']) ?? 'Hóa đơn',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                      '${candidate['invoice_date'] ?? 'Chưa có ngày'} · ${formatMoney(asDouble(candidate['total_amount']))}'),
                  Text(candidate['transaction_id'] != null
                      ? 'Đã ghi sổ'
                      : 'Chưa ghi sổ'),
                  if (candidate['deleted_at'] != null)
                    const Text('Đang ẩn; khoản chi vẫn được giữ'),
                  Text(reasons[candidate['reason']] ?? 'Thông tin tương đồng'),
                  TextButton(
                      onPressed: () => Navigator.pop(
                          context, 'open:${candidate['invoice_id']}'),
                      child: const Text('Mở hóa đơn gốc')),
                  if (suspected)
                    TextButton(
                        onPressed: () => Navigator.pop(
                            context, 'same:${candidate['invoice_id']}'),
                        child: const Text('Đây là cùng một hóa đơn')),
                ],
                if (asInt(check['candidate_count']) > 20)
                  const Text('Đang hiển thị 20 hóa đơn tương đồng đầu tiên.'),
              ]),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Quay lại kiểm tra')),
        if (suspected)
          FilledButton(
              onPressed: () => Navigator.pop(context, 'distinct'),
              child: const Text('Đây là khoản chi khác, tiếp tục')),
      ],
    ),
  );
}
