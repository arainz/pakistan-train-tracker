# App Icon and Splash Screen Resources

## Design Files

This folder contains the SVG design files for the app icon and splash screen:

- `icon-design.svg` - App icon design (1024x1024)
- `splash-design.svg` - Splash screen design (2732x2732)

## Design Features

### Train Engine
- **Realistic Pakistani train** in green (Pakistan Railways colors)
- **Pakistan flag** on the side of the train
- **Modern, clean design** with gradients and shadows
- **"LIVE" badge** on the icon to indicate real-time tracking

### Colors
- **Background**: Blue-green gradient (#1e3a8a, #065f46)
- **Train**: Green gradient (#10b981, #059669) - Pakistan Railways green
- **Accents**: Pakistan flag colors (dark green #01411C and white)
- **Live indicator**: Red (#ef4444)

## Converting SVG to PNG

### Option 1: Using Online Tools
1. Go to https://svgtopng.com or https://cloudconvert.com/svg-to-png
2. Upload `icon-design.svg` and `splash-design.svg`
3. Download the PNG files

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick (Mac)
brew install imagemagick

# Convert Icon
convert -background none -density 300 icon-design.svg -resize 1024x1024 icon.png

# Convert Splash Screen
convert -background none -density 300 splash-design.svg -resize 2732x2732 splash.png
```

### Option 3: Using Inkscape
```bash
# Install Inkscape (Mac)
brew install inkscape

# Convert Icon
inkscape icon-design.svg --export-filename=icon.png --export-width=1024

# Convert Splash Screen
inkscape splash-design.svg --export-filename=splash.png --export-width=2732
```

## Generating All Required Sizes

### For iOS

After converting to PNG, use https://www.appicon.co or run:

```bash
# iOS App Icon Sizes
sips -z 20 20     icon.png --out AppIcon-20.png
sips -z 29 29     icon.png --out AppIcon-29.png
sips -z 40 40     icon.png --out AppIcon-40.png
sips -z 58 58     icon.png --out AppIcon-58.png
sips -z 60 60     icon.png --out AppIcon-60.png
sips -z 76 76     icon.png --out AppIcon-76.png
sips -z 80 80     icon.png --out AppIcon-80.png
sips -z 87 87     icon.png --out AppIcon-87.png
sips -z 120 120   icon.png --out AppIcon-120.png
sips -z 152 152   icon.png --out AppIcon-152.png
sips -z 167 167   icon.png --out AppIcon-167.png
sips -z 180 180   icon.png --out AppIcon-180.png
sips -z 1024 1024 icon.png --out AppIcon-1024.png

# iOS Splash Screens (various device sizes)
sips -z 2732 2732 splash.png --out splash-2732x2732.png
sips -z 1536 2048 splash.png --out splash-1536x2048.png
sips -z 1668 2224 splash.png --out splash-1668x2224.png
sips -z 1620 2160 splash.png --out splash-1620x2160.png
sips -z 1284 2778 splash.png --out splash-1284x2778.png
sips -z 1242 2688 splash.png --out splash-1242x2688.png
sips -z 828 1792  splash.png --out splash-828x1792.png
sips -z 750 1334  splash.png --out splash-750x1334.png
```

### For Android

```bash
# Android Icon Sizes
sips -z 192 192   icon.png --out android/mipmap-xxxhdpi/ic_launcher.png
sips -z 144 144   icon.png --out android/mipmap-xxhdpi/ic_launcher.png
sips -z 96 96     icon.png --out android/mipmap-xhdpi/ic_launcher.png
sips -z 72 72     icon.png --out android/mipmap-hdpi/ic_launcher.png
sips -z 48 48     icon.png --out android/mipmap-mdpi/ic_launcher.png

# Android Splash Screens
sips -z 1920 1920 splash.png --out android/drawable-xxxhdpi/splash.png
sips -z 1280 1280 splash.png --out android/drawable-xxhdpi/splash.png
sips -z 960 960   splash.png --out android/drawable-xhdpi/splash.png
sips -z 640 640   splash.png --out android/drawable-hdpi/splash.png
sips -z 480 480   splash.png --out android/drawable-mdpi/splash.png
```

## Quick Generation Script

Run this after converting SVG to PNG:

```bash
#!/bin/bash

# Run from the resources folder
npx @capacitor/assets generate --iconPath icon.png --splashPath splash.png
```

This will automatically generate all required sizes for both iOS and Android!

## Manual Placement

### iOS
1. Open Xcode
2. Navigate to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
3. Replace existing icons with generated ones
4. Navigate to `ios/App/App/Assets.xcassets/Splash.imageset/`
5. Replace splash images

### Android
1. Navigate to `android/app/src/main/res/`
2. Replace icons in `mipmap-*/ic_launcher.png`
3. Replace splash in `drawable-*/splash.png`

## Verification

After updating:
1. Clean build: `npx cap sync`
2. Rebuild the app
3. Check that:
   - App icon shows the new train design
   - Splash screen appears correctly on launch
   - App name shows "Pak Train Live"

## Design Attribution

Train icon designed for Pak Train Live app.
Colors inspired by Pakistan Railways branding.
