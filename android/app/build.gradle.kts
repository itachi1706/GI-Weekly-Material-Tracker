import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services") // Google Services plugin
    id("com.google.firebase.crashlytics") // Firebase Crashlytics plugin
    id("com.google.firebase.firebase-perf") // Firebase Performance Monitoring plugin
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")

if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use {
        keystoreProperties.load(it)
    }
}

project.logger.lifecycle("Flutter Information: Compile - ${flutter.compileSdkVersion}, " +
        "Min - ${flutter.minSdkVersion}, Target - ${flutter.targetSdkVersion}, Version Code - ${flutter.versionCode}, Version Name - ${flutter.versionName}")

android {
    namespace = "com.itachi1706.gi_weekly_material_tracker"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "27.1.12297006" // Override the NDK version by flutter

    compileOptions {
        isCoreLibraryDesugaringEnabled = true // For AGP 7.4+
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "com.itachi1706.gi_weekly_material_tracker"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24 // Override flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storePassword = keystoreProperties.getProperty("storePassword")
            keystoreProperties.getProperty("storeFile")?.let {
                storeFile = file(it)
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            ndk {
                debugSymbolLevel = "SYMBOL_TABLE"
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // For AGP 7.4+
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}