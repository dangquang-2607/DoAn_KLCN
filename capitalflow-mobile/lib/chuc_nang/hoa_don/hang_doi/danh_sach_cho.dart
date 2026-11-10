import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'dieu_phoi.dart';
import 'luu_anh.dart';
import '../../../dung_chung/giao_dien/thanh_phan.dart';
import '../kiem_tra.dart';
import '../doi_chieu_anh.dart';

class InvoiceQueueScreen extends StatelessWidget {
  const InvoiceQueueScreen({super.key});

  Future<void> _remove(
    BuildContext context,
    InvoiceQueue queue,
    QueuedInvoice job,
  ) async {
    final yes = await confirmDialog(
      context,
      title: 'Xóa bản lưu trên điện thoại?',
      message: job.remoteId != null || job.sending || job.attempts > 0
          ? 'Thao tác này chỉ xóa bản trong hàng đợi. Yêu cầu đã gửi có thể đã được máy chủ nhận; hóa đơn trên máy chủ vẫn được giữ.'
          : 'Ảnh chưa gửi sẽ bị xóa khỏi hàng đợi trên điện thoại.',
      confirmLabel: 'Xóa bản cục bộ',
      danger: true,
    );
    if (yes) await queue.remove(job.id);
  }

  @override
  Widget build(BuildContext context) {
    final queue = context.watch<InvoiceQueue>();
    return Scaffold(
      appBar: appBar(
        context,
        'Hàng đợi hóa đơn',
        actions: [
          IconButton(
            tooltip: 'Đồng bộ',
            onPressed: queue.sync,
            icon: const Icon(Icons.sync),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text(
                  'Ảnh được lưu trên điện thoại trước khi gửi. Hệ thống chỉ tải lên và yêu cầu quét; bạn vẫn cần kiểm tra và xác nhận khoản chi.',
                ),
                Text(
                  '${queue.pendingCount} chưa hoàn tất · ${queue.items.where((j) => j.state == 'attention' || j.state == 'auth').length} cần xử lý',
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Tự gửi khi có kết nối'),
                  subtitle: const Text(
                    'Sử dụng Wi-Fi hoặc dữ liệu di động. Gửi nền tùy lịch của Android.',
                  ),
                  value: !queue.paused,
                  onChanged: (value) => queue.setPaused(!value),
                ),
                if (queue.error != null)
                  Text(
                    queue.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                if (queue.backgroundNotice != null)
                  Text(queue.backgroundNotice!),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: queue.refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  if (queue.items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: Text(
                        'Chưa có tệp trong hàng đợi của tài khoản này.',
                      ),
                    ),
                  for (final job in queue.items)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              job.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${(job.size / 1024).ceil()} KB · ${job.source == 'CAMERA' ? 'Camera' : 'Tệp đã chọn'}',
                            ),
                            Text(
                              job.sending
                                  ? (job.stage == 'ocr'
                                      ? 'Đang yêu cầu quét'
                                      : 'Đang gửi')
                                  : _label(job, queue.paused),
                            ),
                            if (job.state == 'retry' &&
                                !queue.paused &&
                                job.nextAttempt > 0)
                              Text(
                                'Lần thử tự động sớm nhất: ${TimeOfDay.fromDateTime(DateTime.fromMillisecondsSinceEpoch(job.nextAttempt)).format(context)}. Lịch gửi nền có thể muộn hơn.',
                              ),
                            if (job.state == 'attention')
                              const Text(
                                'Nếu ảnh mờ hoặc thiếu thông tin, quay về Thêm hóa đơn để chụp/chọn lại. Nếu đã có hóa đơn trên máy chủ, mở để kiểm tra hoặc chỉnh sửa.',
                              ),
                            if (job.state == 'auth')
                              const Text(
                                'Kiểm tra tài khoản và đăng nhập lại trước khi tiếp tục gửi.',
                              ),
                            if (job.error != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(job.error!),
                              ),
                            Wrap(
                              spacing: 8,
                              children: [
                                if (job.review != null &&
                                    job.uploadTicket != null &&
                                    !job.acceptDistinct)
                                  TextButton(
                                      onPressed: () async {
                                        final scope = queue.session?.scope;
                                        try {
                                          final bytes =
                                              await queue.store.bytes(job);
                                          if (!context.mounted ||
                                              scope != queue.session?.scope) {
                                            return;
                                          }
                                          final decision =
                                              await reviewInvoiceDuplicates(
                                                  context, job.review!,
                                                  upload: bytes);
                                          if (!context.mounted ||
                                              decision == null) {
                                            return;
                                          }
                                          if (decision == 'distinct') {
                                            try {
                                              await queue.acceptReview(job);
                                            } catch (e) {
                                              showSnack(errorText(e),
                                                  error: true);
                                            }
                                          } else if (decision
                                                  .startsWith('open:') ||
                                              decision.startsWith('same:')) {
                                            await pushScreen<bool>(
                                                context,
                                                InvoiceReviewScreen(
                                                    invoiceId: decision
                                                        .substring(decision
                                                                .indexOf(':') +
                                                            1)));
                                          }
                                        } catch (e) {
                                          showSnack(errorText(e), error: true);
                                        }
                                      },
                                      child: const Text(
                                          'Đối chiếu hóa đơn nghi trùng')),
                                if (job.remoteId != null)
                                  TextButton(
                                    onPressed: () async {
                                      await pushScreen<bool>(
                                        context,
                                        InvoiceReviewScreen(
                                          invoiceId: job.remoteId!,
                                        ),
                                      );
                                      await queue.refresh();
                                    },
                                    child: const Text(
                                      'Mở hóa đơn trên máy chủ',
                                    ),
                                  ),
                                if ((job.state == 'waiting' ||
                                        job.state == 'retry' ||
                                        job.state == 'attention') &&
                                    (job.uploadTicket == null ||
                                        job.acceptDistinct) &&
                                    !job.sending &&
                                    !queue.paused)
                                  TextButton(
                                    onPressed: () => queue.retry(job.id),
                                    child: Text(
                                      job.state == 'attention'
                                          ? 'Đã xử lý, thử lại'
                                          : 'Thử gửi lại',
                                    ),
                                  ),
                                TextButton(
                                  onPressed: () => _remove(context, queue, job),
                                  child: const Text('Xóa bản cục bộ'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Text(
                      'Giới hạn lưu chờ: 20 tệp, tổng 100 MB trên thiết bị. Sau khi gửi thành công, ảnh cục bộ được giải phóng. Lịch sử đã gửi được giữ tối đa 7 ngày.',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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
