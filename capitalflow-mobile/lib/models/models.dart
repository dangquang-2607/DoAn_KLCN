import '../core/formatters.dart';

/// Các kiểu dữ liệu ánh xạ 1-1 với hợp đồng REST API của CapitalFlow
/// (cùng API mà hai cổng web đang dùng nên dữ liệu luôn đồng bộ).

typedef Json = Map<String, dynamic>;

List<Json> asJsonList(dynamic value) {
  if (value is! List) return <Json>[];
  final result = <Json>[];
  for (final item in value) {
    if (item is Map) result.add(Map<String, dynamic>.from(item));
  }
  return result;
}

// ── Người dùng ──────────────────────────────────────────────────────────────

class UserProfile {
  UserProfile({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.isActive,
    required this.mustChangePassword,
    this.createdAt,
    this.lastLoginAt,
  });

  final String id;
  final String email;
  final String fullName;
  final String role;
  final bool isActive;
  final bool mustChangePassword;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  bool get isAdmin => role.toLowerCase() == 'admin';

  String get displayName => fullName.trim().isEmpty ? email : fullName.trim();

  String get initials {
    final parts = displayName
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }

  factory UserProfile.fromJson(Json json) {
    return UserProfile(
      id: json['id'].toString(),
      email: (json['email'] ?? '').toString(),
      fullName: (json['full_name'] ?? '').toString(),
      role: (json['role'] ?? 'user').toString(),
      isActive: json['is_active'] != false,
      mustChangePassword: json['must_change_password'] == true,
      createdAt: parseApiDateTime(json['created_at']),
      lastLoginAt: parseApiDateTime(json['last_login_at']),
    );
  }
}

class LoginSession {
  LoginSession(
      {required this.id,
      this.deviceName,
      this.ipAddress,
      this.createdAt,
      this.lastUsedAt});

  final String id;
  final String? deviceName;
  final String? ipAddress;
  final DateTime? createdAt;
  final DateTime? lastUsedAt;

  factory LoginSession.fromJson(Json json) {
    return LoginSession(
      id: json['id'].toString(),
      deviceName: asText(json['device_name']),
      ipAddress: asText(json['ip_address']),
      createdAt: parseApiDateTime(json['created_at']),
      lastUsedAt: parseApiDateTime(json['last_used_at']),
    );
  }
}

// ── Ví & danh mục ───────────────────────────────────────────────────────────

