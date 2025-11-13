#!/bin/bash

# Pakistan Train Tracker - Google Cloud Platform Deployment Script
echo "🌩️ Pakistan Train Tracker - Google Cloud Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud CLI not found!"
    print_info "Install it from: https://cloud.google.com/sdk/docs/install"
    print_info "Or run: curl https://sdk.cloud.google.com | bash"
    exit 1
fi

print_info "Google Cloud CLI found!"

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_warning "Not authenticated with Google Cloud"
    print_info "Authenticating..."
    gcloud auth login
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    print_warning "No project set. Available projects:"
    gcloud projects list
    echo ""
    read -p "Enter your Google Cloud Project ID: " PROJECT_ID
    gcloud config set project $PROJECT_ID
fi

print_info "Using project: $PROJECT_ID"

# Enable required APIs
print_info "Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

print_status "APIs enabled!"

# Deploying to Google Cloud Run
print_info "🚀 Deploying to Google Cloud Run (pakistan-train-tracker)..."

# Build and deploy to Cloud Run
print_info "Building and deploying container..."

gcloud run deploy pakistan-train-tracker \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production,DATA_BASE_URL=https://trackyourtrains.com/data,SOCKET_URL=https://socket.pakraillive.com \
    --project $PROJECT_ID

if [ $? -eq 0 ]; then
    print_status "Deployment successful! ✅"

    # Get the service URL
    SERVICE_URL=$(gcloud run services describe pakistan-train-tracker --region=us-central1 --format="value(status.url)" --project=$PROJECT_ID)

    print_status "🎉 Your Pakistan Train Tracker is live!"
    print_info "URL: $SERVICE_URL"
    print_info "API: $SERVICE_URL/api/live"
    print_info "Health: $SERVICE_URL/health"

    echo ""
    print_info "Cleaning up old versions (keeping only latest)..."

    # Get all revisions sorted by creation time (newest first)
    REVISIONS=$(gcloud run revisions list --service pakistan-train-tracker --region us-central1 --format="value(name)" --project=$PROJECT_ID)
    REVISION_COUNT=$(echo "$REVISIONS" | wc -l)

    if [ $REVISION_COUNT -gt 1 ]; then
        print_warning "Found $REVISION_COUNT revisions. Keeping latest, deleting old ones..."

        # Skip the first one (latest) and delete the rest
        echo "$REVISIONS" | tail -n +2 | while read REVISION; do
            print_info "Deleting old revision: $REVISION"
            gcloud run revisions delete $REVISION \
                --service pakistan-train-tracker \
                --region us-central1 \
                --quiet \
                --project=$PROJECT_ID 2>/dev/null || true
        done

        print_status "Old revisions cleaned up! Only latest version retained."
    else
        print_status "Only one revision exists. No cleanup needed."
    fi

    echo ""
    print_info "Testing deployment..."
    curl -s "$SERVICE_URL/health" | head -3

    echo ""
    print_status "Deployment complete! 🎉"

else
    print_error "Deployment failed!"
    exit 1
fi

echo ""
print_info "📋 Useful commands:"
echo "  View logs:     gcloud run logs tail --service pakistan-train-tracker --region us-central1"
echo "  View revisions: gcloud run revisions list --service pakistan-train-tracker --region us-central1"
echo "  Delete service: gcloud run services delete pakistan-train-tracker --region us-central1"
echo ""
print_info "✨ Next deployment will automatically remove old versions and keep only the latest!"