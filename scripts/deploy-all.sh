#!/bin/bash

# Master Deployment Script - Deploy to all three cloud platforms
# Usage: ./scripts/deploy-all.sh [--gcp] [--oracle] [--koyeb] [--all]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GCP_PROJECT_ID="pakistan-train-tracker"
ORACLE_USER="ubuntu"
ORACLE_IP="138.2.91.18"
KOYEB_APP="pakistan-train-tracker"
KOYEB_REPO="github.com/arainz/pakistan-train-tracker"

# Defaults
DEPLOY_GCP=false
DEPLOY_ORACLE=false
DEPLOY_KOYEB=false

# Functions
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_help() {
    cat << EOF
Usage: ./scripts/deploy-all.sh [options]

Options:
  --gcp              Deploy to Google Cloud Run only
  --oracle           Deploy to Oracle Cloud only
  --koyeb            Deploy to Koyeb only
  --all              Deploy to all platforms (default if no option specified)
  --help             Show this help message

Configuration:
  GCP Project:       $GCP_PROJECT_ID
  Oracle IP:         $ORACLE_IP
  Koyeb App:         $KOYEB_APP

Examples:
  ./scripts/deploy-all.sh --all
  ./scripts/deploy-all.sh --gcp --oracle
  ./scripts/deploy-all.sh --koyeb

EOF
}

# Parse arguments
if [[ $# -eq 0 ]]; then
    DEPLOY_GCP=true
    DEPLOY_ORACLE=true
    DEPLOY_KOYEB=true
else
    case "$1" in
        --gcp)
            DEPLOY_GCP=true
            ;;
        --oracle)
            DEPLOY_ORACLE=true
            ;;
        --koyeb)
            DEPLOY_KOYEB=true
            ;;
        --all)
            DEPLOY_GCP=true
            DEPLOY_ORACLE=true
            DEPLOY_KOYEB=true
            ;;
        --help)
            print_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_help
            exit 1
            ;;
    esac
fi

# Main deployment
print_header "🚀 Pakistan Train Tracker - Multi-Cloud Deployment"

cd "$PROJECT_DIR"

# Pre-deployment checks
print_header "📋 Pre-Deployment Checks"

# Check git status
if git status --porcelain | grep -q .; then
    print_info "Uncommitted changes found. Committing..."
    git add -A
    git commit -m "Deployment build $(date +%Y-%m-%d\ %H:%M:%S)" || true
fi
git push origin main 2>/dev/null || print_info "Could not push to git (may not have remotes)"
print_status "Git repository updated"

# 1. Google Cloud Run Deployment
if [ "$DEPLOY_GCP" = true ]; then
    print_header "🌍 Google Cloud Run Deployment"

    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    print_info "Setting up Google Cloud..."
    gcloud config set project $GCP_PROJECT_ID

    print_info "Enabling required APIs..."
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

    print_info "Building and deploying to Cloud Run..."
    gcloud run deploy pakistan-train-tracker \
      --source . \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --memory 512Mi \
      --cpu 1 \
      --timeout 3600 \
      --set-env-vars NODE_ENV=production,PORT=8080,DATA_BASE_URL=https://trackyourtrains.com/data,SOCKET_URL=https://socket.pakraillive.com

    GCP_URL=$(gcloud run services describe pakistan-train-tracker \
      --region us-central1 \
      --format 'value(status.url)')

    print_status "Google Cloud Run deployed"
    echo -e "${GREEN}📍 URL: $GCP_URL${NC}"
fi

# 2. Oracle Cloud Deployment
if [ "$DEPLOY_ORACLE" = true ]; then
    print_header "🏔️  Oracle Cloud Deployment"

    print_info "Checking SSH connection..."
    if ! ssh -o ConnectTimeout=5 $ORACLE_USER@$ORACLE_IP "echo 'OK'" > /dev/null 2>&1; then
        print_error "Cannot connect to Oracle instance at $ORACLE_IP"
        echo "Please check:"
        echo "  1. SSH key is configured"
        echo "  2. Security rules allow SSH (port 22)"
        echo "  3. IP address is correct"
        DEPLOY_ORACLE=false
    else
        print_info "Syncing files..."
        rsync -avz --delete \
          --exclude node_modules \
          --exclude .git \
          --exclude .env \
          --exclude .DS_Store \
          --exclude "*.log" \
          . $ORACLE_USER@$ORACLE_IP:/home/ubuntu/app/

        print_info "Installing dependencies and restarting..."
        ssh $ORACLE_USER@$ORACLE_IP << 'EOFREMOTE'
  set -e
  cd /home/ubuntu/app
  npm ci --only=production
  if pm2 info train-tracker &> /dev/null; then
    pm2 restart train-tracker
  else
    pm2 start server.js --name "train-tracker" --instances max --exec-mode cluster
  fi
  pm2 save
EOFREMOTE

        print_status "Oracle Cloud deployed"
        echo -e "${GREEN}📍 URL: http://$ORACLE_IP:3000${NC}"
    fi
fi

# 3. Koyeb Deployment
if [ "$DEPLOY_KOYEB" = true ]; then
    print_header "☁️  Koyeb Deployment"

    if ! command -v koyeb &> /dev/null; then
        print_error "koyeb CLI not found. Install from: https://www.koyeb.com"
        print_info "macOS: brew install koyeb/tap/koyeb"
        DEPLOY_KOYEB=false
    else
        print_info "Checking Koyeb authentication..."
        if ! koyeb whoami &> /dev/null; then
            print_info "Please login to Koyeb..."
            koyeb auth login
        fi

        print_info "Deploying to Koyeb..."
        if koyeb app get $KOYEB_APP &> /dev/null; then
            print_info "App exists. Redeploying..."
            koyeb app redeploy $KOYEB_APP
        else
            print_info "Creating new Koyeb app..."
            koyeb app create $KOYEB_APP \
              --git $KOYEB_REPO \
              --git-branch main \
              --git-builder buildpack \
              --instance-type free \
              --regions fra \
              --env NODE_ENV=production,PORT=8000,DATA_BASE_URL=https://trackyourtrains.com/data,SOCKET_URL=https://socket.pakraillive.com
        fi

        print_status "Koyeb deployment initiated"
        echo -e "${GREEN}📍 Find your URL with: koyeb app get $KOYEB_APP${NC}"
    fi
fi

# Summary
print_header "✅ Deployment Summary"

echo "Deployment Status:"
[ "$DEPLOY_GCP" = true ] && echo "  ✓ Google Cloud Run" || echo "  ✗ Google Cloud Run"
[ "$DEPLOY_ORACLE" = true ] && echo "  ✓ Oracle Cloud" || echo "  ✗ Oracle Cloud"
[ "$DEPLOY_KOYEB" = true ] && echo "  ✓ Koyeb" || echo "  ✗ Koyeb"

echo ""
echo "Next Steps:"
echo "  1. Update public/config.js with the URLs above"
echo "  2. Test all endpoints for health:"
echo "     curl -i https://your-gcp-url/health"
echo "     curl -i http://$ORACLE_IP:3000/health"
echo "     curl -i https://your-koyeb-url/health"
echo "  3. Monitor logs:"
echo "     GCP:    gcloud run services logs read pakistan-train-tracker"
echo "     Oracle: ssh ubuntu@$ORACLE_IP 'pm2 logs train-tracker'"
echo "     Koyeb:  koyeb app logs $KOYEB_APP"
echo ""

