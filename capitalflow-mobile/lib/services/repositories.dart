import 'dart:typed_data';

import '../core/api_client.dart';
import '../core/formatters.dart';
import '../models/models.dart';

/// Các lời gọi REST theo từng phân hệ. Mọi thao tác ghi tiền (ví, giao dịch)
/// đều đi kèm `Idempotency-Key` đúng như bản web để backend chống ghi trùng.

class FinanceRepository {
  FinanceRepository(this.api);

  final ApiClient api;

  // ── Ví độc lập (giống bản web) ────────────────────────────────────────────
  //
  // Ví có số dư riêng, chỉ thay đổi khi nạp/rút qua ngân hàng liên kết,
  // chuyển giữa các ví hoặc thanh toán hóa đơn. Ví mới luôn bắt đầu từ 0đ.

  Future<List<Wallet>> wallets({bool includeClosed = false}) async {
    return asJsonList(await api.get('/wallets',
            query: {if (includeClosed) 'include_closed': 'true'}))
        .map(Wallet.fromJson)
        .toList();
  }

  Future<Wallet> createWallet(String name) async {
    final data = await api.post('/wallets', money: true, body: {'name': name});
    return Wallet.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<Wallet> renameWallet(String id, String name) async {
    final data =
        await api.patch('/wallets/$id', money: true, body: {'name': name});
    return Wallet.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Đóng ví (không khôi phục được). Backend chỉ cho đóng ví phụ có số dư 0đ.
  Future<void> closeWallet(String id) async {
    await api.delete('/wallets/$id', money: true);
  }

  Future<WalletHistoryPage> walletHistory(String id,
      {int page = 1, int pageSize = 20}) async {
    final data = await api.get('/wallets/$id/history',
        query: {'page': page, 'page_size': pageSize});
    return WalletHistoryPage.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<ReceiveInfo> receiveInfo(String walletId) async {
    final data = await api.get('/wallets/$walletId/receive');
    return ReceiveInfo.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Xác minh người nhận từ email, mã ví `CF-...`, id ví hoặc nội dung QR.
  Future<Recipient> resolveRecipient(String value) async {
    final data = await api
        .post('/wallets/recipients/resolve', body: {'recipient': value});
    return Recipient.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<void> transferBetweenWallets({
    required String fromWalletId,
    required String toWalletId,
    required int amount,
  }) async {
    await api.post('/wallets/$fromWalletId/transfers/create',
        money: true, body: {'to_wallet_id': toWalletId, 'amount': amount});
  }

  /// Nạp (`topup`) hoặc rút (`withdraw`) qua một ngân hàng đã liên kết.
  Future<void> bankMoney({
    required String walletId,
    required bool topup,
    required String linkId,
    required int amount,
  }) async {
    await api.post('/wallets/$walletId/${topup ? 'topup' : 'withdraw'}',
        money: true, body: {'link_id': linkId, 'amount': amount});
  }

  /// Thanh toán hóa đơn mô phỏng: trừ tiền ví và tạo (hoặc gắn) khoản chi trong sổ.
  Future<Json> payBill({
    required String walletId,
    required String merchantName,
    required String billReference,
    required int amount,
    String? bookkeepingId,
  }) async {
    final data = await api.post('/wallets/$walletId/payments/create',
        money: true,
        body: {
          'merchant_name': merchantName,
          'bill_reference': billReference,
          'amount': amount,
          'bookkeeping_id': bookkeepingId,
        });
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<BankProvider>> bankProviders() async {
    final data = Map<String, dynamic>.from(await api.get('/wallets/providers') as Map);
    return [
      for (final entry in data.entries)
        if (entry.value is Map)
          BankProvider.fromJson(
              entry.key, Map<String, dynamic>.from(entry.value as Map)),
    ];
  }

  Future<List<BankLink>> bankLinks() async {
    return asJsonList(await api.get('/wallets/banks'))
        .map(BankLink.fromJson)
        .toList();
  }

  /// Gửi OTP qua email để xác nhận liên kết ngân hàng; trả về mã yêu cầu OTP.
  Future<String> sendBankOtp(
      {required String provider, required String accountNumber}) async {
    final data = await api.post('/wallets/banks/send-otp',
        body: {'provider': provider, 'account_number': accountNumber});
    return (data as Map)['otp_request_id'].toString();
  }

  Future<void> linkBank({
    required String provider,
    required String accountNumber,
    required String otpRequestId,
    required String otp,
  }) async {
    await api.post('/wallets/banks', money: true, body: {
      'provider': provider,
      'account_number': accountNumber,
      'otp_request_id': otpRequestId,
      'otp': otp,
    });
  }

  Future<void> unlinkBank(String linkId) async {
    await api.delete('/wallets/banks/$linkId', money: true);
  }

  // ── Danh mục ──────────────────────────────────────────────────────────────

  Future<List<FinanceCategory>> categories() async {
    return asJsonList(await api.get('/categories'))
        .map(FinanceCategory.fromJson)
        .toList();
  }

  Future<void> createCategory({
    required String name,
    required String type,
    required String icon,
    required String color,
    String? keywords,
  }) async {
    await api.post('/categories', body: {
      'name': name,
      'type': type,
      'icon': icon,
      'color': color,
      'keywords': (keywords == null || keywords.trim().isEmpty)
          ? null
          : keywords.trim(),
    });
  }

  Future<void> updateCategory(
    String id, {
    required String name,
    required String icon,
    required String color,
    String? keywords,
  }) async {
    await api.patch('/categories/$id', body: {
      'name': name,
      'icon': icon,
      'color': color,
      'keywords': (keywords == null || keywords.trim().isEmpty)
          ? null
          : keywords.trim(),
    });
  }

  Future<void> deleteCategory(String id) async {
    await api.delete('/categories/$id');
  }

  /// Gợi ý danh mục tự động từ diễn giải (lịch sử phân loại + từ khóa danh mục).
  Future<CategorySuggestion> suggestCategory({
    required String type,
    required String description,
    String? note,
    List<String> itemNames = const [],
  }) async {
    final data = await api.post('/categories/suggest', body: {
      'type': type,
      'description': description.length > 255
          ? description.substring(0, 255)
          : description,
      if (note != null && note.isNotEmpty) 'note': note,
      if (itemNames.isNotEmpty) 'item_names': itemNames.take(50).toList(),
    });
    return CategorySuggestion.fromJson(Map<String, dynamic>.from(data as Map));
  }

  // ── Sổ thu chi (giống bản web) ────────────────────────────────────────────
  //
  // Ghi sổ thu/chi không gắn ví và không làm thay đổi số dư ví. Khoản chi sinh
  // ra từ thanh toán ví được giữ để đối chiếu: chỉ sửa phần ghi nhận cá nhân
  // hoặc tắt "Tính vào chi tiêu", không xóa được.

  Future<TxnPage> transactions({
    int page = 1,
    int pageSize = 30,
    String? type,
    String? origin,
    String? categoryId,
    String? search,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final data = await api.get('/bookkeeping', query: {
      'page': page,
      'page_size': pageSize,
      'type': type,
      'origin': origin,
      'category_id': categoryId,
      'search': (search == null || search.trim().isEmpty) ? null : search.trim(),
      'start_date': startDate == null ? null : isoDate(startDate),
      'end_date': endDate == null ? null : isoDate(endDate),
    });
    return TxnPage.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Ghi khoản thu/chi mới. Nếu có khoản thanh toán ví cùng ngày và số tiền,
  /// backend trả 409 `PAYMENT_RECORD_REVIEW_REQUIRED` kèm danh sách để người
  /// dùng gắn vào khoản đã có ([walletEntryId]) hoặc xác nhận là khoản khác
  /// ([acceptSeparate]).
  Future<Txn> createTransaction({
    required String type,
    required int amount,
    required DateTime date,
    required String description,
    String? categoryId,
    String? note,
    String? walletEntryId,
    bool acceptSeparate = false,
  }) async {
    final data = await api.post(
      '/bookkeeping',
      money: true,
      body: {
        'type': type,
        'amount': amount,
        'transaction_date': isoDate(date),
        'description': description,
        'category_id': categoryId,
        'note': (note == null || note.isEmpty) ? null : note,
        'wallet_entry_id': walletEntryId,
        'accept_separate_record': acceptSeparate,
      },
    );
    return Txn.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<Txn> updateTransaction(
    String id, {
    required String type,
    required int amount,
    required DateTime date,
    required String description,
    required String? categoryId,
    required String? note,
    bool? includeInReports,
  }) async {
    final data = await api.patch(
      '/bookkeeping/$id',
      money: true,
      body: {
        'type': type,
        'amount': amount,
        'transaction_date': isoDate(date),
        'description': description,
        // Gửi cả giá trị null để người dùng có thể bỏ phân loại/ghi chú.
        'category_id': categoryId,
        'note': (note == null || note.isEmpty) ? null : note,
        if (includeInReports != null) 'include_in_reports': includeInReports,
      },
    );
    return Txn.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Sửa phần ghi nhận cá nhân của một khoản thanh toán ví.
  Future<void> updatePaymentRecord(
    String bookkeepingId, {
    int? amount,
    bool? includeInReports,
    String? categoryId,
    bool setCategory = false,
  }) async {
    await api.patch('/bookkeeping/$bookkeepingId', money: true, body: {
      if (amount != null) 'amount': amount,
      if (includeInReports != null) 'include_in_reports': includeInReports,
      if (setCategory) 'category_id': categoryId,
    });
  }

  Future<void> deleteTransaction(String id) async {
    await api.delete('/bookkeeping/$id', money: true);
  }

  // ── Ngân sách ─────────────────────────────────────────────────────────────

  Future<List<BudgetProgress>> budgets() async {
    return asJsonList(await api.get('/budgets'))
        .map(BudgetProgress.fromJson)
        .toList();
  }

  Future<void> createBudget({
    required String name,
    required int amountLimit,
    required String periodType,
    required DateTime startDate,
    required DateTime endDate,
    required int warningPercent,
    String? categoryId,
  }) async {
    await api.post('/budgets', body: {
      'name': name,
      'amount_limit': amountLimit,
      'currency': 'VND',
      'period_type': periodType,
      'start_date': isoDate(startDate),
      'end_date': isoDate(endDate),
      'warning_percent': warningPercent,
      if (categoryId != null) 'category_id': categoryId,
    });
  }

  Future<void> updateBudget(
    String id, {
    required String name,
    required int amountLimit,
    required String periodType,
    required DateTime startDate,
    required DateTime endDate,
    required int warningPercent,
  }) async {
    await api.patch('/budgets/$id', body: {
      'name': name,
      'amount_limit': amountLimit,
      'period_type': periodType,
      'start_date': isoDate(startDate),
      'end_date': isoDate(endDate),
      'warning_percent': warningPercent,
    });
  }

  Future<void> deleteBudget(String id) async {
    await api.delete('/budgets/$id');
  }

  // ── Tổng quan & báo cáo ───────────────────────────────────────────────────

  /// Tổng quan: tổng số dư các ví đang dùng và thu chi tháng này từ sổ thu chi.
  Future<DashboardData> dashboard() async {
    final data = await api.get('/bookkeeping/dashboard');
    return DashboardData.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<AnalyticsData> analytics(
      {required DateTime start, required DateTime end}) async {
    final data = await api.get('/analytics', query: {
      'start_date': isoDate(start),
      'end_date': isoDate(end),
    });
    return AnalyticsData.fromJson(Map<String, dynamic>.from(data as Map));
  }
}

class InvoiceRepository {
  InvoiceRepository(this.api);

  final ApiClient api;

  Future<List<InvoiceSummary>> list(
      {String? status, int page = 1, int pageSize = 50}) async {
    final data = await api.get('/invoices', query: {
      'page': page,
      'page_size': pageSize,
      'status': status == 'HIDDEN' ? null : status,
      'visibility': status == 'HIDDEN' ? 'hidden' : 'active',
    });
    final map = Map<String, dynamic>.from(data as Map);
    return asJsonList(map['items']).map(InvoiceSummary.fromJson).toList();
  }

  Future<InvoiceDetail> detail(String id) async {
    final data = await api.get('/invoices/$id');
    return InvoiceDetail.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Tải ảnh/PDF/XML hóa đơn lên; trả về id hóa đơn vừa tạo.
  Future<InvoiceSummary> upload(
      {required List<int> bytes,
      required String filename,
      String source = 'UPLOAD'}) async {
    final data = await api.uploadFile('/invoices',
        bytes: bytes, filename: filename, source: source);
    return InvoiceSummary.fromJson(Map<String, dynamic>.from(data as Map));
  }

  /// Đưa hóa đơn vào hàng đợi nhận dạng OCR (worker nền xử lý bằng Gemini).
  Future<void> requestOcr(String id) async {
    await api.post('/invoices/$id/ocr');
  }

  Future<Uint8List> fileBytes(String id) {
    return api.getBytes('/invoices/$id/file');
  }

  Future<Json> preview(String id, Json fields) async {
    const names = [
      'merchant_name',
      'merchant_address',
      'merchant_tax_code',
      'invoice_number',
      'invoice_symbol',
      'invoice_date',
      'invoice_time',
      'total_amount',
      'items'
    ];
    final data = await api.post('/invoices/$id/duplicate-check', body: {
      for (final name in names)
        if (fields.containsKey(name)) name: fields[name],
    });
    return Map<String, dynamic>.from(data as Map);
  }

  /// Ghi sổ hóa đơn thành khoản chi (luồng sổ thu chi của bản web: không chọn ví).
  Future<Json> confirm(String id, Json payload) async =>
      Map<String, dynamic>.from(await api.invoicePost(
          '/bookkeeping/invoices/$id/confirm', payload) as Map);

  Future<Json> resolve(String id, int revision, {String? matchedId}) async =>
      Map<String, dynamic>.from(
          await api.invoicePost('/invoices/$id/duplicate-resolution', {
        'expected_revision': revision,
        'action': matchedId == null ? 'CLEAR' : 'SAME_INVOICE',
        if (matchedId != null) 'matched_invoice_id': matchedId,
      }) as Map);

  Future<Json> restore(String id, int revision) async =>
      Map<String, dynamic>.from(await api.invoicePost('/invoices/$id/restore', {
        'expected_revision': revision,
      }) as Map);

  Future<void> delete(String id) async {
    await api.delete('/invoices/$id');
  }
}

class NotificationPageResult {
  NotificationPageResult(
      {required this.items, required this.total, required this.unread});

  final List<AppNotification> items;
  final int total;
  final int unread;
}

class NotificationRepository {
  NotificationRepository(this.api);

  final ApiClient api;

  Future<NotificationPageResult> list(
      {int page = 1, int pageSize = 30, bool unreadOnly = false}) async {
    final data = await api.get('/notifications', query: {
      'page': page,
      'page_size': pageSize,
      if (unreadOnly) 'unread_only': 'true',
    });
    final map = Map<String, dynamic>.from(data as Map);
    return NotificationPageResult(
      items: asJsonList(map['items']).map(AppNotification.fromJson).toList(),
      total: asInt(map['total']),
      unread: asInt(map['unread_count'] ?? map['unread']),
    );
  }

  /// Đối soát 100 thông báo mới nhất qua endpoint REST hiện có.
  /// NotificationCenter khử trùng theo id, không dùng timestamp của điện thoại.
  Future<NotificationPageResult> sync() => list(pageSize: 100);

  Future<int> markRead(String id) async {
    await api.post('/notifications/$id/read');
    // Endpoint trả về bản ghi đã đọc, không trả bộ đếm chưa đọc.
    return (await list(pageSize: 1)).unread;
  }

  Future<void> markAllRead() async {
    await api.post('/notifications/read-all');
  }

  Future<void> remove(String id) async {
    await api.delete('/notifications/$id');
  }

  Future<void> clearRead() async {
    await api.delete('/notifications', query: {'only_read': 'true'});
  }
}

class AdminRepository {
  AdminRepository(this.api);

  final ApiClient api;

  Future<AdminOverview> overview() async {
    final data = await api.get('/admin/overview');
    return AdminOverview.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<List<AdminUser>> users(
      {String? search, String? status, int page = 1, int pageSize = 50}) async {
    final data = await api.get('/admin/users', query: {
      'page': page,
      'page_size': pageSize,
      'search': search,
      'status': status,
    });
    final map = Map<String, dynamic>.from(data as Map);
    return asJsonList(map['items']).map(AdminUser.fromJson).toList();
  }

  Future<String> createUser(
      {required String email,
      required String fullName,
      required String role}) async {
    final data = await api.post('/admin/users', body: {
      'email': email,
      'full_name': fullName,
      'role': role,
    });
    return (Map<String, dynamic>.from(data as Map)['message'] ??
            'Đã tạo tài khoản.')
        .toString();
  }

  Future<void> ban(String userId) async {
    await api.patch('/admin/users/$userId/ban');
  }

  Future<void> unban(String userId) async {
    await api.patch('/admin/users/$userId/unban');
  }

  Future<void> resetPassword(String userId) async {
    await api.post('/admin/users/$userId/reset-password');
  }
}
