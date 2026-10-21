// Cấu hình phần Android của CapitalFlow Mobile sau khi chạy `flutter create`.
//
// Cách dùng (chạy từ thư mục capitalflow-mobile):
//
//     dart run tool/setup_android.dart
//
// Script chỉ CHỈNH SỬA hai file do `flutter create` sinh ra và an toàn khi chạy lại:
//   1. android/app/src/main/AndroidManifest.xml
//        - quyền INTERNET, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED
//        - cho phép gọi API qua http:// trong mạng nội bộ (usesCleartextTraffic)
//        - tên hiển thị "CapitalFlow", tắt sao lưu tự động (yêu cầu của secure storage)
//        - 2 receiver của flutter_local_notifications cho lịch nhắc hằng ngày
//   2. android/app/build.gradle(.kts)
//        - bật core library desugaring (bắt buộc với flutter_local_notifications)
import 'dart:io';

const String manifestPath = 'android/app/src/main/AndroidManifest.xml';
const String desugarVersion = '2.1.4';

const List<String> permissions = <String>[
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

const String receivers = '''
        <!-- CapitalFlow: lịch nhắc ghi chép hằng ngày (flutter_local_notifications) -->
        <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver" />
        <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED"/>
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
                <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
                <action android:name="com.htc.intent.action.QUICKBOOT_POWERON"/>
            </intent-filter>
        </receiver>
''';

final List<String> done = <String>[];
final List<String> manual = <String>[];

void main() {
  final manifestFile = File(manifestPath);
  if (!manifestFile.existsSync()) {
    stderr.writeln('Không tìm thấy $manifestPath.');
    stderr.writeln('Hãy chạy lệnh sau trong thư mục capitalflow-mobile trước, rồi chạy lại script này:');
    stderr.writeln('  flutter create --platforms=android --org vn.edu.huit --project-name capitalflow_mobile .');
    exitCode = 1;
    return;
  }

  patchManifest(manifestFile);
  patchGradle();

  stdout.writeln('');
  stdout.writeln('=== Cấu hình Android cho CapitalFlow Mobile ===');
  if (done.isEmpty && manual.isEmpty) {
    stdout.writeln('Mọi thứ đã được cấu hình từ trước, không cần thay đổi gì.');
  }
  for (final line in done) {
    stdout.writeln('  [OK] $line');
  }
  for (final line in manual) {
    stdout.writeln('  [CẦN LÀM TAY] $line');
  }
  stdout.writeln('');
  stdout.writeln('Bước tiếp theo:  flutter pub get   rồi   flutter run');
  if (manual.isNotEmpty) exitCode = 2;
}

void patchManifest(File file) {
  final original = file.readAsStringSync();
  var text = original;

  final applicationIndex = text.indexOf('<application');
  if (applicationIndex < 0) {
    manual.add('AndroidManifest.xml không có thẻ <application>; hãy xem mục "Cấu hình Android thủ công" trong README.');
    return;
  }

  // 1) Quyền truy cập, chèn ngay trước thẻ <application>.
  final missing = permissions.where((name) => !text.contains('"$name"')).toList();
  if (missing.isNotEmpty) {
    final block = StringBuffer();
    for (final name in missing) {
      block.writeln('    <uses-permission android:name="$name"/>');
    }
    final lineStart = text.lastIndexOf('\n', applicationIndex) + 1;
    text = text.substring(0, lineStart) + block.toString() + text.substring(lineStart);
    done.add('Thêm quyền: ${missing.map((name) => name.split('.').last).join(', ')}');
  }

  // 2) Thuộc tính của thẻ <application>.
  final attributes = <String>[];
  if (!text.contains('android:usesCleartextTraffic')) {
    attributes.add('android:usesCleartextTraffic="true"');
  }
  if (!text.contains('android:allowBackup')) {
    attributes.add('android:allowBackup="false"');
  }
  if (attributes.isNotEmpty) {
    final tagIndex = text.indexOf('<application');
    final insertAt = tagIndex + '<application'.length;
    final block = attributes.map((attribute) => '\n        $attribute').join();
    text = text.substring(0, insertAt) + block + text.substring(insertAt);
    done.add('Thêm thuộc tính <application>: ${attributes.join(' ')}');
  }

  // 3) Tên hiển thị của ứng dụng.
  final label = RegExp(r'android:label="([^"]*)"').firstMatch(text);
  if (label != null && label.group(1) != 'CapitalFlow') {
    text = text.replaceFirst(label.group(0)!, 'android:label="CapitalFlow"');
    done.add('Đổi tên hiển thị thành "CapitalFlow"');
  }

  // 4) Receiver cho thông báo đã đặt lịch.
  if (!text.contains('ScheduledNotificationReceiver')) {
    final closeIndex = text.lastIndexOf('</application>');
    if (closeIndex < 0) {
      manual.add('Không tìm thấy </application> để thêm receiver thông báo.');
    } else {
      final lineStart = text.lastIndexOf('\n', closeIndex) + 1;
      text = text.substring(0, lineStart) + receivers + text.substring(lineStart);
      done.add('Thêm receiver cho lịch nhắc hằng ngày');
    }
  }

  if (text != original) file.writeAsStringSync(text);
}

void patchGradle() {
  final kts = File('android/app/build.gradle.kts');
  final groovy = File('android/app/build.gradle');
  if (kts.existsSync()) {
    patchGradleFile(
      kts,
      enableLine: 'isCoreLibraryDesugaringEnabled = true',
      dependencyLine: 'coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:$desugarVersion")',
    );
  } else if (groovy.existsSync()) {
    patchGradleFile(
      groovy,
      enableLine: 'coreLibraryDesugaringEnabled true',
      dependencyLine: "coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:$desugarVersion'",
    );
  } else {
    manual.add('Không tìm thấy android/app/build.gradle(.kts); hãy bật core library desugaring theo README.');
  }
}

void patchGradleFile(File file, {required String enableLine, required String dependencyLine}) {
  final original = file.readAsStringSync();
  var text = original;
  final name = file.path.replaceAll('\\', '/').split('/').last;

  if (!text.contains('oreLibraryDesugaringEnabled')) {
    final match = RegExp(r'compileOptions\s*\{').firstMatch(text);
    if (match == null) {
      manual.add('$name: không thấy khối compileOptions { }. Hãy thêm "$enableLine" vào compileOptions theo README.');
    } else {
      text = '${text.substring(0, match.end)}\n        $enableLine${text.substring(match.end)}';
      done.add('$name: bật core library desugaring');
    }
  }

  if (!text.contains('desugar_jdk_libs')) {
    final newline = text.endsWith('\n') ? '' : '\n';
    text = '$text$newline\ndependencies {\n    $dependencyLine\n}\n';
    done.add('$name: thêm thư viện desugar_jdk_libs $desugarVersion');
  }

  if (text != original) file.writeAsStringSync(text);
}
