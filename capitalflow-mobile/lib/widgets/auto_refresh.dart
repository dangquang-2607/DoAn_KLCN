import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../services/app_data.dart';

/// Tự tải lại dữ liệu của một màn hình khi "số phiên bản dữ liệu" thay đổi.
///
/// [AppData.revision] tăng sau mỗi thao tác ghi trên điện thoại và mỗi khi có
/// thông báo cho biết web/hệ thống vừa thay đổi dữ liệu, nhờ đó các màn hình đang
/// mở luôn khớp với cơ sở dữ liệu dùng chung mà không cần người dùng kéo để làm mới.
mixin AutoRefresh<T extends StatefulWidget> on State<T> {
  AppData? _watchedData;
  int _watchedRevision = 0;
  bool _active = true;
  bool _dirty = false;

  /// Tải (lại) dữ liệu của màn hình.
  Future<void> reload();

  @override
  void initState() {
    super.initState();
    final data = context.read<AppData>();
    _watchedData = data;
    _watchedRevision = data.revision;
    data.addListener(_onDataChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _active) reload();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _active = TickerMode.valuesOf(context).enabled;
    if (_active && _dirty) {
      _dirty = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _active) reload();
      });
    }
  }

  void _onDataChanged() {
    final data = _watchedData;
    if (!mounted || data == null) return;
    if (data.revision != _watchedRevision) {
      _watchedRevision = data.revision;
      if (_active) {
        reload();
      } else {
        _dirty = true;
      }
    }
  }

  @override
  void dispose() {
    _watchedData?.removeListener(_onDataChanged);
    _watchedData = null;
    super.dispose();
  }
}
