package vn.edu.huit.capitalflow_mobile

import android.Manifest
import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class BusinessPushService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val registration = message.data["registration_id"] ?: return
        val notification = message.data["notification_id"] ?: return
        if (prefs(this).getString("registration", null) != registration) return
        val process = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(process)
        if (process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) return
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return

        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return
        val channel = "capitalflow_business_push"
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(channel, "Thông báo CapitalFlow", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(tapExtra, notification)
            putExtra("capitalflow_push_registration", registration)
        }
        val tap = PendingIntent.getActivity(this, notification.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        @Suppress("DEPRECATION")
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else Notification.Builder(this)
        manager.notify(notification, notificationId, builder
            .setSmallIcon(R.drawable.ic_stat_capitalflow)
            .setContentTitle("CapitalFlow")
            .setContentText("Bạn có thông báo mới. Mở CapitalFlow để xem.")
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setContentIntent(tap).setAutoCancel(true).build())
        val store = prefs(this)
        val delivered = store.getString("delivered", "").orEmpty().split(',').filter { it.isNotEmpty() }
        store.edit().putString("delivered", (delivered + notification).distinct().takeLast(100).joinToString(",")).apply()
    }

    companion object {
        private const val notificationId = 8041
        private const val tapExtra = "capitalflow_push_notification"
        private fun prefs(context: Context) = context.getSharedPreferences("capitalflow_business_push", Context.MODE_PRIVATE)

        fun handle(activity: MainActivity, call: MethodCall, result: MethodChannel.Result) {
            when (call.method) {
                "token" -> {
                    val permission = Build.VERSION.SDK_INT < 33 ||
                        activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                    if (!permission || !activity.getSystemService(NotificationManager::class.java).areNotificationsEnabled() ||
                        FirebaseApp.getApps(activity).isEmpty()) {
                        result.success(null)
                        return
                    }
                    FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                        result.success(if (task.isSuccessful) task.result else null)
                    }
                }
                "activate" -> {
                    val registration = call.arguments as String
                    val store = prefs(activity)
                    val edit = store.edit().putString("registration", registration)
                    if (store.getString("registration", null) != registration) edit.remove("delivered")
                    edit.apply()
                    result.success(null)
                }
                "deactivate" -> {
                    val previous = prefs(activity).getString("registration", null)
                    prefs(activity).edit().remove("registration").remove("delivered").apply()
                    val manager = activity.getSystemService(NotificationManager::class.java)
                    manager.activeNotifications.filter { it.id == notificationId }.forEach { manager.cancel(it.tag, it.id) }
                    result.success(previous)
                }
                "takeTap" -> {
                    val intent = activity.intent
                    val id = intent.getStringExtra(tapExtra)
                    val registration = intent.getStringExtra("capitalflow_push_registration")
                    intent.removeExtra(tapExtra)
                    intent.removeExtra("capitalflow_push_registration")
                    result.success(id?.takeIf { registration != null && registration == prefs(activity).getString("registration", null) })
                }
                "delivered" -> result.success(prefs(activity).getString("delivered", "").orEmpty().split(',').filter { it.isNotEmpty() })
                else -> result.notImplemented()
            }
        }
    }
}
