package app.tauri.mobilepush

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Handles FCM delivery. When the app is in the foreground, the system may not
 * auto-display the notification payload — post a Gmail-style BigText notification.
 * Background delivery uses the FCM notification payload + [MAIL_CHANNEL_ID].
 */
class FCMService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        MobilePushPlugin.instance?.handleMessage(remoteMessage)
        displayMailNotification(remoteMessage)
    }

    override fun onNewToken(token: String) {
        MobilePushPlugin.instance?.handleNewToken(token)
    }

    private fun displayMailNotification(remoteMessage: RemoteMessage) {
        ensureMailNotificationChannel()

        val title =
            remoteMessage.notification?.title
                ?: remoteMessage.data["title"]
                ?: "New mail"
        val body =
            remoteMessage.notification?.body
                ?: remoteMessage.data["body"]
                ?: ""

        val launch =
            packageManager.getLaunchIntentForPackage(packageName)
                ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        remoteMessage.data.forEach { (key, value) -> launch.putExtra(key, value) }

        val flags =
            PendingIntent.FLAG_UPDATE_CURRENT or
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_IMMUTABLE
                } else {
                    0
                }
        val contentIntent =
            PendingIntent.getActivity(this, remoteMessage.messageId?.hashCode() ?: 0, launch, flags)

        val smallIcon =
            resources.getIdentifier("ic_launcher_foreground", "drawable", packageName).takeIf { it != 0 }
                ?: android.R.drawable.ic_dialog_email
        val soundId = resources.getIdentifier("yfm_notify", "raw", packageName)
        val soundUri =
            if (soundId != 0) Uri.parse("android.resource://$packageName/$soundId") else null

        val builder =
            NotificationCompat.Builder(this, MAIL_CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title)
                .setContentText(body.lineSequence().firstOrNull()?.trim().orEmpty().ifEmpty { body })
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_EMAIL)
                .setAutoCancel(true)
                .setContentIntent(contentIntent)
        if (soundUri != null) {
            builder.setSound(soundUri)
        }

        try {
            NotificationManagerCompat.from(this).notify(
                (remoteMessage.messageId ?: System.currentTimeMillis().toString()).hashCode(),
                builder.build(),
            )
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS denied — ignore
        }
    }

    private fun ensureMailNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val soundId = resources.getIdentifier("yfm_notify", "raw", packageName)
        val soundUri =
            if (soundId != 0) Uri.parse("android.resource://$packageName/$soundId") else null
        val attrs =
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        val channel =
            NotificationChannel(
                MAIL_CHANNEL_ID,
                "Mail",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "New mail alerts"
                enableVibration(true)
                if (soundUri != null) {
                    setSound(soundUri, attrs)
                }
            }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val MAIL_CHANNEL_ID = "yfm_mail_swoosh"
    }
}
