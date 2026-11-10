import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../ha_tang/api.dart';
import '../../du_lieu/mo_hinh.dart';
import '../../du_lieu/trang_thai.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../../dung_chung/giao_dien/bo_chon.dart';
import 'quet_qr.dart';

class BillPaymentScreen extends StatefulWidget {
  const BillPaymentScreen({super.key, this.walletId, this.initialPayload});
  final String? walletId, initialPayload;
  @override
  State<BillPaymentScreen> createState() => _BillPaymentScreenState();
}

class _BillPaymentScreenState extends State<BillPaymentScreen> {
  final _payload = TextEditingController();
  String? _walletId, _recordId, _categoryId, _error;
  Json? _bill, _receipt;
  bool _busy = false, _uncertain = false;
  @override
  void initState() {
    super.initState();
    _walletId = widget.walletId;
    _payload.text = widget.initialPayload ?? '';
    if (_payload.text.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _resolve());
    }
  }

  @override
  void dispose() {
    _payload.dispose();
    super.dispose();
  }

  Future<void> _resolve() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _bill = null;
      _recordId = null;
    });
    try {
      final data = context.read<AppData>();
      final result = await data.finance.api.post('/wallets/bills/resolve',
          body: {'qr_payload': _payload.text.trim()});
      if (!mounted) return;
      setState(() {
        _bill = Map<String, dynamic>.from(result as Map);
        _walletId ??= data.wallets.firstOrNull?.id;
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _chooseRecord() async {
    final data = context.read<AppData>();
    setState(() => _busy = true);
    try {
      final raw = await data.finance.api
          .get('/bookkeeping/export-data', query: {'type': 'EXPENSE'});
      final rows = asJsonList(raw)
          .map(Txn.fromJson)
          .where((x) =>
              !x.fromWalletPayment &&
              editMoney(x.raw['amount']) == editMoney(_bill!['amount']))
          .toList();
      if (!mounted) return;
      final id = await pickOption<String>(context,
          title: 'Gắn khoản chi đã ghi trước đó',
          options: [
            const MapEntry('', 'Tạo khoản ghi nhận mới'),
            ...rows.map(
                (x) => MapEntry(x.id, '${x.title} · ${formatDate(x.date)}'))
          ],
          selected: _recordId ?? '');
      if (mounted && id != null) {
        setState(() => _recordId = id.isEmpty ? null : id);
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay() async {
    if (_busy || _bill == null || _walletId == null) return;
    final data = context.read<AppData>();
    if (!_uncertain &&
        !await confirmDialog(context,
            title: 'Xác nhận thanh toán',
            message:
                'Trả ${editMoney(_bill!['amount'])} ₫ cho ${_bill!['merchant_name']} từ ví đã chọn?',
            confirmLabel: 'Thanh toán')) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_uncertain) {
        final status = Map<String, dynamic>.from(await data.finance.api.post(
            '/wallets/bills/payment-status',
            body: {'qr_payload': _bill!['qr_payload']}) as Map);
        if (status['status'] == 'SUCCEEDED') {
          if (mounted) {
            setState(() {
              _receipt = status;
              _uncertain = false;
            });
          }
          await data.markChanged();
          return;
        }
      }
      final receipt = await data.finance.payBill(
          walletId: _walletId!,
          qrPayload: _bill!['qr_payload'] as String,
          bookkeepingId: _recordId,
          categoryId: _categoryId);
      if (mounted) {
        setState(() {
          _receipt = receipt;
          _uncertain = false;
        });
      }
      await data.markChanged();
    } catch (e) {
      if (mounted) {
        setState(() {
          _uncertain = e is! ApiException || e.uncertain;
          _error = errorText(e);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<AppData>();
    return Scaffold(
        appBar: appBar(context, 'Thanh toán hóa đơn'),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          const InfoBanner(
              message:
                  'Quét QR hóa đơn mô phỏng CapitalFlow. Kiểm tra người bán, mặt hàng và số tiền trước khi thanh toán.'),
          if (_error != null)
            Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error))),
          if (_receipt != null) ...[
            const SectionHeader('Đã thanh toán'),
            Text('${_bill?['merchant_name']} · ${_bill?['bill_reference']}'),
            Text(
                '${editMoney(_receipt!['paid_amount'] ?? _bill?['amount'])} ₫'),
            SelectableText(
                'Mã giao dịch: ${_receipt!['operation_id'] ?? _receipt!['entry_id'] ?? ''}'),
            Text('Thời điểm: ${_receipt!['paid_at'] ?? ''}'),
            const SizedBox(height: 16),
            PrimaryButton(
                label: 'Hoàn tất',
                onPressed: () => Navigator.pop(context, true)),
          ] else ...[
            TextField(
                controller: _payload,
                onChanged: (_) {
                  if (_bill != null) {
                    setState(() {
                      _bill = null;
                      _recordId = null;
                    });
                  }
                },
                enabled: !_busy && !_uncertain,
                maxLines: 3,
                decoration: fieldDecoration('Nội dung QR hóa đơn')),
            Wrap(spacing: 12, children: [
              TextButton.icon(
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Quét mã'),
                  onPressed: _busy || _uncertain
                      ? null
                      : () async {
                          final value = await pushScreen<String>(
                              context, const QrScanScreen(pickOnly: true));
                          if (value != null && mounted) {
                            _payload.text = value;
                            await _resolve();
                          }
                        }),
              TextButton(
                  onPressed: _busy || _uncertain ? null : _resolve,
                  child: const Text('Kiểm tra hóa đơn')),
            ]),
            if (_bill != null) ...[
              SectionHeader('${_bill!['merchant_name']}'),
              SelectableText('${_bill!['bill_reference']}'),
              for (final item in asJsonList(_bill!['items']))
                ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${item['name']}'),
                    subtitle: Text(
                        '${item['quantity']} × ${editMoney(item['unit_price'])} ₫')),
              Text('Tổng thanh toán: ${editMoney(_bill!['amount'])} ₫'),
              const SizedBox(height: 16),
              PickerField(
                  label: 'Ví thanh toán',
                  value: data.walletById(_walletId)?.name,
                  onTap: _busy || _uncertain
                      ? null
                      : () async {
                          final wallet = await pickWallet(context,
                              wallets: data.wallets, selectedId: _walletId);
                          if (wallet != null && mounted) {
                            setState(() => _walletId = wallet.id);
                          }
                        }),
              TextButton(
                  onPressed: _busy || _uncertain ? null : _chooseRecord,
                  child: Text(_recordId == null
                      ? 'Gắn khoản chi đã nhập tay/OCR'
                      : 'Đã chọn khoản chi có sẵn · thay đổi')),
              if (_recordId == null)
                PickerField(
                    label: 'Danh mục ghi sổ',
                    value: data.categoryById(_categoryId)?.name ?? 'Tự động',
                    onTap: _busy || _uncertain
                        ? null
                        : () async {
                            final choice = await pickCategory(context,
                                categories: data.categoriesOf('EXPENSE'),
                                selectedId: _categoryId);
                            if (choice != null && mounted) {
                              setState(() => _categoryId = choice.category?.id);
                            }
                          }),
              PrimaryButton(
                  label:
                      _uncertain ? 'Kiểm tra kết quả / thử lại' : 'Thanh toán',
                  loading: _busy,
                  onPressed: _pay),
            ],
          ],
        ]));
  }
}
