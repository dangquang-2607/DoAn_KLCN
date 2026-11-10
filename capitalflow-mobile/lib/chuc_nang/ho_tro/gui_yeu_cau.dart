import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../ha_tang/api.dart';
import '../../dung_chung/giao_dien/chu_de.dart';
import '../xac_thuc/phien_dang_nhap.dart';
import '../vi/dich_vu_vi.dart';
import '../../dung_chung/giao_dien/thanh_phan.dart';
import '../xac_thuc/thanh_phan.dart' show isValidEmail;

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key, this.public = false});
  final bool public;
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final _title = TextEditingController(),
      _message = TextEditingController(),
      _email = TextEditingController(),
      _contact = TextEditingController();
  String _issue = 'LOCKED', _requestId = requestUuid();
  String? _error;
  bool _busy = false, _done = false, _uncertain = false;
  @override
  void dispose() {
    for (final c in [_title, _message, _email, _contact]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (_busy) return;
    if (!widget.public &&
        (_title.text.trim().length < 4 || _message.text.trim().length < 10)) {
      setState(
          () => _error = 'Nhập tiêu đề từ 4 ký tự và nội dung từ 10 ký tự.');
      return;
    }
    if (widget.public && !isValidEmail(_email.text)) {
      setState(() => _error = 'Vui lòng nhập email tài khoản hợp lệ.');
      return;
    }
    if (widget.public &&
        _issue == 'NO_EMAIL' &&
        (!isValidEmail(_contact.text) ||
            _contact.text.trim().toLowerCase() ==
                _email.text.trim().toLowerCase())) {
      setState(
          () => _error = 'Nhập một email liên hệ khác mà bạn có thể đọc thư.');
      return;
    }
    FocusScope.of(context).unfocus();
    final repo = AccountFeatures(context.read<AuthController>().api);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (widget.public) {
        await repo.accountSupport(
            email: _email.text,
            issue: _issue,
            contact: _issue == 'NO_EMAIL' ? _contact.text : null);
      } else {
        await repo.support(
            id: _requestId, title: _title.text, message: _message.text);
      }
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = errorText(e);
          _uncertain = e is! ApiException || e.uncertain;
          if (!_uncertain) _requestId = requestUuid();
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _requestError(BuildContext context) => Semantics(
        liveRegion: true,
        child: Text(_error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error)),
      );

  InputDecoration get _accountInput => fieldDecoration('').copyWith(
        constraints: const BoxConstraints(minHeight: 48),
        floatingLabelBehavior: FloatingLabelBehavior.never,
        contentPadding: const EdgeInsets.symmetric(
            horizontal: Space.sm, vertical: Space.sm),
      );

  Widget _accountForm(BuildContext context) {
    final editable = !_busy && !_uncertain;
    final needsContact = _issue == 'NO_EMAIL';
    final bodyStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.muted,
          height: 1.45,
        );
    return AppCard(
      padding: const EdgeInsets.all(Space.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Hỗ trợ tài khoản', style: AppText.screenTitle),
          const SizedBox(height: Space.md),
          if (_done)
            const InfoBanner(message: 'Đã tiếp nhận yêu cầu hỗ trợ tài khoản.')
          else ...[
            Text(
                'Gửi yêu cầu nếu tài khoản bị khóa hoặc bạn không còn mở được email đã đăng ký.',
                style: bodyStyle),
            const SizedBox(height: Space.xl),
            _SupportField(
              label: 'Email tài khoản',
              child: TextField(
                controller: _email,
                enabled: editable,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                maxLength: 255,
                decoration: _accountInput,
              ),
            ),
            const SizedBox(height: Space.xl),
            _SupportField(
              label: 'Vấn đề bạn gặp',
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                isDense: false,
                itemHeight: null,
                initialValue: _issue,
                items: const [
                  DropdownMenuItem(
                      value: 'LOCKED', child: Text('Tài khoản bị khóa')),
                  DropdownMenuItem(
                      value: 'NO_EMAIL',
                      child: Text('Mất quyền truy cập email đăng ký')),
                ],
                onChanged: editable
                    ? (value) => setState(() {
                          _issue = value!;
                          _error = null;
                        })
                    : null,
                decoration: _accountInput.copyWith(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: Space.sm),
                ),
              ),
            ),
            if (needsContact) ...[
              const SizedBox(height: Space.xl),
              _SupportField(
                label: 'Email liên hệ thay thế',
                child: TextField(
                  controller: _contact,
                  enabled: editable,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  maxLength: 255,
                  decoration: _accountInput,
                ),
              ),
              const SizedBox(height: Space.xs),
              Text('Nhập một email khác mà bạn có thể đọc thư.',
                  style: bodyStyle),
            ],
            if (_error != null) ...[
              const SizedBox(height: Space.sm),
              _requestError(context),
            ],
            const SizedBox(height: Space.xl),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Radii.chip)),
              ),
              onPressed: _busy ? null : _send,
              child: Text(_busy
                  ? 'Đang gửi…'
                  : _uncertain
                      ? 'Gửi lại cùng yêu cầu'
                      : 'Gửi yêu cầu'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _signedInForm(BuildContext context) {
    final email = context.select((AuthController auth) => auth.profile?.email);
    final editable = !_busy && !_uncertain;
    final body = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: AppColors.muted,
          height: 1.4,
        );

    InputDecoration requestInput(String hint) =>
        fieldDecoration(null, hint: hint).copyWith(
          constraints: const BoxConstraints(minHeight: 48),
          hintMaxLines: 2,
          hintStyle: body,
          contentPadding: const EdgeInsets.all(Space.sm),
        );

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(Space.md),
            child: Semantics(
              header: true,
              child: const Text('Gửi yêu cầu hỗ trợ', style: AppText.section),
            ),
          ),
          const Divider(height: 1, color: AppColors.line),
          Padding(
            padding: const EdgeInsets.all(Space.md),
            child: _done
                ? Semantics(
                    liveRegion: true,
                    child: const InfoBanner(
                      message:
                          'Đã tiếp nhận yêu cầu. Phản hồi sẽ được gửi đến email tài khoản của bạn.',
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _SupportField(
                        label: 'Tiêu đề',
                        child: TextField(
                          controller: _title,
                          enabled: editable,
                          textInputAction: TextInputAction.next,
                          textCapitalization: TextCapitalization.sentences,
                          maxLength: 100,
                          decoration: requestInput(
                            'Giao dịch chưa xuất hiện trong lịch sử',
                          ),
                        ),
                      ),
                      const SizedBox(height: Space.md),
                      _SupportField(
                        label: 'Mô tả vấn đề',
                        child: TextField(
                          controller: _message,
                          enabled: editable,
                          keyboardType: TextInputType.multiline,
                          textCapitalization: TextCapitalization.sentences,
                          textAlignVertical: TextAlignVertical.top,
                          minLines: 4,
                          maxLines: 8,
                          maxLength: 1500,
                          decoration: requestInput(
                            'Mô tả điều bạn gặp phải và thời điểm xảy ra.',
                          ),
                        ),
                      ),
                      const SizedBox(height: Space.xs),
                      Text(
                        'Không gửi mật khẩu, mã OTP hoặc thông tin thẻ.',
                        style: body,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: Space.sm),
                        _requestError(context),
                      ],
                      const SizedBox(height: Space.md),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.mail_outline_rounded,
                              size: 18, color: AppColors.muted),
                          const SizedBox(width: Space.xs),
                          Expanded(
                            child: Text(
                              email == null || email.isEmpty
                                  ? 'Phản hồi sẽ được gửi đến email tài khoản của bạn.'
                                  : 'Nhận phản hồi tại',
                              style: body,
                            ),
                          ),
                        ],
                      ),
                      if (email != null && email.isNotEmpty) ...[
                        const SizedBox(height: Space.xxs),
                        Text(
                          email,
                          style: body?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                      const SizedBox(height: Space.md),
                      FilledButton.icon(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(Radii.chip),
                          ),
                        ),
                        onPressed: _busy ? null : _send,
                        icon: _busy
                            ? const SizedBox.square(
                                dimension: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.send_outlined, size: 18),
                        label: Text(_busy
                            ? 'Đang gửi…'
                            : _uncertain
                                ? 'Gửi lại cùng yêu cầu'
                                : 'Gửi yêu cầu'),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: appBar(context, widget.public ? '' : 'Trung tâm hỗ trợ'),
        body: SafeArea(
          top: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(
                    Space.md, Space.xs, Space.md, Space.bottomInset),
                children: widget.public
                    ? [_accountForm(context)]
                    : [
                        _signedInForm(context),
                        const SizedBox(height: Space.lg),
                        const _SupportFaq(),
                      ],
              ),
            ),
          ),
        ),
      );
}

