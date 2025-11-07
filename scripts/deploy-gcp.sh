#!/bin/bash

# Google Cloud Run Deployment Script
# Usage: ./scripts/deploy-gcp.sh [project-id] [region]

set -e

PROJECT_ID="${1:-your-project-id}"
REGION="${2:-us-central1}"
SERVICE_NAME="pakistan-train-tracker"

echo "=================================================="
echo "📱 Google Cloud Run Deployment"
echo "=================================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Verify authentication
echo "🔑 Checking authentication..."
gcloud auth list --filter=status:ACTIVE --format="value(account)"

# Set project
gcloud config set project $PROJECT_ID

# Enable APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Build and deploy
echo "🚀 Building and deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars NODE_ENV=production,PORT=8080,DATA_BASE_URL=https://trackyourtrains.com/data,SOCKET_URL=https://socket.pakraillive.com

# Get service URL
echo ""
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format 'value(status.url)')

echo "📍 Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Update config.js with this URL:"
echo "   servers.primary = '$SERVICE_URL'"
echo "2. Test the endpoint:"
echo "   curl -i $SERVICE_URL/health"
echo ""
