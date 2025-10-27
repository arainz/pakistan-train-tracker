# Icon & Splash Screen Update Guide

## ✅ Changes Made

### 1. App Name Updated
- **File**: `ios/App/App/App/Info.plist`
- **Change**: CFBundleDisplayName → "Pak Train Live"

### 2. App Icons Generated & Updated
- **Location**: `ios/App/App/App/Assets.xcassets/AppIcon.appiconset/`
- **Files**: 29 icon files in all required sizes (20pt - 1024pt)
- **Source**: `resources/icon.png` (train engine #9007)
- **Contents.json**: Updated to reference new icon files

### 3. Splash Screens Generated & Updated
- **Location**: `ios/App/App/App/Assets.xcassets/Splash.imageset/`
- **Files**: 21 splash screen files for all device sizes
- **Source**: `resources/splash.png` (gradient + train design)
- **Contents.json**: Updated to reference new splash files

## 🚀 How to Build & Test

### In Xcode (RECOMMENDED)

1. **Open Xcode workspace**:
   ```bash
   open ios/App/App/App.xcworkspace
   ```

2. **Clean build folder**:
   - In Xcode menu: **Product** → **Clean Build Folder**
   - Or press: **⌘ + Shift + K**

3. **Delete old app from device**:
   - Long press the "Pakistan Train Tracker" app on your iPhone
   - Tap **Remove App** → **Delete App**
   - This clears cached icons

4. **Select your device**:
   - In Xcode toolbar, select **Abdul's iPhone** (or your device name)

5. **Build and Run**:
   - Press **⌘ + R**
   - Or click the ▶️ Play button

### Expected Results

After installation, you should see:
- ✅ **New App Icon**: Pakistan Railways locomotive #9007 on white background
- ✅ **New App Name**: "Pak Train Live"
- ✅ **New Splash Screen**: Beautiful gradient with train, app name, and tagline

## 🔧 Troubleshooting

### If icon/splash still shows old version:

1. **Delete the app completely** from your iPhone
2. **Restart your iPhone**
3. **Clean Xcode build folder** (⌘ + Shift + K)
4. **Rebuild and install**

### If Xcode shows errors:

1. Make sure all Pods are installed:
   ```bash
   cd ios/App/App
   pod install
   ```

2. Clean derived data:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```

3. Rebuild in Xcode

## 📁 Source Files

- **Icon Generator**: `resources/generate-icon.html`
- **Splash Generator**: `resources/generate-splash.html`
- **Icon Source**: `resources/icon.png` (1024x1024)
- **Splash Source**: `resources/splash.png` (2732x2732)
- **Train Image**: `resources/engine.png`

## 🎨 Design Details

### App Icon
- Size: 1024x1024px
- Background: White (#FFFFFF)
- Image: Pakistan Railways locomotive #9007
- Border: Rounded corners (iOS applies automatically)

### Splash Screen
- Size: 2732x2732px (universal)
- Background: Gradient (teal → orange-yellow)
- Elements:
  - Top: App name "Pak Train Live"
  - Center: Train locomotive image
  - Bottom: Tagline "Real-time Pakistan Railways tracking"
  - Platform indicator "Powered by Pakistan Railways"