class _SupportFaq extends StatelessWidget {
  const _SupportFaq();

  // Cùng chủ đề với FAQ trên web, dùng tên tính năng trên mobile.
  static const _questions = <(String, String)>[
    (
      'Ví mới có sẵn tiền không?',
      'Ví mới có số dư 0 đ. Bạn có thể nạp tiền từ ngân hàng liên kết hoặc nhận chuyển tiền từ ví khác.',
    ),
    (
      'Quét hóa đơn có trừ tiền trong ví không?',
      'Quét hóa đơn và nhập thu chi thủ công chỉ ghi vào sổ thu chi để tính báo cáo và ngân sách. Số dư ví không thay đổi.',
    ),
    (
      'Giao dịch ví nào được tính vào thu chi?',
      'Giao dịch ví được đưa vào báo cáo và ngân sách khi bật “Tính vào thu chi”. Bạn có thể đổi tùy chọn này trong chi tiết giao dịch rồi lưu. Số dư ví không thay đổi.',
    ),
    (
      'Có thể chuyển tiền cho ai?',
      'Bạn có thể chuyển giữa các ví của mình hoặc chuyển cho người dùng khác bằng email hay mã ví. Hãy kiểm tra tên người nhận và số tiền trước khi xác nhận.',
    ),
    (
      'Đóng ví có mất lịch sử không?',
      'Chỉ đóng được ví có số dư 0 đ. Bạn vẫn có thể xem lịch sử trong mục Ví đã đóng.',
    ),
    (
      'Làm thế nào để đổi mật khẩu?',
      'Mở Tài khoản & bảo mật để đổi mật khẩu. Nếu quên mật khẩu, chọn “Quên mật khẩu?” ở màn hình đăng nhập.',
    ),
  ];

  @override
  Widget build(BuildContext context) => AppCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(Space.md),
              child: Semantics(
                header: true,
                child: const Text('Câu hỏi thường gặp', style: AppText.section),
              ),
            ),
            for (final (question, answer) in _questions) ...[
              const Divider(height: 1, color: AppColors.line),
              ExpansionTile(
                title: Text(question, style: AppText.cardTitle),
                tilePadding: const EdgeInsets.symmetric(horizontal: Space.md),
                childrenPadding:
                    const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.md),
                expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
                shape: const Border(),
                collapsedShape: const Border(),
                minTileHeight: 48,
                children: [
                  Text(
                    answer,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.muted,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
}

class _SupportField extends StatelessWidget {
  const _SupportField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExcludeSemantics(
              child: Text(label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink,
                      ))),
          const SizedBox(height: Space.xs),
          Semantics(label: label, child: child),
        ],
      );
}
