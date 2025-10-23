#!/bin/bash
echo "📥 Updating Pakistan Train Tracker..."

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    git pull origin main
fi

# Install/update dependencies
npm install

# Restart the application
if command -v pm2 &> /dev/null; then
    pm2 restart pakistan-train-tracker
    pm2 save
else
    echo "Please restart the application manually: ./restart.sh"
fi
