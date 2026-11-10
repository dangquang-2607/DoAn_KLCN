import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';

class TransactionDetailDialog extends StatefulWidget {
  const TransactionDetailDialog({super.key, required this.txn});

  final Txn txn;

  @override
  State<TransactionDetailDialog> createState() =>
      _TransactionDetailDialogState();
}

class _TransactionDetailDialogState extends State<TransactionDetailDialog> {
  Txn get _txn => widget.txn;
  Json? _payment;
  String? _loadError;
  String? _saveError;
  late String? _categoryId = _txn.categoryId;
  late bool _included = _txn.includeInReports;
  bool _saving = false;

  bool get _changed =>
      _categoryId != _txn.categoryId || _included != _txn.includeInReports;

  @override
  void initState() {
    super.initState();
    if (_txn.fromWalletPayment) _load();
  }

  Future<void> _load() async {
    if (_loadError != null) setState(() => _loadError = null);
    try {
      final data = context.read<AppData>();
      final result =
          await data.finance.api.get('/bookkeeping/${_txn.id}/payment-detail');
      if (mounted) {
        setState(() => _payment = Map<String, dynamic>.from(result as Map));
      }
    } catch (e) {
      if (mounted) setState(() => _loadError = errorText(e));
    }
  }

  Future<void> _pickCategory() async {
    final data = context.read<AppData>();
    if (!data.loaded) {
      try {
        await data.refreshLookups();
      } catch (e) {
        if (mounted) showSnack(errorText(e), error: true);
        return;
      }
    }
    if (!mounted || _saving) return;
    final choice = await pickCategory(context,
        categories: data.categoriesOf(_txn.type),
        selectedId: _categoryId,
        noneLabel: 'Chưa phân loại',
        noneHint: 'Gỡ danh mục khỏi giao dịch');
    if (choice != null && mounted) {
      setState(() => _categoryId = choice.category?.id);
    }
  }

