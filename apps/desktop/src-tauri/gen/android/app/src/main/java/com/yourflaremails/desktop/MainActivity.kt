package com.yourflaremails.desktop

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    ensureMailNotificationChannel(this)
    super.onCreate(savedInstanceState)
  }

  companion object {
    /** Must match FCM `android.notification.channel_id` and FCMService.MAIL_CHANNEL_ID. */
    /** Bump id when changing sound/importance so Android recreates the channel. */
    const val MAIL_CHANNEL_ID = "yfm_mail_chime"

    fun ensureMailNotificationChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java) ?: return
      val soundUri =
        Uri.parse("android.resource://${context.packageName}/${R.raw.yfm_notify}")
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
          setSound(soundUri, attrs)
        }
      manager.createNotificationChannel(channel)
    }
  }
}
