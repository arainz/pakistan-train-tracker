#!/bin/bash

# Script to find your Google Cloud app URL
echo "🔍 Finding your Pakistan Train Tracker URL..."
echo "============================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_warning "Google Cloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    print_warning "No project set. Run: gcloud auth login && gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

print_info "Checking project: $PROJECT_ID"
echo ""

# Method 1: Check Cloud Run services
print_info "🚀 Checking Cloud Run services..."
CLOUD_RUN_URL=$(gcloud run services list --platform managed --format="value(status.url)" --filter="metadata.name:pakistan-train-tracker" 2>/dev/null)

if [ -n "$CLOUD_RUN_URL" ]; then
    print_status "Found Cloud Run service!"
    echo "🌐 URL: $CLOUD_RUN_URL"
    echo "📊 API: $CLOUD_RUN_URL/api/live"
    echo "❤️ Health: $CLOUD_RUN_URL/health"
    
    # Test the URL
    print_info "Testing connection..."
    if curl -s --connect-timeout 10 "$CLOUD_RUN_URL/health" >/dev/null 2>&1; then
        print_status "✅ App is responding!"
    else
        print_warning "App may still be starting up..."
    fi
    echo ""
fi

# Method 2: Check App Engine
print_info "🏗️ Checking App Engine services..."
APP_ENGINE_URL="https://$PROJECT_ID.appspot.com"
if curl -s --connect-timeout 5 "$APP_ENGINE_URL" >/dev/null 2>&1; then
    print_status "Found App Engine service!"
    echo "🌐 URL: $APP_ENGINE_URL"
    echo "📊 API: $APP_ENGINE_URL/api/live"
    echo "❤️ Health: $APP_ENGINE_URL/health"
    echo ""
fi

# Method 3: List all services
print_info "📋 All your Google Cloud services:"
echo ""

# Cloud Run services
echo "Cloud Run services:"
gcloud run services list --platform managed 2>/dev/null || echo "No Cloud Run services found"
echo ""

# App Engine services  
echo "App Engine services:"
gcloud app services list 2>/dev/null || echo "No App Engine services found"
echo ""

# Method 4: Direct commands you can run
print_info "🛠️ Commands to find your URL:"
echo ""
echo "For Cloud Run:"
echo "  gcloud run services list --platform managed"
echo "  gcloud run services describe pakistan-train-tracker --region us-central1 --format='value(status.url)'"
echo ""
echo "For App Engine:"
echo "  gcloud app browse"
echo "  echo https://$PROJECT_ID.appspot.com"
echo ""

print_info "🔗 Quick test commands:"
if [ -n "$CLOUD_RUN_URL" ]; then
    echo "  curl $CLOUD_RUN_URL/health"
    echo "  curl $CLOUD_RUN_URL/api/live"
fi
if curl -s --connect-timeout 5 "$APP_ENGINE_URL" >/dev/null 2>&1; then
    echo "  curl $APP_ENGINE_URL/health"
    echo "  curl $APP_ENGINE_URL/api/live"
fi