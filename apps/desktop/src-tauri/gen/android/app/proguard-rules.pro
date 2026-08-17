# Add project specific ProGuard rules here.
# Keep Firebase / FCM / Tauri mobile-push so release getToken() works.

-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

-keep class app.tauri.** { *; }
-keep class app.tauri.mobilepush.** { *; }
-keep class com.yourflaremails.desktop.** { *; }

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
