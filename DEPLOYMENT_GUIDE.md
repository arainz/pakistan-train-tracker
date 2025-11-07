# Pakistan Train Tracker - Complete Deployment Guide

This guide covers deploying to all three cloud platforms: Google Cloud Run, Oracle Cloud (Always Free), and Koyeb.

## Prerequisites

### Required Tools
- `git` - Version control
- `gcloud` CLI - Google Cloud deployment
- `docker` - Container management (for local testing)
- `npm` - Node.js package manager

### Accounts Setup
- Google Cloud account (with billing enabled for Cloud Run)
- Oracle Cloud account (Always Free tier)
- Koyeb account (free tier)

---

## 1. Google Cloud Run Deployment

### Setup (One-time)

```bash
# Install Google Cloud CLI
# macOS:
brew install google-cloud-sdk

# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Deploy Steps

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail

# Build and deploy to Cloud Run
gcloud run deploy pakistan-train-tracker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars NODE_ENV=production,PORT=8080

# The command will output your service URL like:
# Service URL: https://pakistan-train-tracker-xxxxxxxxx.us-central1.run.app
```

### Update `config.js` Primary Server
After deployment, update the primary server URL in `public/config.js`:

```javascript
servers: {
    primary: 'https://pakistan-train-tracker-xxxxxxxxx.us-central1.run.app',
    fallback: 'http://138.2.91.18:3000',
    backup: 'https://confused-eel-pakrail-7ab69761.koyeb.app'
}
```

---

## 2. Oracle Cloud Deployment (Always Free)

### Setup (One-time)

1. Create an Always Free compute instance:
   - OS: Ubuntu 22.04
   - Instance shape: Ampere (ARM)
   - Memory: 6GB (Always Free)

2. SSH into instance:
```bash
ssh ubuntu@YOUR_ORACLE_IP
```

3. Install Node.js and dependencies:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Install PM2 (process manager)
sudo npm install -g pm2

# Verify installation
node --version
npm --version
```

### Deploy Steps

```bash
# On your local machine, clone and prepare the repo
git clone https://github.com/arainz/pakistan-train-tracker.git
cd pakistan-train-tracker

# Copy to Oracle instance
rsync -avz --exclude node_modules --exclude .git . ubuntu@YOUR_ORACLE_IP:/home/ubuntu/app/

# SSH into Oracle instance
ssh ubuntu@YOUR_ORACLE_IP

# On Oracle instance:
cd /home/ubuntu/app
npm ci --only=production

# Start with PM2
pm2 start server.js --name "train-tracker" --instances max
pm2 save
pm2 startup

# Configure nginx reverse proxy (optional but recommended)
sudo apt install -y nginx
```

### Nginx Configuration (Optional)

Create `/etc/nginx/sites-available/train-tracker`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/train-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Get Your IP
```bash
# On Oracle instance:
curl https://checkip.amazonaws.com
# Output: 138.2.91.18 (or your actual IP)
```

---

## 3. Koyeb Deployment

### Setup (One-time)

1. Create account on [Koyeb.com](https://www.koyeb.com)
2. Install Koyeb CLI:

```bash
# macOS
brew install koyeb/tap/koyeb

# Login
koyeb auth login
```

### Deploy Steps

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail

# Deploy to Koyeb
koyeb app create pakistan-train-tracker \
  --git github.com/arainz/pakistan-train-tracker \
  --git-branch main \
  --git-builder buildpack \
  --instance-type free \
  --regions fra \
  --env NODE_ENV=production,PORT=8000

# Or via Docker (alternative):
koyeb app create pakistan-train-tracker \
  --git github.com/arainz/pakistan-train-tracker \
  --git-branch main \
  --git-builder docker \
  --dockerfile ./Dockerfile \
  --instance-type free
```

### Get Your URL
```bash
koyeb app get pakistan-train-tracker
# Look for the Public URL in output
```

---

## 4. Complete Update Script

Create a file `deploy-all.sh` to deploy to all three servers:

