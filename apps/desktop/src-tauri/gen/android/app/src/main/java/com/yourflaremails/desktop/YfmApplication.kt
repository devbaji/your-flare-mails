package com.yourflaremails.desktop

import android.app.Application

/** Ensures the mail notification channel (custom sound) exists before any FCM delivery. */
class YfmApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    MainActivity.ensureMailNotificationChannel(this)
  }
}