class Wallet {
  Wallet({
    required this.id,
    required this.name,
    required this.accountType,
    required this.balance,
    required this.currency,
    this.institutionName,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String accountType;
  final double balance;
  final String currency;
  final String? institutionName;
  final bool isActive;

  factory Wallet.fromJson(Json json) {
    return Wallet(
      id: json['id'].toString(),
      name: (json['name'] ?? '').toString(),
      accountType: (json['account_type'] ?? 'OTHER').toString(),
      balance: asDouble(json['balance']),
      currency: (json['currency'] ?? 'VND').toString(),
      institutionName: asText(json['institution_name']),
      isActive: json['is_active'] != false,
    );
  }
}

class FinanceCategory {
  FinanceCategory({
    required this.id,
    required this.name,
    required this.type,
    required this.sortOrder,
    this.icon,
    this.color,
    this.keywords,
    this.ownerUserId,
    this.isActive = true,
  });

  final String id;
  final String name;

  /// `INCOME` hoặc `EXPENSE`.
  final String type;
  final int sortOrder;
  final String? icon;
  final String? color;
  final String? keywords;
  final String? ownerUserId;
  final bool isActive;

  /// Danh mục hệ thống do quản trị viên tạo, người dùng không sửa được.
  bool get isSystem => ownerUserId == null;
  bool get isIncome => type == 'INCOME';

  factory FinanceCategory.fromJson(Json json) {
    return FinanceCategory(
      id: json['id'].toString(),
      name: (json['name'] ?? '').toString(),
      type: (json['type'] ?? 'EXPENSE').toString(),
      sortOrder: asInt(json['sort_order']),
      icon: asText(json['icon']),
      color: asText(json['color']),
      keywords: asText(json['keywords']),
      ownerUserId: asText(json['owner_user_id']),
      isActive: json['is_active'] != false,
    );
  }
}

class CategorySuggestion {
  CategorySuggestion({
    required this.confidence,
    required this.source,
    required this.autoApply,
    required this.reason,
    this.categoryId,
    this.categoryName,
  });

  final String? categoryId;
  final String? categoryName;
  final double confidence;
  final String source;
  final bool autoApply;
  final String reason;

  factory CategorySuggestion.fromJson(Json json) {
    return CategorySuggestion(
      categoryId: asText(json['category_id']),
      categoryName: asText(json['category_name']),
      confidence: asDouble(json['confidence']),
      source: (json['source'] ?? 'NONE').toString(),
      autoApply: json['auto_apply'] == true,
      reason: (json['reason'] ?? '').toString(),
    );
  }
}

// ── Giao dịch ───────────────────────────────────────────────────────────────

class Txn {
  Txn({
    required this.id,
    required this.accountId,
    required this.amount,
    required this.type,
    required this.source,
    required this.kind,
    required this.date,
    required this.description,
    this.categoryId,
    this.invoiceId,
    this.note,
    this.categoryWasAuto = false,
    this.categorySource,
    this.createdAt,
  });

  final String id;
  final String accountId;
  final String? categoryId;
  final String? invoiceId;

  /// Số tiền có dấu như trong CSDL: thu dương, chi âm.
  final double amount;

  /// `INCOME` hoặc `EXPENSE`.
  final String type;

  /// `MANUAL`, `OCR`, `IMPORT` hoặc `SYSTEM`.
  final String source;

  /// `NORMAL`, `TRANSFER` hoặc `ADJUSTMENT`.
  final String kind;
  final DateTime date;
  final String description;
  final String? note;
  final bool categoryWasAuto;
  final String? categorySource;
  final DateTime? createdAt;

  bool get isIncome => type == 'INCOME';
  double get absAmount => amount.abs();

  /// Giao dịch chuyển tiền/điều chỉnh số dư do hệ thống sinh ra không được sửa xóa riêng.
  bool get editable => kind == 'NORMAL' && source != 'SYSTEM';

  String get title {
    final text = description.trim();
    if (text.isNotEmpty) return text;
    if (kind == 'TRANSFER') {
      return isIncome ? 'Nhận chuyển tiền' : 'Chuyển tiền đi';
    }
    if (kind == 'ADJUSTMENT') return 'Điều chỉnh số dư';
    return isIncome ? 'Khoản thu' : 'Khoản chi';
  }

  factory Txn.fromJson(Json json) {
    return Txn(
      id: json['id'].toString(),
      accountId: (json['account_id'] ?? '').toString(),
      categoryId: asText(json['category_id']),
      invoiceId: asText(json['invoice_id']),
      amount: asDouble(json['amount']),
      type: (json['type'] ?? 'EXPENSE').toString(),
      source: (json['source'] ?? 'MANUAL').toString(),
      kind: (json['kind'] ?? 'NORMAL').toString(),
      date: parseApiDate(json['transaction_date']) ?? DateTime.now(),
      description: (json['description'] ?? '').toString(),
      note: asText(json['note']),
      categoryWasAuto: json['category_was_auto'] == true,
      categorySource: asText(json['category_source']),
      createdAt: parseApiDateTime(json['created_at']),
    );
  }
}

class TxnPage {
  TxnPage(
      {required this.items,
      required this.total,
      required this.page,
      required this.pageSize});

  final List<Txn> items;
  final int total;
  final int page;
  final int pageSize;

  factory TxnPage.fromJson(Json json) {
    return TxnPage(
      items: asJsonList(json['items']).map(Txn.fromJson).toList(),
      total: asInt(json['total']),
      page: asInt(json['page']),
      pageSize: asInt(json['page_size']),
    );
  }
}

// ── Ngân sách ───────────────────────────────────────────────────────────────

class BudgetProgress {
  BudgetProgress({
    required this.id,
    required this.name,
    required this.amountLimit,
    required this.periodType,
    required this.startDate,
    required this.endDate,
    required this.warningPercent,
    required this.isActive,
    required this.spent,
    required this.remaining,
    required this.usagePercent,
    required this.status,
    this.categoryId,
  });

  final String id;
  final String? categoryId;
  final String name;
  final double amountLimit;
  final String periodType;
  final DateTime startDate;
  final DateTime endDate;
  final double warningPercent;
  final bool isActive;
  final double spent;
  final double remaining;
  final double usagePercent;

  /// `SAFE`, `WARNING` hoặc `EXCEEDED`.
  final String status;

  bool get isExceeded => status == 'EXCEEDED';
  bool get isWarning => status == 'WARNING';

  /// Ngân sách có đang trong kỳ áp dụng tính theo ngày hôm nay hay không.
  bool get isCurrent {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return !today.isBefore(startDate) && !today.isAfter(endDate);
  }

  factory BudgetProgress.fromJson(Json json) {
    final now = DateTime.now();
    return BudgetProgress(
      id: (json['budget_id'] ?? json['id']).toString(),
      categoryId: asText(json['category_id']),
      name: (json['budget_name'] ?? json['name'] ?? '').toString(),
      amountLimit: asDouble(json['amount_limit']),
      periodType: (json['period_type'] ?? 'MONTHLY').toString(),
      startDate: parseApiDate(json['start_date']) ?? now,
      endDate: parseApiDate(json['end_date']) ?? now,
      warningPercent: asDouble(json['warning_percent'] ?? 80),
      isActive: json['is_active'] != false,
      spent: asDouble(json['spent_amount']),
      remaining: asDouble(json['remaining_amount']),
      usagePercent: asDouble(json['usage_percent']),
      status: (json['progress_status'] ?? 'SAFE').toString(),
    );
  }
}

// ── Tổng quan & báo cáo ─────────────────────────────────────────────────────

class RecentTxn {
  RecentTxn({
    required this.id,
    required this.description,
    required this.amount,
    required this.type,
    required this.date,
  });

  final String id;
  final String description;
  final double amount;
  final String type;
  final DateTime? date;

  bool get isIncome => type == 'INCOME';

  factory RecentTxn.fromJson(Json json) {
    return RecentTxn(
      id: json['id'].toString(),
      description: (json['description'] ?? '').toString(),
      amount: asDouble(json['amount']),
      type: (json['type'] ?? 'EXPENSE').toString(),
      date: parseApiDate(json['transaction_date']),
    );
  }
}

class DashboardData {
  DashboardData({
    required this.netWorth,
    required this.incomeThisMonth,
    required this.expenseThisMonth,
    required this.netCashFlow,
    required this.month,
    required this.year,
    required this.recent,
  });

  final double netWorth;
  final double incomeThisMonth;
  final double expenseThisMonth;
  final double netCashFlow;
  final int month;
  final int year;
  final List<RecentTxn> recent;

  factory DashboardData.fromJson(Json json) {
    final period = json['period'] is Map
        ? Map<String, dynamic>.from(json['period'] as Map)
        : <String, dynamic>{};
    final now = DateTime.now();
    return DashboardData(
      netWorth: asDouble(json['net_worth']),
      incomeThisMonth: asDouble(json['income_this_month']),
      expenseThisMonth: asDouble(json['expense_this_month']),
      netCashFlow: asDouble(json['net_cash_flow']),
      month: period['month'] == null ? now.month : asInt(period['month']),
      year: period['year'] == null ? now.year : asInt(period['year']),
      recent: asJsonList(json['recent_transactions'])
          .map(RecentTxn.fromJson)
          .toList(),
    );
  }
}

class CategoryAmount {
  CategoryAmount(this.name, this.amount);

  final String name;
  final double amount;
}

class TrendPoint {
  TrendPoint(
      {required this.label, required this.income, required this.expense});

  final String label;
  final double income;
  final double expense;
}

class AnalyticsData {
  AnalyticsData({
    required this.start,
    required this.end,
    required this.income,
    required this.expense,
    required this.net,
    required this.previousIncome,
    required this.previousExpense,
    required this.byCategory,
    required this.trend,
  });

  final DateTime? start;
  final DateTime? end;
  final double income;
  final double expense;
  final double net;
  final double previousIncome;
  final double previousExpense;

  /// Chi tiêu theo danh mục, sắp xếp giảm dần.
  final List<CategoryAmount> byCategory;

  /// Xu hướng thu/chi tối đa 6 tháng gần nhất, từ cũ tới mới.
  final List<TrendPoint> trend;

  factory AnalyticsData.fromJson(Json json) {
    Json section(String key) {
      final value = json[key];
      return value is Map
          ? Map<String, dynamic>.from(value)
          : <String, dynamic>{};
    }

    final period = section('period');
    final current = section('summary');
    final previous = section('previous_summary');

    final categories = <CategoryAmount>[];
    section('expense_by_category').forEach((name, amount) {
      final value = asDouble(amount);
      if (value > 0) categories.add(CategoryAmount(name, value));
    });
    categories.sort((a, b) => b.amount.compareTo(a.amount));

    final trend = <TrendPoint>[];
    for (final row in asJsonList(json['trend'])) {
      // API trả "Tháng 9/2026"; rút gọn thành "T9" cho trục biểu đồ.
      final raw = (row['month'] ?? '').toString();
      final match = RegExp(r'(\d{1,2})/(\d{4})').firstMatch(raw);
      trend.add(TrendPoint(
        label: match == null ? raw : 'T${match.group(1)}',
        income: asDouble(row['income']),
        expense: asDouble(row['expense']),
      ));
    }

    return AnalyticsData(
      start: parseApiDate(period['start_date']),
      end: parseApiDate(period['end_date']),
      income: asDouble(current['income']),
      expense: asDouble(current['expense']),
      net: asDouble(current['net']),
      previousIncome: asDouble(previous['income']),
      previousExpense: asDouble(previous['expense']),
      byCategory: categories,
      trend: trend,
    );
  }
}

// ── Hóa đơn & OCR ───────────────────────────────────────────────────────────

class InvoiceLine {
  InvoiceLine({
    required this.name,
    this.unit,
    this.quantity,
    this.unitPrice,
    this.taxAmount,
    this.lineTotal,
  });

  String name;
  String? unit;
  double? quantity;
  double? unitPrice;
  double? taxAmount;
  double? lineTotal;

  factory InvoiceLine.fromJson(Json json) {
    double? optional(dynamic value) => value == null ? null : asDouble(value);
    return InvoiceLine(
      name: (json['name'] ?? '').toString(),
      unit: asText(json['unit']),
      quantity: optional(json['quantity']),
      unitPrice: optional(json['unit_price']),
      taxAmount: optional(json['tax_amount']),
      lineTotal: optional(json['line_total']),
    );
  }

  /// Dữ liệu gửi lên khi người dùng đã kiểm tra/chỉnh sửa dòng hàng.
  Json toJson() {
    final json = <String, dynamic>{'name': name.trim()};
    final unitText = unit?.trim() ?? '';
    if (unitText.isNotEmpty) json['unit'] = unitText;
    if (quantity != null) json['quantity'] = _decimal(quantity!, 4);
    if (unitPrice != null) json['unit_price'] = _decimal(unitPrice!, 2);
    if (taxAmount != null) json['tax_amount'] = _decimal(taxAmount!, 2);
    if (lineTotal != null) json['line_total'] = _decimal(lineTotal!, 2);
    return json;
  }

  static String _decimal(double value, int digits) {
    final safe = value.isFinite && value >= 0 ? value : 0.0;
    return safe.toStringAsFixed(digits);
  }
}

class InvoiceSummary {
  InvoiceSummary({
    required this.id,
    required this.status,
    required this.source,
    this.merchantName,
    this.invoiceDate,
    this.totalAmount,
    this.originalFilename,
    this.mimeType,
    this.ocrConfidence,
    this.createdAt,
    this.confirmedAt,
    this.revision = 1,
    this.deletedAt,
    this.outcome,
    this.duplicateLevel = 'NONE',
    this.duplicateOfInvoiceId,
    this.transactionId,
  });

  final String id;

  /// `UPLOADED`, `PROCESSING`, `REVIEW_REQUIRED`, `CONFIRMED` hoặc `FAILED`.
  final String status;
  final String source;
  final String? merchantName;
  final DateTime? invoiceDate;
  final double? totalAmount;
  final String? originalFilename;
  final String? mimeType;
  final double? ocrConfidence;
  final DateTime? createdAt;
  final DateTime? confirmedAt;
  final int revision;
  final DateTime? deletedAt;
  final String? outcome;
  final String duplicateLevel;
  final String? duplicateOfInvoiceId;
  final String? transactionId;
  bool get hidden => deletedAt != null;

  bool get isImage => (mimeType ?? '').startsWith('image/');
  bool get isXml => mimeType == 'application/xml';

  String get displayName {
    final merchant = (merchantName ?? '').trim();
    if (merchant.isNotEmpty) return merchant;
    final file = (originalFilename ?? '').trim();
    return file.isNotEmpty ? file : 'Hóa đơn';
  }

  factory InvoiceSummary.fromJson(Json json) {
    return InvoiceSummary(
      id: json['id'].toString(),
      status: (json['status'] ?? 'UPLOADED').toString(),
      source: (json['source'] ?? 'UPLOAD').toString(),
      merchantName: asText(json['merchant_name']),
      invoiceDate: parseApiDate(json['invoice_date']),
      totalAmount:
          json['total_amount'] == null ? null : asDouble(json['total_amount']),
      originalFilename: asText(json['original_filename'] ?? json['filename']),
      mimeType: asText(json['mime_type']),
      ocrConfidence: json['ocr_confidence'] == null
          ? null
          : asDouble(json['ocr_confidence']),
      createdAt: parseApiDateTime(json['created_at']),
      confirmedAt: parseApiDateTime(json['confirmed_at']),
      revision: asInt(json['revision'] ?? 1),
      deletedAt: parseApiDateTime(json['deleted_at']),
      outcome: asText(json['outcome']),
      duplicateLevel: asText(json['duplicate_level']) ?? 'NONE',
      duplicateOfInvoiceId: asText(json['duplicate_of_invoice_id']),
      transactionId: asText(json['transaction_id']),
    );
  }
}

class InvoiceDetail {
  InvoiceDetail({
    required this.summary,
    required this.items,
    required this.isDuplicate,
    this.accountId,
    this.categoryId,
    this.merchantAddress,
    this.merchantTaxCode,
    this.invoiceNumber,
    this.invoiceSymbol,
    this.invoiceTime,
    this.vatRate,
    this.paymentMethod,
    this.subtotalAmount,
    this.taxAmount,
    this.note,
    this.duplicateReason,
  });

  final InvoiceSummary summary;
  final List<InvoiceLine> items;
  final bool isDuplicate;
  final String? duplicateReason;
  final String? accountId;
  final String? categoryId;
  final String? merchantAddress;
  final String? merchantTaxCode;
  final String? invoiceNumber;
  final String? invoiceSymbol;
  final String? invoiceTime;
  final String? vatRate;
  final String? paymentMethod;
  final double? subtotalAmount;
  final double? taxAmount;
  final String? note;

  factory InvoiceDetail.fromJson(Json json) {
    return InvoiceDetail(
      summary: InvoiceSummary.fromJson(json),
      items: asJsonList(json['items']).map(InvoiceLine.fromJson).toList(),
      isDuplicate: json['is_duplicate'] == true,
      duplicateReason: asText(json['duplicate_reason']),
      accountId: asText(json['account_id']),
      categoryId: asText(json['category_id']),
      merchantAddress: asText(json['merchant_address']),
      merchantTaxCode: asText(json['merchant_tax_code']),
      invoiceNumber: asText(json['invoice_number']),
      invoiceSymbol: asText(json['invoice_symbol']),
      invoiceTime: asText(json['invoice_time']),
      vatRate: asText(json['vat_rate']),
      paymentMethod: asText(json['payment_method']),
      subtotalAmount: json['subtotal_amount'] == null
          ? null
          : asDouble(json['subtotal_amount']),
      taxAmount:
          json['tax_amount'] == null ? null : asDouble(json['tax_amount']),
      note: asText(json['note']),
    );
  }
}

// ── Thông báo ───────────────────────────────────────────────────────────────

class AppNotification {
  AppNotification({
    required this.id,
    required this.type,
    required this.severity,
    required this.title,
    required this.body,
    required this.origin,
    required this.isRead,
    this.entityType,
    this.entityId,
    this.createdAt,
  });

  final String id;

  /// Mã sự kiện, ví dụ `TRANSACTION_CREATED`, `BUDGET_WARNING`.
  final String type;

  /// `INFO`, `SUCCESS`, `WARNING` hoặc `DANGER`.
  final String severity;
  final String title;
  final String body;

  /// Nơi phát sinh thao tác: `WEB`, `MOBILE` hoặc `SYSTEM`.
  final String origin;
  bool isRead;
  final String? entityType;
  final String? entityId;
  final DateTime? createdAt;

  bool get fromThisApp => origin == 'MOBILE';
  bool get isAlert => severity == 'WARNING' || severity == 'DANGER';

  factory AppNotification.fromJson(Json json) {
    return AppNotification(
      id: json['id'].toString(),
      type: (json['kind'] ?? json['type'] ?? 'INFO').toString(),
      severity: (json['severity'] ?? 'INFO').toString(),
      title: (json['title'] ?? 'Thông báo').toString(),
      body: (json['message'] ?? json['body'] ?? '').toString(),
      origin: (json['origin'] ?? 'SYSTEM').toString(),
      isRead: json['read_at'] != null || json['is_read'] == true,
      entityType:
          asText(json['source_type'] ?? json['entity_type'])?.toLowerCase(),
      entityId: asText(json['source_id'] ?? json['entity_id']),
      createdAt: parseApiDateTime(json['created_at']),
    );
  }
}

// ── Quản trị ────────────────────────────────────────────────────────────────

class AdminOverview {
  AdminOverview({
    required this.usersTotal,
    required this.usersActive,
    required this.usersBanned,
    required this.invoicesTotal,
    required this.invoicesCompleted,
    required this.ocrSuccessRate,
    required this.totalTransactions,
  });

  final int usersTotal;
  final int usersActive;
  final int usersBanned;
  final int invoicesTotal;
  final int invoicesCompleted;
  final double ocrSuccessRate;
  final int totalTransactions;

  factory AdminOverview.fromJson(Json json) {
    Json section(String key) {
      final value = json[key];
      return value is Map
          ? Map<String, dynamic>.from(value)
          : <String, dynamic>{};
    }

    final users = section('users');
    final invoices = section('invoices');
    return AdminOverview(
      usersTotal: asInt(users['total']),
      usersActive: asInt(users['active']),
      usersBanned: asInt(users['banned']),
      invoicesTotal: asInt(invoices['total']),
      invoicesCompleted: asInt(invoices['completed']),
      ocrSuccessRate: asDouble(invoices['ocr_success_rate']),
      totalTransactions: asInt(json['total_transactions']),
    );
  }
}

class AdminUser {
  AdminUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    required this.isActive,
    required this.isDeleted,
    required this.isSystemAccount,
    this.createdAt,
    this.lastLoginAt,
  });

  final String id;
  final String email;
  final String fullName;
  final String role;
  final bool isActive;
  final bool isDeleted;
  final bool isSystemAccount;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  bool get isAdmin => role.toUpperCase() == 'ADMIN';

  factory AdminUser.fromJson(Json json) {
    return AdminUser(
      id: json['id'].toString(),
      email: (json['email'] ?? '').toString(),
      fullName: (json['full_name'] ?? '').toString(),
      role: (json['role'] ?? 'USER').toString(),
      isActive: json['is_active'] != false,
      isDeleted: json['is_deleted'] == true,
      isSystemAccount: json['is_system_account'] == true,
      createdAt: parseApiDateTime(json['created_at']),
      lastLoginAt: parseApiDateTime(json['last_login_at']),
    );
  }
}
