import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

String _digest(Uint8List bytes) => sha256.convert(bytes).toString();

/// Large receipts must not block animation/input while hashing on Android.
Future<String> fileDigest(Uint8List bytes) => bytes.length < 64 * 1024
    ? Future.value(_digest(bytes))
    : compute(_digest, bytes, debugLabel: 'invoice-sha256');
