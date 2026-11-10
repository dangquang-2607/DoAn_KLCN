import 'dart:typed_data';
import 'dart:ui' as ui;

/// Freeze optimized bytes before queueing; every retry hashes/sends those bytes.
Future<Uint8List> prepareInvoiceImage(Uint8List bytes) async {
  if (bytes.isEmpty || bytes.length > 20 * 1024 * 1024) {
    throw StateError('Chọn ảnh từ 1 byte đến 20 MB.');
  }
  if (bytes.length <= 2 * 1024 * 1024) return bytes;
  for (final edge in [2400, 1920, 1600, 1280]) {
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    final descriptor = await ui.ImageDescriptor.encoded(buffer);
    final scale = edge /
        (descriptor.width > descriptor.height
            ? descriptor.width
            : descriptor.height);
    final codec = await descriptor.instantiateCodec(
      targetWidth:
          scale < 1 ? (descriptor.width * scale).round() : descriptor.width,
      targetHeight:
          scale < 1 ? (descriptor.height * scale).round() : descriptor.height,
    );
    try {
      final frame = await codec.getNextFrame();
      try {
        final data =
            await frame.image.toByteData(format: ui.ImageByteFormat.png);
        if (data != null && data.lengthInBytes <= 2 * 1024 * 1024) {
          return data.buffer
              .asUint8List(data.offsetInBytes, data.lengthInBytes);
        }
      } finally {
        frame.image.dispose();
      }
    } finally {
      codec.dispose();
      descriptor.dispose();
      buffer.dispose();
    }
  }
  throw StateError(
      'Ảnh vẫn lớn hơn 2 MB sau khi tối ưu. Hãy chụp gần hóa đơn hoặc chọn ảnh nhỏ hơn.');
}
