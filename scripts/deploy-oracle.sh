#!/bin/bash

# Oracle Cloud Deployment Script
# Usage: ./scripts/deploy-oracle.sh [username] [ip-address]

set -e

ORACLE_USER="${1:-ubuntu}"
ORACLE_IP="${2:-138.2.91.18}"
REMOTE_PATH="/home/ubuntu/app"
LOCAL_PATH="."

echo "=================================================="
echo "🏔️  Oracle Cloud Deployment"
echo "=================================================="
echo "User: $ORACLE_USER"
echo "IP: $ORACLE_IP"
echo ""

# Verify SSH connection
echo "🔑 Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 $ORACLE_USER@$ORACLE_IP "echo 'SSH connection OK'" > /dev/null 2>&1; then
    echo "❌ Cannot connect to Oracle instance via SSH"
    echo "Make sure:"
    echo "  1. SSH key is configured"
    echo "  2. Security rules allow port 22"
    echo "  3. IP address is correct"
    exit 1
fi
echo "✅ SSH connection successful"

# Sync files to Oracle
echo ""
echo "📦 Syncing application files..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude .DS_Store \
  --exclude "*.log" \
  $LOCAL_PATH/ $ORACLE_USER@$ORACLE_IP:$REMOTE_PATH/

echo "✅ Files synced"

# Remote setup and deployment
echo ""
echo "🚀 Setting up and deploying on Oracle instance..."
ssh $ORACLE_USER@$ORACLE_IP << 'EOFREMOTE'
  set -e
  cd /home/ubuntu/app

  echo "📦 Installing dependencies..."
  npm ci --only=production

  echo "🔄 Restarting application with PM2..."
  if pm2 info train-tracker &> /dev/null; then
    pm2 restart train-tracker
  else
    pm2 start server.js --name "train-tracker" --instances max --exec-mode cluster
  fi

  pm2 save
  pm2 startup

  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "Application status:"
  pm2 list

  echo ""
  echo "Access URL: http://$(curl -s https://checkip.amazonaws.com):3000"
EOFREMOTE

echo ""
echo "📍 Oracle Cloud Instance: http://$ORACLE_IP:3000"
echo ""
echo "Next steps:"
echo "1. Update config.js with:"
echo "   servers.fallback = 'http://$ORACLE_IP:3000'"
echo "2. Test the endpoint:"
echo "   curl -i http://$ORACLE_IP:3000/health"
echo "3. View logs:"
echo "   ssh $ORACLE_USER@$ORACLE_IP 'pm2 logs train-tracker'"
echo ""
