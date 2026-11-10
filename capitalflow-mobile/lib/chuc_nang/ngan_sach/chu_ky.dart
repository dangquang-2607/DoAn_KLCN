import '../../ha_tang/api.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../du_lieu/mo_hinh.dart';

/// All dates in the budget contract are Vietnam calendar dates, not instants.
DateTime budgetToday([DateTime? instant]) {
  final vn = (instant ?? DateTime.now()).toUtc().add(const Duration(hours: 7));
  return DateTime(vn.year, vn.month, vn.day);
}

class BudgetDraft {
  BudgetDraft(
      {required this.name,
      required this.amount,
      required this.warning,
      required this.period,
      required this.start,
      required this.end,
      this.categoryId,
      this.amountExact,
      this.recurrenceEnd,
      this.autoRenew,
      this.effectiveFrom = 'NEXT'});
  final String name, period, effectiveFrom;
  final String? categoryId;
  final String? amountExact;
  final num amount, warning;
  final DateTime start, end;
  final DateTime? recurrenceEnd;
  final bool? autoRenew;

  Json payload({BudgetProgress? existing, DateTime? today}) {
    final recurring = existing?.isRecurring ?? (period != 'CUSTOM');
    if (!amount.isFinite ||
        amount <= 0 ||
        !warning.isFinite ||
        warning <= 0 ||
        warning > 100) {
      throw ArgumentError(
          'Hạn mức phải lớn hơn 0, ngưỡng cảnh báo từ 1 đến 100.');
    }
    if (name.trim().length > 150 || (existing != null && name.trim().isEmpty)) {
      throw ArgumentError('Tên ngân sách cần từ 1 đến 150 ký tự.');
    }
    if (!['WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].contains(period) ||
        !['NEXT', 'CURRENT'].contains(effectiveFrom)) {
      throw ArgumentError('Kỳ không hợp lệ.');
    }
    if (existing?.isCompleted == true) {
      throw StateError('Lịch sử chỉ có thể xem.');
    }
    final day = today ?? budgetToday();
    if (existing?.isRecurring == true &&
        existing!.recurrenceEndDate != null &&
        existing.recurrenceEndDate!.isBefore(day)) {
      throw StateError('Ngân sách đã kết thúc.');
    }
    if (recurring &&
        (period == 'CUSTOM' ||
            (recurrenceEnd != null &&
                (recurrenceEnd!.isBefore(start) ||
                    (existing != null && recurrenceEnd!.isBefore(day)))))) {
      throw ArgumentError('Ngày kết thúc áp dụng không hợp lệ.');
    }
    if (!recurring && end.isBefore(start)) {
      throw ArgumentError('Ngày kết thúc phải từ ngày bắt đầu.');
    }
    if (existing?.isRecurring == true) {
      // Compare against the selected effective snapshot. Never send immutable fields.
      final current = effectiveFrom == 'CURRENT';
      final snapshot = existing!;
      final previousAmount = current
          ? snapshot.raw['amount_limit'] ?? snapshot.amountLimit
          : snapshot.raw['configured_amount_limit'] ??
              snapshot.configuredAmountLimit ??
              snapshot.raw['amount_limit'] ??
              snapshot.amountLimit;
      final changed = amountExact == null
          ? amount !=
              (current
                  ? snapshot.amountLimit
                  : snapshot.configuredAmountLimit ?? snapshot.amountLimit)
          : editMoney(amountExact) != editMoney(previousAmount);
      return {
        if (name.trim() !=
            (current
                ? snapshot.name
                : snapshot.configuredName ?? existing.name))
          'name': name.trim(),
        if (changed) 'amount_limit': amountExact ?? amount,
        if (warning !=
            (current
                ? existing.warningPercent
                : existing.configuredWarningPercent ?? existing.warningPercent))
          'warning_percent': warning,
        if (autoRenew != null && autoRenew != snapshot.autoRenews)
          'auto_renew': autoRenew,
        'effective_from': effectiveFrom,
      };
    }
    return {
      'name': name.trim().isEmpty ? null : name.trim(),
      'amount_limit': amountExact ?? amount,
      'warning_percent': warning,
      'currency': 'VND',
      'period_type': existing?.periodType ?? period,
      'start_date': isoDate(start),
      'end_date': recurring ? null : isoDate(end),
      if (existing == null) ...{
        'category_id': categoryId,
        'is_recurring': recurring,
      },
    };
  }
}

/// Separate repository avoids changing shared repositories.dart/AppData wiring.
class BudgetLifecycleRepository {
  BudgetLifecycleRepository(this.api);
  final ApiClient api;
  Future<List<BudgetProgress>> history(int year) async {
    if (year < 1900 || year > 9999) {
      throw ArgumentError.value(year);
    }
    return asJsonList(await api.get('/budgets/history', query: {'year': year}))
        .map(BudgetProgress.fromJson)
        .toList();
  }

  Future<void> save(BudgetDraft draft, {BudgetProgress? existing}) async {
    final body = draft.payload(existing: existing);
    if (existing == null) {
      await api.post('/budgets', body: body);
    } else {
      await api.patch('/budgets/${existing.id}', body: body);
    }
  }
}
