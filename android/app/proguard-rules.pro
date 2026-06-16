# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Capacitor + Cordova keep rules
# ---------------------------------------------------------------------------
# Capacitor uses reflection to bind @CapacitorPlugin / @PluginMethod classes
# to the JS bridge. Without these rules, R8 will rename or strip them and
# every Capacitor.Plugins.* call from JS will return undefined at runtime.

-keep public class com.getcapacitor.** { *; }
-keep public class com.getcapacitor.plugin.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod *;
    @com.getcapacitor.annotation.PermissionCallback *;
    @com.getcapacitor.annotation.ActivityCallback *;
}

# Cordova plugins (PushNotifications etc. ship with embedded Cordova code)
-keep class org.apache.cordova.** { *; }

# Capacitor community / first-party plugins used by this app
-keep class com.capacitorjs.plugins.** { *; }
-keep class ee.forgr.capacitor.nativeaudio.** { *; }

# Keep WebView JavaScript interfaces (if you add any later, list them here)
# -keepclassmembers class com.personal.os.MyJsInterface {
#    public *;
# }

# AndroidX / SplashScreen
-keep class androidx.core.splashscreen.** { *; }

# WorkManager
-keep class androidx.work.** { *; }
-keep class com.personal.os.sync.** { *; }

# AppWidgetProviders — referenced only from AndroidManifest.xml. Without these
# keep rules, R8 strips the classes in release builds and "Couldn't add widget"
# appears in the launcher because the receiver class can't be loaded.
-keep public class com.personal.os.widgets.** { *; }
-keep public class * extends android.appwidget.AppWidgetProvider { *; }

# Annotations + line numbers for crash reports
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
