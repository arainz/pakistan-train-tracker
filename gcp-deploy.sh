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

# Choose deployment method
echo ""
print_info "Choose deployment method:"
echo "1. Google Cloud Run (Recommended - Serverless, automatic scaling)"
echo "2. Google App Engine (Managed platform)"
echo "3. Google Kubernetes Engine (Advanced - full container orchestration)"
echo ""

read -p "Enter your choice (1-3): " DEPLOY_METHOD

case $DEPLOY_METHOD in
    1)
        print_info "Deploying to Google Cloud Run..."
        
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
            print_status "Deployment successful!"
            
            # Get the service URL
            SERVICE_URL=$(gcloud run services describe pakistan-train-tracker --region=us-central1 --format="value(status.url)" --project=$PROJECT_ID)
            
            print_status "🎉 Your Pakistan Train Tracker is live!"
            print_info "URL: $SERVICE_URL"
            print_info "API: $SERVICE_URL/api/live"
            print_info "Health: $SERVICE_URL/health"
            
            echo ""
            print_info "Testing deployment..."
            curl -s "$SERVICE_URL/health" | head -3
            
        else
            print_error "Deployment failed!"
            exit 1
        fi
        ;;
        
    2)
        print_info "Deploying to Google App Engine..."
        
        # Deploy to App Engine
        gcloud app deploy app.yaml --project $PROJECT_ID
        
        if [ $? -eq 0 ]; then
            print_status "Deployment successful!"
            
            # Get the service URL
            SERVICE_URL="https://$PROJECT_ID.appspot.com"
            
            print_status "🎉 Your Pakistan Train Tracker is live!"
            print_info "URL: $SERVICE_URL"
            print_info "API: $SERVICE_URL/api/live"
            print_info "Health: $SERVICE_URL/health"
            
        else
            print_error "Deployment failed!"
            exit 1
        fi
        ;;
        
    3)
        print_warning "Google Kubernetes Engine deployment is more complex."
        print_info "For GKE deployment, you'll need to:"
        print_info "1. Create a GKE cluster"
        print_info "2. Build and push Docker image"
        print_info "3. Create Kubernetes deployment and service"
        print_info ""
        print_info "Would you like to use Cloud Run instead? It's simpler and perfect for this app."
        ;;
        
    *)
        print_error "Invalid choice!"
        exit 1
        ;;
esac

echo ""
print_info "Additional commands:"
echo "View logs: gcloud run logs tail --service pakistan-train-tracker --region us-central1"
echo "Update service: gcloud run deploy pakistan-train-tracker --source . --region us-central1"
echo "Delete service: gcloud run services delete pakistan-train-tracker --region us-central1"

print_status "Google Cloud deployment complete! 🎉"