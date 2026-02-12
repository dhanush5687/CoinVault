# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Stallion OTA
-keep class com.stallion.** { *; }
-keep interface com.stallion.** { *; }

# AdMob
-keep class com.google.android.gms.ads.** { *; }
-keep interface com.google.android.gms.ads.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }

# React Native
-keep class com.facebook.react.bridge.CatalystInstanceImpl { *; }
-keep class com.facebook.react.bridge.WritableNativeMap { *; }
-keep class com.facebook.react.bridge.WritableNativeArray { *; }
