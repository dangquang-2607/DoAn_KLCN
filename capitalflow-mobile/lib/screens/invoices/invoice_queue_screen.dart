import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/invoice_queue.dart';
import '../../services/invoice_queue_store.dart';
import '../../widgets/common.dart';
import 'invoice_review_screen.dart';

class InvoiceQueueScreen extends StatelessWidget {
  const InvoiceQueueScreen({super.key});

  Future<void> _remove(
      BuildContext context, InvoiceQueue queue, QueuedInvoice job) async {
    final yes = await confirmDialog(context,
        title: 'Xóa bản lưu trên điện thoại?',
        message: job.remoteId != null || job.sending || job.attempts > 0
            ? 'Thao tác này chỉ xóa bản trong hàng đợi. Yêu cầu đã gửi có thể đã được máy chủ nhận; hóa đơn trên máy chủ vẫn được giữ.'
            : 'Ảnh chưa gửi sẽ bị xóa khỏi hàng đợi trên điện thoại.',
        confirmLabel: 'Xóa bản cục bộ',
        danger: true);
    if (yes) await queue.remove(job.id);
  }

  @override
  Widget build(BuildContext context) {
    final queue = context.watch<InvoiceQueue>();
    return Scaffold(
      appBar: AppBar(title: const Text('Hàng đợi hóa đơn'), actions: [
        IconButton(
            tooltip: 'Đồng bộ',
            onPressed: queue.sync,
            icon: const Icon(Icons.sync)),
      ]),
      body: Column(children: [
        Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              const Text(
                  'Ảnh được lưu trên điện thoại trước khi gửi. Hệ thống chỉ tải lên và yêu cầu quét; bạn vẫn cần kiểm tra và xác nhận khoản chi.'),
              SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Tự gửi khi có kết nối'),
                  subtitle: const Text(
                      'Sử dụng Wi-Fi hoặc dữ liệu di động. Gửi nền tùy lịch của Android.'),
                  value: !queue.paused,
                  onChanged: (value) => queue.setPaused(!value)),
              if (queue.error != null)
                Text(queue.error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              if (queue.backgroundNotice != null) Text(queue.backgroundNotice!),
            ])),
        Expanded(
            child: RefreshIndicator(
                onRefresh: queue.refresh,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  children: [
                    if (queue.items.isEmpty)
                      const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: Text(
                              'Chưa có tệp trong hàng đợi của tài khoản này.')),
                    for (final job in queue.items)
                      Card(
                          child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(job.name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 6),
                                  Text(
                                      '${(job.size / 1024).ceil()} KB · ${job.source == 'CAMERA' ? 'Camera' : 'Tệp đã chọn'}'),
                                  Text(job.sending
                                      ? (job.stage == 'ocr'
                                          ? 'Đang yêu cầu quét'
                                          : 'Đang gửi')
                                      : _label(job, queue.paused)),
                                  if (job.error != null)
                                    Padding(
                                        padding: const EdgeInsets.only(top: 6),
                                        child: Text(job.error!)),
                                  Wrap(spacing: 8, children: [
                                    if (job.remoteId != null)
                                      TextButton(
                                          onPressed: () async {
                                            await pushScreen<bool>(
                                                context,
                                                InvoiceReviewScreen(
                                                    invoiceId: job.remoteId!));
                                            await queue.refresh();
                                          },
                                          child: const Text(
                                              'Mở hóa đơn trên máy chủ')),
                                    if (job.state != 'done' && !job.sending)
                                      TextButton(
                                          onPressed: () => queue.retry(job.id),
                                          child: const Text('Thử lại')),
                                    TextButton(
                                        onPressed: () =>
                                            _remove(context, queue, job),
                                        child: const Text('Xóa bản cục bộ')),
                                  ]),
                                ],
                              ))),
                    const Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Text(
                            'Giới hạn lưu chờ: 20 tệp, tổng 100 MB trên thiết bị. Sau khi gửi thành công, ảnh cục bộ được giải phóng. Lịch sử đã gửi được giữ tối đa 7 ngày.')),
                  ],
                ))),
      ]),
    );
  }

  String _label(QueuedInvoice job, bool paused) {
    if (job.state == 'done') {
      return job.outcome == 'ALREADY_CONFIRMED'
          ? 'Hóa đơn đã ghi sổ trước đó, không ghi thêm'
          : job.outcome == 'REUSED_DRAFT'
              ? 'Đã mở lại hóa đơn có sẵn'
              : 'Đã gửi, mở hóa đơn để kiểm tra';
    }
    if (job.state == 'attention') return 'Cần bạn xử lý';
    if (job.state == 'auth') return 'Cần kiểm tra phiên đăng nhập';
    if (paused) return 'Đang tạm dừng';
    return job.state == 'retry'
        ? 'Chờ kết nối / tự thử lại'
        : job.stage == 'ocr'
            ? 'Chờ yêu cầu quét'
            : 'Chờ gửi';
  }
}
