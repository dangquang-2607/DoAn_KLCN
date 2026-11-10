import 'dart:math';
import 'dart:convert';

import '../../../ha_tang/api.dart';
import 'luu_anh.dart';

/// Only uploads and requests OCR. This runner never calls /confirm, /restore,
/// /duplicate-resolution or a transaction endpoint.
class InvoiceQueueRunner {
  InvoiceQueueRunner(
    this.store,
    this.api,
    this.session, {
    this.extraGuard,
    this.onChanged,
  });
  final InvoiceQueueStore store;
  final ApiClient api;
  final QueueSession session;
  final Future<void> Function()? extraGuard;
  final Future<void> Function()? onChanged;

  static String _attentionMessage(ApiException error) {
    switch (error.code) {
      case 'UPLOAD_INSUFFICIENT_DATA':
      case 'UPLOAD_INVALID_OCR':
        return '${error.message} Chụp/chọn lại ảnh rõ, không lóa, đủ người bán, ngày, tổng tiền và chi tiết hàng hoặc số hóa đơn.';
      case 'UPLOAD_HISTORY_INCOMPLETE':
        return '${error.message} Quay về danh sách hóa đơn để kiểm tra bản cũ trước khi thử lại.';
      case 'UPLOAD_REVIEW_REQUIRED':
        return '${error.message} Chọn Đối chiếu hóa đơn nghi trùng để kiểm tra ảnh đang chờ và bản cũ.';
    }
    if (error.statusCode == 413) {
      return 'Tệp vượt quá 2 MB. Chọn tệp nhỏ hơn rồi thêm lại.';
    }
    if (error.statusCode == 415) {
      return 'Nội dung tệp không khớp định dạng. Chọn ảnh JPG/PNG/WEBP hợp lệ rồi thêm lại.';
    }
    return '${error.message} Kiểm tra yêu cầu trước khi thử lại; gửi lại cùng tệp có thể không khắc phục được lỗi.';
  }

  Future<void> guard(QueuedInvoice job) async {
    if (api.tokens.ownerId != session.owner ||
        api.config.apiRoot != session.server) {
      throw QueueInterrupted();
    }
    await extraGuard?.call();
    await store.assertActive(
      session,
      sending: true,
      id: job.id,
      lease: job.lease,
    );
  }

  Future<void> run({int limit = 3}) async {
    for (var i = 0; i < limit; i++) {
      final job = await store.claim(session);
      if (job == null) return;
      await onChanged?.call();
      try {
        await guard(job);
        if (job.stage == 'upload') {
          final bytes = await store.bytes(job);
          final result = await api.uploadFile(
            '/invoices',
            bytes: bytes,
            filename: job.name,
            source: job.source,
            requestKey: job.requestKey,
            uploadTicket: job.uploadTicket,
            acceptDistinct: job.acceptDistinct,
            beforeSend: () => guard(job),
          );
          if (result is! Map ||
              result['id'] is! String ||
              !{
                'CREATED',
                'REUSED_DRAFT',
                'ALREADY_CONFIRMED',
                'RESTORE_REQUIRED',
              }.contains(result['outcome'])) {
            throw ApiException(
              'Chưa xác định kết quả tải lên. Sẽ thử lại bằng cùng yêu cầu.',
            );
          }
          await guard(job);
          final hidden = result['deleted_at'] != null ||
              result['outcome'] == 'RESTORE_REQUIRED';
          final ocr = !hidden && result['status'] == 'UPLOADED';
          await store.update(job, {
            'remote_id': result['id'] as String,
            'outcome': result['outcome'] as String,
            'stage': ocr ? 'ocr' : 'upload',
            'state': hidden
                ? 'attention'
                : ocr
                    ? 'waiting'
                    : 'done',
            'content': hidden ? bytes : null,
            'lease_id': null,
            'lease_until': 0,
            'next_attempt': 0,
            'error': hidden
                ? 'Bản cũ đang trong Thùng rác. Mở hóa đơn để khôi phục, sau đó bấm thử lại để gửi ảnh.'
                : null,
          });
        } else {
          // Reconcile after a lost OCR response rather than scheduling OCR a
          // second time after the first job has already completed.
          final detail = await api.get(
            '/invoices/${job.remoteId}',
            beforeSend: () => guard(job),
          );
          if (detail is! Map) {
            throw ApiException('Chưa đọc được trạng thái hóa đơn.');
          }
          if (detail['deleted_at'] != null) {
            await store.update(job, {
              'state': 'attention',
              'error':
                  'Hóa đơn đang trong Thùng rác trên máy chủ. Mở bản cũ để kiểm tra.',
              'lease_id': null,
              'lease_until': 0,
            });
          } else {
            if (detail['status'] == 'UPLOADED') {
              await api.post(
                '/invoices/${job.remoteId}/ocr',
                beforeSend: () => guard(job),
              );
            }
            await guard(job);
            await store.update(job, {
              'state': 'done',
              'content': null,
              'error': null,
              'lease_id': null,
              'lease_until': 0,
            });
          }
        }
      } on QueueInterrupted {
        await store.update(job, {'lease_id': null, 'lease_until': 0});
        return;
      } on ApiException catch (error) {
        final attempt = job.attempts + 1;
        final retry = error.uncertain;
        final auth = error.statusCode == 401;
        final seconds = min(900, 15 * pow(2, min(attempt - 1, 6)).toInt());
        await store.update(job, {
          'state': auth
              ? 'auth'
              : retry
                  ? 'retry'
                  : 'attention',
          if (error.code == 'UPLOAD_REVIEW_REQUIRED') ...{
            'upload_ticket': error.detail['upload_ticket'] as String?,
            'review_json': jsonEncode(error.detail['duplicate_check']),
            'accept_distinct': 0,
          },
          if (error.code == 'UPLOAD_TICKET_EXPIRED') ...{
            'upload_ticket': null,
            'review_json': null,
            'accept_distinct': 0,
          },
          'attempts': attempt,
          'next_attempt': store.timestamp + seconds * 1000,
          'error': auth
              ? 'Cần mở ứng dụng và đăng nhập lại để tiếp tục.'
              : retry
                  ? (job.stage == 'ocr'
                      ? 'Chưa xác định kết quả yêu cầu quét. Hệ thống sẽ kiểm tra trạng thái và tự thử lại; không cần tải thêm bản mới.'
                      : 'Chưa tải lên xong do kết nối hoặc máy chủ tạm thời. Tệp vẫn được giữ; hệ thống sẽ tự thử lại.')
                  : _attentionMessage(error),
          'lease_id': null,
          'lease_until': 0,
        });
        if (retry || auth) return;
      } on StateError catch (error) {
        await store.update(job, {
          'state': 'attention',
          'error': error.message.toString(),
          'lease_id': null,
          'lease_until': 0,
        });
      } catch (_) {
        await store.update(job, {
          'state': 'retry',
          'error': 'Chưa hoàn tất. Dữ liệu được giữ để thử lại.',
          'next_attempt': store.timestamp + 60000,
          'lease_id': null,
          'lease_until': 0,
        });
        return;
      } finally {
        await onChanged?.call();
      }
    }
  }
}
