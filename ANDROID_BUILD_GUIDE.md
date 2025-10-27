# Android App Build Guide 🤖

## ✅ Build Complete!

Your Android app has been successfully built!

### 📦 APK Location

**Debug APK (Ready to Install):**
```
PakTrainLive-debug.apk (22 MB)
```

**Full path:**
```
/Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail/PakTrainLive-debug.apk
```

## 📱 Install on Your Android Device

### Method 1: USB Cable (Recommended)

1. **Enable Developer Options** on your Android device:
   - Go to **Settings** → **About Phone**
   - Tap **Build Number** 7 times
   - Go back to **Settings** → **Developer Options**
   - Enable **USB Debugging**

2. **Connect** your Android device via USB

3. **Install using ADB:**
   ```bash
   cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
   adb install PakTrainLive-debug.apk
   ```

### Method 2: Transfer APK

1. **Copy APK** to your phone:
   - Email it to yourself
   - Upload to Google Drive/Dropbox
   - Use USB file transfer
   - Use AirDroid or similar app

2. **On your Android device:**
   - Open the APK file
   - Tap **Install**
   - (May need to enable "Install from Unknown Sources" in Settings)

### Method 3: Android Studio

```bash
# Open Android project in Android Studio
open android -a "Android Studio"

# Then click Run ▶️ button in Android Studio
```

## 📊 App Details

| Property | Value |
|----------|-------|
| **App Name** | Pak Train Live |
| **Package** | com.pakrail.tracker |
| **Version** | 1.0.0 |
| **APK Size** | 22 MB |
| **Min Android** | API 22 (Android 5.1) |
| **Target Android** | API 34 (Android 14) |

## 🎨 Features Included

✅ Real-time train tracking  
✅ Train schedules  
✅ Station search  
✅ Live map view  
✅ Push notifications  
✅ Location tracking  
✅ Dark mode  
✅ Offline support  
✅ Beautiful UI with train engine icon  

## 🔄 Rebuild App

If you make changes, rebuild:

### Quick Rebuild (Debug)

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail

# 1. Sync changes
npx cap sync android

# 2. Build APK
cd android && ./gradlew assembleDebug

# 3. Copy APK
cp app/build/outputs/apk/debug/app-debug.apk ../PakTrainLive-debug.apk
```

### Build Release APK (For Play Store)

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail/android

# Build release APK
./gradlew assembleRelease

# Sign the APK (required for Play Store)
# See "Signing Guide" section below
```

## 🔐 Signing Guide (For Production)

### 1. Generate Keystore

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail/android/app

keytool -genkey -v -keystore paktrainlive.keystore \
  -alias paktrainlive \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Save the passwords!** You'll need them.

### 2. Configure Signing

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=paktrainlive
storeFile=paktrainlive.keystore
```

### 3. Update `android/app/build.gradle`

Add before `android {`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

### 4. Build Signed APK

```bash
cd android
./gradlew assembleRelease

# Signed APK will be at:
# app/build/outputs/apk/release/app-release.apk
```

## 📦 Build AAB (For Play Store)

Google Play requires AAB (Android App Bundle):

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail/android

# Build AAB
./gradlew bundleRelease

# AAB will be at:
# app/build/outputs/bundle/release/app-release.aab
```

## 🚀 Publishing to Google Play Store

### 1. Create Developer Account

- Go to [Google Play Console](https://play.google.com/console)
- Pay one-time $25 fee
- Complete registration

### 2. Create App Listing

- App name: **Pak Train Live**
- Category: **Travel & Local**
- Add screenshots (from your phone)
- Add description
- Upload app icon (1024x1024)

### 3. Upload AAB

- Go to **Production** → **Create Release**
- Upload `app-release.aab`
- Complete rollout

### 4. Review Process

- Typically takes 1-3 days
- You'll receive email when approved

## 🔧 Troubleshooting

### Build Failed

```bash
# Clean build
cd android
./gradlew clean

# Rebuild
./gradlew assembleDebug
```

### ADB Not Found

```bash
# Install Android SDK Platform Tools
brew install --cask android-platform-tools

# Or download from:
# https://developer.android.com/studio/releases/platform-tools
```

### APK Won't Install

- Enable **Install from Unknown Sources** in Android Settings
- Check if old version is installed (uninstall it first)
- Make sure Android version is 5.1+

## 📝 Version Management

Update version in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        versionCode 2  // Increment for each release
        versionName "1.0.1"  // User-facing version
    }
}
```

## 🎯 Quick Commands Reference

```bash
# Sync changes
npx cap sync android

# Build debug APK
cd android && ./gradlew assembleDebug

# Build release APK (unsigned)
cd android && ./gradlew assembleRelease

# Build release AAB (for Play Store)
cd android && ./gradlew bundleRelease

# Install on device
adb install PakTrainLive-debug.apk

# Uninstall from device
adb uninstall com.pakrail.tracker

# View device logs
adb logcat
```

## ✅ What Was Updated

1. **App Name:** "Pak Train Live" (was "Pakistan Train Tracker")
2. **App Icon:** New Pakistan Railways locomotive icon
3. **All Features:** Synced from web app
4. **Permissions:** Location & Notifications configured
5. **Build:** Successfully compiled

## 📱 Test Checklist

Before publishing, test:

- ✅ App launches without crashes
- ✅ Train tracking works
- ✅ Map displays correctly
- ✅ Notifications work
- ✅ Location permission requested
- ✅ Dark mode toggles
- ✅ Search functions work
- ✅ Offline mode works
- ✅ Navigation works smoothly

## 🎉 Success!

Your Android app is built and ready to install!

**APK Location:** `PakTrainLive-debug.apk`

**Next Steps:**
1. Install on your Android device
2. Test all features
3. Fix any issues
4. Build signed release
5. Publish to Play Store

🚂✨ **Congratulations on your Android app!**

