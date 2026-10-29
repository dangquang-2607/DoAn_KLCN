import 'package:flutter/material.dart';

import '../core/category_style.dart';
import '../core/formatters.dart';
import '../core/theme.dart';
import '../models/models.dart';
import 'common.dart';

/// Đối chiếu khoản đang ghi sổ với các khoản thanh toán ví cùng ngày và số tiền
/// (lỗi 409 `PAYMENT_RECORD_REVIEW_REQUIRED`).
///
/// Trả id khoản thanh toán được chọn để gắn vào, chuỗi rỗng nếu người dùng xác
/// nhận đây là khoản khác, `null` nếu hủy. Đặt [allowLink] = false khi luồng
/// chỉ cho phép xác nhận khoản khác (giống bản web ở phần ghi sổ hóa đơn).
Future<String?> reviewPaymentCandidates(
  BuildContext context,
  List<PaymentCandidate> candidates, {
  bool allowLink = true,
}) {
  return showPickerSheet<String>(
    context,
    title: 'Có khoản thanh toán ví trùng ngày và số tiền',
    children: (sheetContext) => [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
        child: Text(
          allowLink
              ? 'Gắn vào khoản đã thanh toán để không ghi chi hai lần, hoặc xác nhận đây là khoản khác.'
              : 'Kiểm tra các khoản đã thanh toán dưới đây trước khi ghi sổ khoản mới.',
          style: const TextStyle(fontSize: 13.5, color: AppColors.muted),
        ),
      ),
      for (final candidate in candidates)
        SheetOption(
          title: '${candidate.merchantName} · ${candidate.billReference}',
          subtitle:
              'Đã trả ${formatMoney(candidate.paidAmount)} · ${formatDateTime(candidate.createdAt?.toLocal())}',
          leading: const IconBadge(
              icon: Icons.receipt_long, color: AppColors.blue, size: 40),
          trailing: allowLink
              ? const Text('Gắn vào',
                  style: TextStyle(
                      color: AppColors.blue, fontWeight: FontWeight.w700))
              : null,
          onTap: allowLink
              ? () => Navigator.of(sheetContext).pop(candidate.walletEntryId)
              : () {},
        ),
      SheetOption(
        title: 'Đây là khoản khác',
        subtitle: 'Tôi đã đối chiếu và vẫn muốn ghi một khoản riêng',
        leading: const IconBadge(
            icon: Icons.add_circle_outline, color: AppColors.amber, size: 40),
        onTap: () => Navigator.of(sheetContext).pop(''),
      ),
    ],
  );
}

/// Chọn một ví từ danh sách; trả `null` nếu người dùng đóng bảng chọn.
Future<Wallet?> pickWallet(
  BuildContext context, {
  required List<Wallet> wallets,
  String? selectedId,
  String title = 'Chọn ví',
  String? excludeId,
}) {
  final visible = wallets.where((wallet) => wallet.id != excludeId).toList();
  return showPickerSheet<Wallet>(
    context,
    title: title,
    children: (sheetContext) {
      if (visible.isEmpty) {
        return const [
          Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Chưa có ví nào. Hãy tạo ví trong mục "Ví & tài khoản" trước.',
              style: TextStyle(color: AppColors.muted),
            ),
          ),
        ];
      }
      return [
        for (final wallet in visible)
          SheetOption(
            title: wallet.name,
            subtitle: '${walletTypeLabel(wallet.accountType)} · ${formatMoney(wallet.balance, keepSign: true)}',
            selected: wallet.id == selectedId,
            leading: IconBadge(
              icon: walletIcon(wallet.accountType),
              color: walletColor(wallet.accountType),
              size: 40,
            ),
            onTap: () => Navigator.of(sheetContext).pop(wallet),
          ),
      ];
    },
  );
}

/// Kết quả chọn danh mục: phân biệt "đóng bảng chọn" với "chọn Không phân loại".
class CategoryChoice {
  const CategoryChoice(this.category);

  /// `null` nghĩa là người dùng chủ động bỏ phân loại.
  final FinanceCategory? category;
}

Future<CategoryChoice?> pickCategory(
  BuildContext context, {
  required List<FinanceCategory> categories,
  String? selectedId,
  bool allowNone = true,
  String title = 'Chọn danh mục',
  String noneLabel = 'Không phân loại',
  String noneHint = 'Để hệ thống tự gợi ý theo diễn giải',
}) {
  return showPickerSheet<CategoryChoice>(
    context,
    title: title,
    children: (sheetContext) => [
      if (allowNone)
        SheetOption(
          title: noneLabel,
          subtitle: noneHint,
          selected: selectedId == null,
          leading: const IconBadge(icon: Icons.auto_awesome, color: AppColors.muted, size: 40),
          onTap: () => Navigator.of(sheetContext).pop(const CategoryChoice(null)),
        ),
      for (final category in categories)
        SheetOption(
          title: category.name,
          subtitle: category.isSystem ? 'Danh mục hệ thống' : 'Danh mục của bạn',
          selected: category.id == selectedId,
          leading: CategoryAvatar(icon: category.icon, color: category.color, name: category.name, size: 40),
          onTap: () => Navigator.of(sheetContext).pop(CategoryChoice(category)),
        ),
      if (categories.isEmpty && !allowNone)
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text('Chưa có danh mục phù hợp.', style: TextStyle(color: AppColors.muted)),
        ),
    ],
  );
}

/// Chọn một giá trị từ danh sách cặp (giá trị, nhãn).
Future<T?> pickOption<T>(
  BuildContext context, {
  required String title,
  required List<MapEntry<T, String>> options,
  T? selected,
}) {
  return showPickerSheet<T>(
    context,
    title: title,
    children: (sheetContext) => [
      for (final option in options)
        SheetOption(
          title: option.value,
          selected: option.key == selected,
          onTap: () => Navigator.of(sheetContext).pop(option.key),
        ),
    ],
  );
}

/// Mở lịch chọn ngày với giao diện tiếng Việt.
Future<DateTime?> pickDate(
  BuildContext context, {
  required DateTime initial,
  DateTime? first,
  DateTime? last,
}) {
  final firstDate = first ?? DateTime(2000);
  final lastDate = last ?? DateTime(DateTime.now().year + 10, 12, 31);
  var initialDate = initial;
  if (initialDate.isBefore(firstDate)) initialDate = firstDate;
  if (initialDate.isAfter(lastDate)) initialDate = lastDate;
  return showDatePicker(
    context: context,
    initialDate: initialDate,
    firstDate: firstDate,
    lastDate: lastDate,
    helpText: 'Chọn ngày',
    cancelText: 'Hủy',
    confirmText: 'Chọn',
  );
}
