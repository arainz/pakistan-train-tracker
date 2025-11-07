#!/bin/bash

# Koyeb Deployment Script
# Usage: ./scripts/deploy-koyeb.sh [app-name] [github-repo]

set -e

APP_NAME="${1:-pakistan-train-tracker}"
GITHUB_REPO="${2:-github.com/arainz/pakistan-train-tracker}"
BRANCH="${3:-main}"

echo "=================================================="
echo "☁️  Koyeb Deployment"
echo "=================================================="
echo "App: $APP_NAME"
echo "Repository: $GITHUB_REPO"
echo "Branch: $BRANCH"
echo ""

# Check if koyeb CLI is installed
if ! command -v koyeb &> /dev/null; then
    echo "❌ koyeb CLI not found. Please install it:"
    echo "   brew install koyeb/tap/koyeb"
    exit 1
fi

# Verify authentication
echo "🔑 Checking Koyeb authentication..."
if ! koyeb whoami &> /dev/null; then
    echo "Please login to Koyeb:"
    koyeb auth login
fi

echo "✅ Authentication verified"

# Check if app exists
echo ""
echo "🔍 Checking if app exists..."
if koyeb app get $APP_NAME &> /dev/null; then
    echo "✅ App found. Redeploying..."
    koyeb app redeploy $APP_NAME
else
    echo "📝 Creating new app..."
    koyeb app create $APP_NAME \
      --git $GITHUB_REPO \
      --git-branch $BRANCH \
      --git-builder buildpack \
      --instance-type free \
      --regions fra \
      --env NODE_ENV=production,PORT=8000,DATA_BASE_URL=https://trackyourtrains.com/data,SOCKET_URL=https://socket.pakraillive.com
fi

# Wait for deployment
echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Get app details
echo ""
echo "✅ Deployment initiated!"
echo ""
koyeb app get $APP_NAME | grep -E "Name|Status|URL"

echo ""
echo "📍 Get your URL with:"
echo "   koyeb app get $APP_NAME"
echo ""
echo "Next steps:"
echo "1. Find your URL and update config.js:"
echo "   servers.backup = 'https://your-koyeb-url.koyeb.app'"
echo "2. Test the endpoint:"
echo "   curl -i https://your-koyeb-url.koyeb.app/health"
echo "3. View logs:"
echo "   koyeb app logs $APP_NAME"
echo ""