```bash
#!/bin/bash

set -e

echo "🚀 Pakistan Train Tracker - Multi-Server Deployment"
echo "=================================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail"
GCP_PROJECT_ID="your-project-id"
ORACLE_IP="138.2.91.18"
ORACLE_USER="ubuntu"

cd "$PROJECT_DIR"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Commit changes
echo -e "\n${YELLOW}1. Committing changes to git...${NC}"
git add -A
git commit -m "Deployment build $(date +%Y-%m-%d\ %H:%M:%S)" || true
git push origin main
print_status "Git updated"

# 2. Deploy to Google Cloud Run
echo -e "\n${YELLOW}2. Deploying to Google Cloud Run...${NC}"
gcloud run deploy pakistan-train-tracker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --project $GCP_PROJECT_ID

GCP_URL=$(gcloud run services describe pakistan-train-tracker \
  --region us-central1 \
  --project $GCP_PROJECT_ID \
  --format 'value(status.url)')
print_status "Google Cloud deployed: $GCP_URL"

# 3. Deploy to Oracle Cloud
echo -e "\n${YELLOW}3. Deploying to Oracle Cloud...${NC}"
rsync -avz --exclude node_modules --exclude .git --exclude .env . \
  $ORACLE_USER@$ORACLE_IP:/home/ubuntu/app/

ssh $ORACLE_USER@$ORACLE_IP << 'EOF'
  cd /home/ubuntu/app
  npm ci --only=production
  pm2 restart all || pm2 start server.js --name "train-tracker"
  pm2 save
EOF
print_status "Oracle Cloud deployed: http://$ORACLE_IP:3000"

# 4. Deploy to Koyeb
echo -e "\n${YELLOW}4. Deploying to Koyeb...${NC}"
koyeb app create pakistan-train-tracker \
  --git github.com/arainz/pakistan-train-tracker \
  --git-branch main \
  --git-builder buildpack || \
koyeb app redeploy pakistan-train-tracker
print_status "Koyeb deployment initiated"

# 5. Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "URLs:"
echo "  Google Cloud: $GCP_URL"
echo "  Oracle Cloud: http://$ORACLE_IP:3000"
echo "  Koyeb: https://pakistan-train-tracker-xxxx.koyeb.app"
echo ""
```

Make it executable:
```bash
chmod +x deploy-all.sh
```

---

## 5. Monitor & Maintain

### Google Cloud Run
```bash
# View logs
gcloud run services logs read pakistan-train-tracker --region us-central1 --limit 50

# View metrics
gcloud run services describe pakistan-train-tracker --region us-central1
```

### Oracle Cloud
```bash
ssh ubuntu@138.2.91.18

# View logs
pm2 logs train-tracker

# Monitor
pm2 monit
```

### Koyeb
```bash
koyeb app logs pakistan-train-tracker
```

---

## 6. Troubleshooting

### Google Cloud Run
```bash
# Rebuild without cache
gcloud run deploy pakistan-train-tracker \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --no-cache
```

### Oracle Cloud
```bash
ssh ubuntu@138.2.91.18

# Restart app
pm2 restart train-tracker

# Stop/Start
pm2 stop train-tracker
pm2 start train-tracker

# Remove old instances
pm2 delete all
```

### All Servers - Health Check
```bash
curl -i https://your-gcp-url.run.app/health
curl -i http://138.2.91.18:3000/health
curl -i https://your-koyeb-url.koyeb.app/health
```

---

## 7. Automated Updates

To automatically sync data daily, add to crontab on Oracle instance:

```bash
ssh ubuntu@138.2.91.18
crontab -e

# Add:
0 2 * * * cd /home/ubuntu/app && node fetch-new-data.js >> /tmp/fetch-data.log 2>&1
```

---

## Environment Variables

Ensure these are set on each platform:

```
NODE_ENV=production
PORT=8080 (GCP) / 3000 (Oracle) / 8000 (Koyeb)
DATA_BASE_URL=https://trackyourtrains.com/data
SOCKET_URL=https://socket.pakraillive.com
```

---

## Quick Reference

| Platform | URL | Scaling | Cost |
|----------|-----|---------|------|
| Google Cloud Run | https://pakistan-train-tracker-xxx.run.app | Auto | Free tier + pay per request |
| Oracle Cloud | http://138.2.91.18:3000 | Manual (PM2) | Always Free tier |
| Koyeb | https://pakistan-train-tracker.koyeb.app | Auto | Free tier + pay per request |

