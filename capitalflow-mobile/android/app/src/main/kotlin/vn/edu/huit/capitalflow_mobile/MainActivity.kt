package vn.edu.huit.capitalflow_mobile

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.Intent
import android.content.ClipData
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : FlutterActivity() {
    private var pendingQrSave: Pair<ByteArray, MethodChannel.Result>? = null

    private companion object {
        const val QR_STORAGE_PERMISSION = 4031
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "capitalflow/business_push")
            .setMethodCallHandler { call, result -> BusinessPushService.handle(this, call, result) }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "capitalflow/checkout")
            .setMethodCallHandler { call, result ->
                if (call.method != "open") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                try {
                    val uri = Uri.parse(call.arguments as String)
                    require(uri.scheme == "https" && uri.encodedAuthority == "pay.payos.vn")
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    result.success(null)
                } catch (e: Exception) {
                    result.error("CHECKOUT_OPEN_FAILED", "Không mở được trang thanh toán payOS.", null)
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "capitalflow/files")
            .setMethodCallHandler { call, result ->
                if (call.method == "saveQrImage") {
                    val bytes = call.argument<ByteArray>("bytes")
                    if (bytes == null || bytes.isEmpty() || bytes.size > 8_000_000) {
                        result.error("INVALID_QR_IMAGE", "Ảnh QR không hợp lệ.", null)
                    } else {
                        saveQrImage(bytes, result)
                    }
                    return@setMethodCallHandler
                }
                if (call.method != "share") { result.notImplemented(); return@setMethodCallHandler }
                try {
                    val name = call.argument<String>("name") ?: error("Missing filename")
                    require(Regex("[a-zA-Z0-9_-]+\\.xlsx").matches(name))
                    val bytes = call.argument<ByteArray>("bytes") ?: error("Missing data")
                    val dir = File(cacheDir, "exports").apply { mkdirs() }
                    // Bound retention without deleting files outside our export cache.
                    dir.listFiles()?.filter { it.isFile && it.lastModified() < System.currentTimeMillis() - 86400000L }?.forEach { it.delete() }
                    val file = File(dir, "${System.currentTimeMillis()}-$name")
                    file.writeBytes(bytes)
                    val uri = FileProvider.getUriForFile(this, "$packageName.exports", file)
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        clipData = ClipData.newRawUri("CapitalFlow", uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(intent, "Lưu hoặc chia sẻ báo cáo"))
                    result.success(null)
                } catch (e: Exception) {
                    result.error("EXPORT_FAILED", "Không mở được chia sẻ tệp: ${e.localizedMessage}", null)
                }
            }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    @Suppress("DEPRECATION")
    private fun saveQrImage(bytes: ByteArray, result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            if (pendingQrSave != null) {
                result.error("SAVE_IN_PROGRESS", "Ảnh QR đang được lưu.", null)
                return
            }
            pendingQrSave = bytes to result
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), QR_STORAGE_PERMISSION)
            return
        }
        writeQrImage(bytes, result)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != QR_STORAGE_PERMISSION) return
        val (bytes, result) = pendingQrSave ?: return
        pendingQrSave = null
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            writeQrImage(bytes, result)
        } else {
            result.error("STORAGE_DENIED", "Hãy cấp quyền lưu trữ cho CapitalFlow để lưu ảnh QR.", null)
        }
    }

    @Suppress("DEPRECATION")
    private fun writeQrImage(bytes: ByteArray, result: MethodChannel.Result) {
        Thread {
            val name = "CapitalFlow-QR-${System.currentTimeMillis()}.png"
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, name)
                        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                        put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/CapitalFlow")
                        put(MediaStore.Images.Media.IS_PENDING, 1)
                    }
                    val resolver = contentResolver
                    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        ?: error("Could not create media item")
                    try {
                        val output = resolver.openOutputStream(uri) ?: error("Could not open media item")
                        output.use { it.write(bytes) }
                        val published = ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }
                        check(resolver.update(uri, published, null, null) == 1)
                    } catch (e: Exception) {
                        runCatching { resolver.delete(uri, null, null) }
                        throw e
                    }
                    runOnUiThread { result.success(null) }
                } else {
                    val pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                    val folder = File(pictures, "CapitalFlow")
                    check(folder.isDirectory || folder.mkdirs())
                    val file = File(folder, name)
                    try {
                        file.writeBytes(bytes)
                        MediaScannerConnection.scanFile(this, arrayOf(file.absolutePath), arrayOf("image/png")) { _, uri ->
                            if (uri != null) {
                                runOnUiThread { result.success(null) }
                            } else {
                                file.delete()
                                reportQrSaveError(result)
                            }
                        }
                    } catch (e: Exception) {
                        file.delete()
                        throw e
                    }
                }
            } catch (_: Exception) {
                reportQrSaveError(result)
            }
        }.start()
    }

    private fun reportQrSaveError(result: MethodChannel.Result) {
        runOnUiThread {
            result.error("QR_SAVE_FAILED", "Không lưu được ảnh QR vào bộ sưu tập. Vui lòng thử lại.", null)
        }
    }
}
