#!/bin/bash

# Sync script to copy public files to iOS app bundle
# Usage: ./sync-to-ios.sh

echo "🔄 Syncing public files to iOS app..."

PUBLIC_DIR="public"
IOS_PUBLIC_DIR="ios/App/App/App/public"

# Copy all public files to iOS
echo "📦 Copying all files from $PUBLIC_DIR to $IOS_PUBLIC_DIR..."
rsync -av --exclude='*.DS_Store' "$PUBLIC_DIR/" "$IOS_PUBLIC_DIR/"

echo "✅ Sync complete!"
echo ""
echo "📱 Next steps:"
echo "   1. Run: npx cap sync ios"
echo "   2. Rebuild in Xcode"
echo ""