  Future<void> _save() async {
    if (_saving || !_changed) return;
    final data = context.read<AppData>();
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      await data.finance.updatePaymentRecord(_txn.id,
          categoryId: _categoryId,
          setCategory: _categoryId != _txn.categoryId,
          includeInReports:
              _included != _txn.includeInReports ? _included : null);
      await data.markChanged();
      if (!mounted) return;
      Navigator.of(context).pop();
      showSnack('Đã cập nhật giao dịch ví.');
    } catch (e) {
      if (mounted) {
        setState(() {
          _saveError = errorText(e);
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppData>();
    final wallet = _txn.fromWalletPayment;
    final payment = _payment;
    final category = data.categoryById(_categoryId);
    final canEdit = _txn.editable && !wallet;
    final hasAction = wallet || canEdit;
    return PopScope(
      canPop: !_saving,
      child: Dialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(
            horizontal: Space.sm, vertical: Space.md),
        constraints: const BoxConstraints(maxWidth: 520),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Space.md, Space.xs, Space.xs, Space.xs),
              child: Row(children: [
                const Expanded(
                    child:
                        Text('Xem chi tiết giao dịch', style: AppText.section)),
                IconButton(
                  tooltip: 'Đóng chi tiết',
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ]),
            ),
            const Divider(height: 1, color: AppColors.line),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                    Space.md, Space.md, Space.md, Space.sm),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (wallet && payment == null)
                        if (_loadError == null)
                          const LoadingView()
                        else
                          ErrorView(message: _loadError!, onRetry: _load)
                      else ...[
                        _summary(payment),
                        const SizedBox(height: Space.lg),
                        if (payment != null)
                          ..._paymentRows(payment)
                        else ...[
                          _DetailRow('Ngày giao dịch',
                              value: formatDate(_txn.date)),
                          _DetailRow('Mã giao dịch', value: _txn.id),
                          _DetailRow('Diễn giải',
                              value: asText(_txn.description) ?? '—'),
                        ],
                        _DetailRow(payment == null ? 'Ghi chú' : 'Nội dung',
                            value: asText(payment?['note'] ?? _txn.note) ??
                                'Không có nội dung'),
                        if (wallet) ...[
                          _DetailRow('Danh mục',
                              child: OutlinedButton(
                                onPressed: _saving ? null : _pickCategory,
                                style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: Space.xs)),
                                child: Row(children: [
                                  Expanded(
                                      child: Text(category?.name ??
                                          (_categoryId == null
                                              ? 'Chưa phân loại'
                                              : 'Danh mục hiện tại'))),
                                  const Icon(Icons.unfold_more_rounded,
                                      size: 16),
                                ]),
                              )),
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Tính vào thu chi',
                                style: TextStyle(color: AppColors.muted)),
                            value: _included,
                            onChanged: _saving
                                ? null
                                : (value) => setState(() => _included = value),
                          ),
                        ] else
                          _DetailRow('Danh mục',
                              value: category?.name ?? 'Chưa phân loại',
                              last: true),
                        if (_saveError != null)
                          InfoBanner(
                              message: _saveError!, color: AppColors.danger),
                      ],
                    ]),
              ),
            ),
            const Divider(height: 1, color: AppColors.line),
            Padding(
              padding: const EdgeInsets.all(Space.sm),
              child: Row(children: [
                Expanded(
                    child: OutlinedButton(
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                  child: const Text('Đóng'),
                )),
                if (hasAction) ...[
                  const SizedBox(width: Space.xs),
                  Expanded(
                      child: FilledButton(
                    onPressed: wallet
                        ? (payment != null && _changed && !_saving
                            ? _save
                            : null)
                        : () => Navigator.of(context).pop(true),
                    child: Text(
                        wallet
                            ? (_saving ? 'Đang lưu…' : 'Lưu thay đổi')
                            : 'Chỉnh sửa',
                        textAlign: TextAlign.center),
                  )),
                ],
              ]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summary(Json? payment) {
    final amount =
        editMoney(payment?['amount'] ?? _txn.raw['amount'] ?? _txn.absAmount);
    final source = switch (_txn.source) {
      'MANUAL' => 'Nhập thủ công',
      'OCR' => 'Quét hóa đơn',
      _ => _txn.sourceLabel,
    };
    final label = payment == null
        ? '${_txn.isIncome ? 'Khoản thu' : 'Khoản chi'} · $source'
        : [asText(payment['label']), asText(payment['wallet_name'])]
            .nonNulls
            .join(' · ');
    return Column(children: [
      if (payment != null) ...[
        StatusChip('Thành công',
            color: Color.lerp(AppColors.success, AppColors.ink, 0.27)!,
            background: AppColors.successSoft),
        const SizedBox(height: Space.xs),
      ],
      Text('${_txn.isIncome ? '+' : '−'}$amount ₫',
          style: AppText.heroMetric, textAlign: TextAlign.center),
      const SizedBox(height: Space.xs),
      Text(label,
          style: const TextStyle(color: AppColors.muted),
          textAlign: TextAlign.center),
    ]);
  }

  List<Widget> _paymentRows(Json payment) {
    final counterpartyLabel = switch (payment['kind']) {
      'TOPUP' || 'WITHDRAW' => 'Ngân hàng',
      _ when payment['is_internal'] == true => 'Ví đối ứng',
      _ => _txn.isIncome ? 'Người gửi' : 'Người nhận',
    };
    return [
      if (payment['kind'] == 'PAYMENT') ...[
        _DetailRow('Nhà cung cấp',
            value: asText(payment['merchant_name']) ?? '—'),
        _DetailRow('Mã hóa đơn',
            value: asText(payment['bill_reference']) ?? '—'),
      ] else
        _DetailRow(counterpartyLabel,
            value: asText(payment['counterparty']) ?? '—'),
      _DetailRow('Thời gian',
          value: formatDateTime(parseApiDateTime(payment['created_at']))),
      _DetailRow('Mã giao dịch',
          value: asText(payment['operation_id']) ?? _txn.id),
    ];
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, {this.value, this.child, this.last = false});

  final String label;
  final String? value;
  final Widget? child;
  final bool last;

  @override
  Widget build(BuildContext context) => Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Space.sm),
          child: Row(children: [
            Expanded(
                flex: 2,
                child: Text(label,
                    style: const TextStyle(color: AppColors.muted))),
            const SizedBox(width: Space.xs),
            Expanded(
                flex: 3,
                child:
                    child ?? SelectableText(value!, textAlign: TextAlign.end)),
          ]),
        ),
        if (!last) const Divider(height: 1, color: AppColors.line),
      ]);
}
